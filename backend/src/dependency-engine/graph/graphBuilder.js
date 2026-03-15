const fs = require("fs/promises");
const path = require("path");
const { scanProjectFiles } = require("../scanner/projectScanner");
const { extractFrontendDependencies } = require("../extractors/frontendExtractor");
const { extractBackendDependencies } = require("../extractors/backendExtractor");
const { extractDatabaseDependencies } = require("../extractors/databaseExtractor");
const { DependencyGraph } = require("./dependencyGraph");

function normalizePathPath(v) {
  return String(v || "")
    .split("?")[0]
    .replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, "{param}")
    .replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, "{param}")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function looksRelatedByName(routePath, modelName) {
  const routeToken = routePath.split("/").filter(Boolean).pop() || "";
  const singular = routeToken.endsWith("s") ? routeToken.slice(0, -1) : routeToken;
  return singular && modelName && singular.toLowerCase() === modelName.toLowerCase();
}

async function buildDependencyGraph(projectRoot) {
  const graph = new DependencyGraph();

  const files = await scanProjectFiles(projectRoot);
  const frontendNodes = [];
  const backendNodes = [];
  const dbNodes = [];

  for (const fileMeta of files) {
    const source = await fs.readFile(fileMeta.absPath, "utf8");

    frontendNodes.push(...extractFrontendDependencies(fileMeta, source));
    backendNodes.push(...extractBackendDependencies(fileMeta, source));
    dbNodes.push(...extractDatabaseDependencies(fileMeta, source));
  }

  const allNodes = [...frontendNodes, ...backendNodes, ...dbNodes];
  for (const node of allNodes) graph.addNode(node);

  // frontend-call -> backend-route (deterministic URL matching)
  for (const fe of frontendNodes) {
    const fePath = normalizePathPath(fe.path);
    for (const be of backendNodes) {
      if (be.type !== "backend-route") continue;
      const bePath = normalizePathPath(be.path);
      if (fePath && bePath && (fePath === bePath || fePath.startsWith(`${bePath}/`))) {
        graph.addEdge(fe.id, be.id, "frontend_to_backend_api_call");
      }
    }
  }

  // backend-route -> database-model (deterministic route/model heuristic)
  for (const be of backendNodes) {
    if (be.type !== "backend-route") continue;
    for (const db of dbNodes) {
      if (db.type !== "database-model") continue;
      if (looksRelatedByName(be.path, db.name)) {
        graph.addEdge(be.id, db.id, "backend_to_database_query");
      }
    }
  }

  return graph;
}

// In-memory graph cache (local runtime only)
const inMemoryStore = {
  builtAt: 0,
  projectRoot: null,
  graph: null,
};

async function getOrBuildGraph(projectRoot, maxAgeMs = 60_000) {
  const now = Date.now();
  const resolved = path.resolve(projectRoot);

  if (
    inMemoryStore.graph &&
    inMemoryStore.projectRoot === resolved &&
    now - inMemoryStore.builtAt <= maxAgeMs
  ) {
    return inMemoryStore.graph;
  }

  const graph = await buildDependencyGraph(resolved);
  inMemoryStore.graph = graph;
  inMemoryStore.projectRoot = resolved;
  inMemoryStore.builtAt = now;
  return graph;
}

module.exports = {
  buildDependencyGraph,
  getOrBuildGraph,
};
