// ─── Core types for the Polyglot Dependency Intelligence Engine ─────────────

export type NodeKind =
  | "fetch_call"        // e.g. fetch("/api/users")
  | "axios_call"        // e.g. axios.get("/api/users")
  | "api_route"         // e.g. Express app.get("/api/users", ...)
  | "go_handler"        // e.g. router.GET("/api/users", handler)
  | "exported_type"     // TypeScript interface / type alias
  | "go_struct"         // Go exported struct
  | "sql_table"         // CREATE TABLE statement
  | "prisma_model";     // Prisma model block

export interface DependencyNode {
  id: string;           // unique — e.g. "ts:src/api.ts:fetch:/api/users"
  kind: NodeKind;
  label: string;        // human-readable name
  filePath: string;
  line: number;
  language: "typescript" | "go" | "python" | "sql" | "prisma";
  // extracted detail: URL pattern, type name, table name, etc.
  detail: string;
}

export interface DependencyEdge {
  from: string;   // node id
  to: string;     // node id
  relation: "calls" | "implements" | "queries" | "defines";
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

// What the /impact endpoint returns
export interface ImpactResult {
  changedNode: DependencyNode;
  affected: DependencyNode[];
  edges: DependencyEdge[];
}
