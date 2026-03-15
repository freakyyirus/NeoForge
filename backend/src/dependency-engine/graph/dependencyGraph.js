const { Graph, alg } = require("graphlib");

class DependencyGraph {
  constructor() {
    this.graph = new Graph({ directed: true, multigraph: false, compound: false });
  }

  addNode(node) {
    if (!this.graph.hasNode(node.id)) {
      this.graph.setNode(node.id, node);
    }
  }

  addEdge(from, to, edgeType) {
    if (!from || !to || from === to) return;
    if (!this.graph.hasNode(from) || !this.graph.hasNode(to)) return;
    if (!this.graph.hasEdge(from, to)) {
      this.graph.setEdge(from, to, { type: edgeType });
    }
  }

  getNode(nodeId) {
    return this.graph.node(nodeId) || null;
  }

  getNodes() {
    return this.graph.nodes().map((id) => this.graph.node(id));
  }

  getEdges() {
    return this.graph.edges().map((e) => ({
      source: e.v,
      target: e.w,
      ...(this.graph.edge(e) || {}),
    }));
  }

  // Downstream blast radius based on outgoing edges
  getAffectedNodes(nodeId) {
    if (!this.graph.hasNode(nodeId)) return [];

    const visited = new Set([nodeId]);
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift();
      const next = this.graph.successors(current) || [];
      for (const id of next) {
        if (!visited.has(id)) {
          visited.add(id);
          queue.push(id);
        }
      }
    }

    visited.delete(nodeId);
    return [...visited].map((id) => this.graph.node(id));
  }

  isDag() {
    return alg.isAcyclic(this.graph);
  }

  toD3() {
    return {
      nodes: this.getNodes().map((n) => ({
        id: n.id,
        type: n.type,
        label: n.path || n.name || n.id,
        filePath: n.filePath,
        line: n.line,
      })),
      edges: this.getEdges(),
    };
  }
}

module.exports = {
  DependencyGraph,
};
