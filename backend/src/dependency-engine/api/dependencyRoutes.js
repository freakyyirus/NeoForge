const { getOrBuildGraph } = require("../graph/graphBuilder");

function badRequest(message) {
  return { status: 400, body: { error: message } };
}

function ok(body) {
  return { status: 200, body };
}

async function getGraph({ projectRoot, maxAgeMs }) {
  if (!projectRoot) {
    return badRequest("projectRoot is required");
  }

  const graph = await getOrBuildGraph(projectRoot, maxAgeMs || 60_000);
  const d3 = graph.toD3();

  return ok({
    nodes: d3.nodes,
    edges: d3.edges,
    isDag: graph.isDag(),
  });
}

async function getImpact({ projectRoot, nodeId, maxAgeMs }) {
  if (!projectRoot) {
    return badRequest("projectRoot is required");
  }
  if (!nodeId) {
    return badRequest("nodeId is required");
  }

  const graph = await getOrBuildGraph(projectRoot, maxAgeMs || 60_000);
  const node = graph.getNode(nodeId);

  if (!node) {
    return { status: 404, body: { error: `node not found: ${nodeId}` } };
  }

  const affectedNodes = graph.getAffectedNodes(nodeId);
  return ok({
    node,
    affectedNodes,
  });
}

// Optional express-style adapter to mount exact endpoints:
// GET  /api/dependencies/graph
// POST /api/dependencies/impact
function registerDependencyRoutes(app, options = {}) {
  app.get("/api/dependencies/graph", async (req, res) => {
    try {
      const result = await getGraph({
        projectRoot: req.query.projectRoot || options.projectRoot,
        maxAgeMs: Number(req.query.maxAgeMs || 60_000),
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post("/api/dependencies/impact", async (req, res) => {
    try {
      const result = await getImpact({
        projectRoot: req.body?.projectRoot || options.projectRoot,
        nodeId: req.body?.nodeId,
        maxAgeMs: Number(req.body?.maxAgeMs || 60_000),
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      res.status(500).json({ error: error.message || String(error) });
    }
  });
}

module.exports = {
  getGraph,
  getImpact,
  registerDependencyRoutes,
};
