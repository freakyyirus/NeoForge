// ─── Directed Acyclic Graph (DAG) for cross-language dependencies ────────────
// Builds an in-memory graph from extracted nodes and infers edges by matching
// URL patterns between frontend calls and backend route definitions,
// and by matching model/table names in backend queries.

import type {
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  ImpactResult,
} from "./types";

// ─── Normalise URL patterns so "/api/users/:id" matches "/api/users/{id}" ───

function normaliseUrl(url: string): string {
  return url
    .replace(/:[\w]+/g, "{param}")   // Express :id
    .replace(/\{[\w]+\}/g, "{param}") // OpenAPI {id}
    .replace(/\*$/, "")
    .split("?")[0]                    // strip query string
    .toLowerCase()
    .replace(/\/+$/, "");             // trailing slash
}

// ─── DAG class ───────────────────────────────────────────────────────────────

export class DependencyDAG {
  private nodes = new Map<string, DependencyNode>();
  private edges: DependencyEdge[] = [];

  addNode(node: DependencyNode) {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: DependencyEdge) {
    // Prevent duplicate edges
    const exists = this.edges.some(
      (e) => e.from === edge.from && e.to === edge.to && e.relation === edge.relation
    );
    if (!exists) this.edges.push(edge);
  }

  getNode(id: string): DependencyNode | undefined {
    return this.nodes.get(id);
  }

  allNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  allEdges(): DependencyEdge[] {
    return this.edges;
  }

  // ── Automatic edge inference ──────────────────────────────────────────────

  inferEdges() {
    const allNodes = this.allNodes();

    // 1. Match fetch/axios calls → API routes (TS→TS or TS→Go)
    const callers = allNodes.filter(
      (n) => n.kind === "fetch_call" || n.kind === "axios_call"
    );
    const routes = allNodes.filter(
      (n) => n.kind === "api_route" || n.kind === "go_handler"
    );

    for (const caller of callers) {
      const callerUrl = normaliseUrl(caller.detail);
      for (const route of routes) {
        const routeUrl = normaliseUrl(route.detail);
        if (callerUrl === routeUrl || callerUrl.startsWith(routeUrl)) {
          this.addEdge({
            from: caller.id,
            to: route.id,
            relation: "calls",
          });
        }
      }
    }

    // 2. Match Go structs / TS exported types → routes that mention the name
    //    This is a heuristic: if a route file and a struct share the same
    //    file path prefix, link them as "implements"
    const structs = allNodes.filter(
      (n) => n.kind === "go_struct" || n.kind === "exported_type"
    );
    for (const struct of structs) {
      for (const route of routes) {
        // Same file — route likely uses this type
        if (route.filePath === struct.filePath) {
          this.addEdge({
            from: route.id,
            to: struct.id,
            relation: "implements",
          });
        }
      }
    }

    // 3. Match Prisma models → SQL tables by name (case-insensitive)
    const prismaModels = allNodes.filter((n) => n.kind === "prisma_model");
    const sqlTables = allNodes.filter((n) => n.kind === "sql_table");
    for (const model of prismaModels) {
      for (const table of sqlTables) {
        if (model.detail.toLowerCase() === table.detail.toLowerCase()) {
          this.addEdge({
            from: model.id,
            to: table.id,
            relation: "defines",
          });
        }
      }
    }

    // 4. Link API routes → Prisma models when the route file name suggests
    //    it: e.g. a file named "users.ts" and a model named "User"
    for (const route of routes) {
      const fileBase = route.filePath
        .split(/[\\/]/)
        .pop()!
        .replace(/\.(ts|go|js)$/, "")
        .toLowerCase();
      for (const model of prismaModels) {
        if (
          model.detail.toLowerCase().startsWith(fileBase) ||
          fileBase.startsWith(model.detail.toLowerCase())
        ) {
          this.addEdge({
            from: route.id,
            to: model.id,
            relation: "queries",
          });
        }
      }
    }
  }

  // ── Blast-radius traversal (BFS downstream) ───────────────────────────────

  impactOf(nodeId: string): ImpactResult | null {
    const origin = this.nodes.get(nodeId);
    if (!origin) return null;

    const visited = new Set<string>();
    const queue = [nodeId];
    const affectedEdges: DependencyEdge[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const edge of this.edges) {
        // Traverse: if something calls/depends on current, it is affected
        if (edge.to === current && !visited.has(edge.from)) {
          affectedEdges.push(edge);
          queue.push(edge.from);
        }
        // Also traverse forward (things current calls — they may break too)
        if (edge.from === current && !visited.has(edge.to)) {
          affectedEdges.push(edge);
          queue.push(edge.to);
        }
      }
    }

    visited.delete(nodeId); // exclude the origin node itself from "affected"
    const affected = Array.from(visited)
      .map((id) => this.nodes.get(id))
      .filter(Boolean) as DependencyNode[];

    return { changedNode: origin, affected, edges: affectedEdges };
  }

  // ── D3 force-graph compatible output ─────────────────────────────────────

  toD3Graph(): {
    nodes: { id: string; label: string; kind: string; language: string; filePath: string; line: number }[];
    links: { source: string; target: string; relation: string }[];
  } {
    return {
      nodes: this.allNodes().map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        language: n.language,
        filePath: n.filePath,
        line: n.line,
      })),
      links: this.allEdges().map((e) => ({
        source: e.from,
        target: e.to,
        relation: e.relation,
      })),
    };
  }

  toSerializable(): DependencyGraph {
    return { nodes: this.allNodes(), edges: this.allEdges() };
  }
}
