// ─── Tree-sitter AST parser ──────────────────────────────────────────────────
// Wraps tree-sitter initialisation and exposes typed parse helpers.
// Tree-sitter native bindings must NOT be bundled by webpack/turbopack —
// next.config.ts lists all four packages in serverExternalPackages.

import type { DependencyNode } from "./types";

// Lazy-load to avoid issues during build-time static analysis
let Parser: typeof import("tree-sitter") | null = null;
let TSTypescript: unknown = null;
let TSGo: unknown = null;
let TSPython: unknown = null;

function loadParsers() {
  if (Parser) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Parser = require("tree-sitter");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    TSTypescript = require("tree-sitter-typescript").typescript;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    TSGo = require("tree-sitter-go");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    TSPython = require("tree-sitter-python");
  } catch (e) {
    throw new Error(
      `tree-sitter native modules failed to load. Make sure they are installed and listed in serverExternalPackages. Reason: ${e}`
    );
  }
}

// ─── Generic tree-sitter parse ───────────────────────────────────────────────

type SitterLanguage = unknown;

function getLanguage(ext: string): SitterLanguage | null {
  loadParsers();
  switch (ext) {
    case "ts":
    case "tsx":
      return TSTypescript;
    case "go":
      return TSGo;
    case "py":
      return TSPython;
    default:
      return null;
  }
}

// ─── S-expression query helpers ──────────────────────────────────────────────
// We walk the CST manually instead of using tree-sitter Query objects so we
// avoid needing the compiled query WASM artifact at runtime.

interface SitterNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  childCount: number;
  children: SitterNode[];
  namedChildren: SitterNode[];
  firstNamedChild: SitterNode | null;
  parent: SitterNode | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  childForFieldName(name: string): SitterNode | null;
}

interface SitterTree {
  rootNode: SitterNode;
}

export function parseSource(source: string, fileExt: string): SitterTree | null {
  loadParsers();
  const lang = getLanguage(fileExt);
  if (!lang || !Parser) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new (Parser as any)();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (parser as any).setLanguage(lang);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (parser as any).parse(source) as SitterTree;
}

// ─── Walk helpers ────────────────────────────────────────────────────────────

export function walkTree(
  node: SitterNode,
  visitor: (n: SitterNode) => void
) {
  visitor(node);
  for (const child of node.children) {
    walkTree(child, visitor);
  }
}

// Return all nodes whose type matches
export function findNodes(root: SitterNode, type: string): SitterNode[] {
  const results: SitterNode[] = [];
  walkTree(root, (n) => {
    if (n.type === type) results.push(n);
  });
  return results;
}

// ─── TypeScript extractor ────────────────────────────────────────────────────

export function extractTypeScriptNodes(
  filePath: string,
  source: string
): DependencyNode[] {
  const tree = parseSource(source, "ts");
  if (!tree) return [];

  const nodes: DependencyNode[] = [];

  walkTree(tree.rootNode, (n) => {
    // ── fetch("…") calls ────────────────────────────────────────────────────
    if (n.type === "call_expression") {
      const fn = n.childForFieldName("function");
      const args = n.childForFieldName("arguments");
      if (!fn || !args) return;

      const fnText = fn.text;
      const firstArg = args.namedChildren[0];
      if (!firstArg) return;
      const url = firstArg.text.replace(/['"` ]/g, "");

      if (fnText === "fetch" || fnText.endsWith(".fetch")) {
        nodes.push({
          id: `ts:${filePath}:fetch:${url}:${n.startPosition.row}`,
          kind: "fetch_call",
          label: `fetch(${url})`,
          filePath,
          line: n.startPosition.row + 1,
          language: "typescript",
          detail: url,
        });
      }

      // axios.get/post/put/delete
      if (/axios\.(get|post|put|delete|patch)/.test(fnText)) {
        nodes.push({
          id: `ts:${filePath}:axios:${url}:${n.startPosition.row}`,
          kind: "axios_call",
          label: `${fnText}(${url})`,
          filePath,
          line: n.startPosition.row + 1,
          language: "typescript",
          detail: url,
        });
      }

      // Express-style: app.get("/route", handler) or router.get(...)
      if (/^(app|router)\.(get|post|put|delete|patch|use)$/.test(fnText)) {
        nodes.push({
          id: `ts:${filePath}:route:${url}:${n.startPosition.row}`,
          kind: "api_route",
          label: `${fnText}("${url}")`,
          filePath,
          line: n.startPosition.row + 1,
          language: "typescript",
          detail: url,
        });
      }
    }

    // ── Exported interfaces / type aliases ───────────────────────────────────
    if (
      n.type === "interface_declaration" ||
      n.type === "type_alias_declaration"
    ) {
      // Check if the parent export is present by walking up
      let cur: SitterNode | null = n.parent;
      let exported = false;
      while (cur) {
        if (cur.type === "export_statement") { exported = true; break; }
        cur = cur.parent;
      }
      if (!exported) return;

      const nameNode = n.childForFieldName("name");
      const name = nameNode?.text ?? "<anon>";
      nodes.push({
        id: `ts:${filePath}:type:${name}`,
        kind: "exported_type",
        label: name,
        filePath,
        line: n.startPosition.row + 1,
        language: "typescript",
        detail: name,
      });
    }
  });

  return nodes;
}

// ─── Go extractor ────────────────────────────────────────────────────────────

export function extractGoNodes(
  filePath: string,
  source: string
): DependencyNode[] {
  const tree = parseSource(source, "go");
  if (!tree) return [];

  const nodes: DependencyNode[] = [];

  walkTree(tree.rootNode, (n) => {
    // Gin/Chi/Mux handler: r.GET("/path", handler) or router.Handle(...)
    if (n.type === "call_expression") {
      const fn = n.childForFieldName("function");
      const args = n.childForFieldName("arguments");
      if (!fn || !args) return;

      const fnText = fn.text;
      if (/\.(GET|POST|PUT|DELETE|PATCH|Handle|HandleFunc)$/.test(fnText)) {
        const firstArg = args.namedChildren[0];
        if (!firstArg) return;
        const url = firstArg.text.replace(/"/g, "");
        nodes.push({
          id: `go:${filePath}:route:${url}:${n.startPosition.row}`,
          kind: "go_handler",
          label: `${fnText}("${url}")`,
          filePath,
          line: n.startPosition.row + 1,
          language: "go",
          detail: url,
        });
      }
    }

    // Exported struct declarations: type Foo struct { … }
    if (n.type === "type_declaration") {
      const specList = n.namedChildren.find((c) => c.type === "type_spec");
      if (!specList) return;
      const nameNode = specList.childForFieldName("name");
      const typeVal = specList.childForFieldName("type");
      if (!nameNode || !typeVal) return;
      if (typeVal.type !== "struct_type") return;
      const name = nameNode.text;
      // Go: exported if first letter is uppercase
      if (!/^[A-Z]/.test(name)) return;
      nodes.push({
        id: `go:${filePath}:struct:${name}`,
        kind: "go_struct",
        label: name,
        filePath,
        line: n.startPosition.row + 1,
        language: "go",
        detail: name,
      });
    }
  });

  return nodes;
}

// ─── SQL extractor (regex-based, no grammar needed) ─────────────────────────

export function extractSQLNodes(
  filePath: string,
  source: string
): DependencyNode[] {
  const nodes: DependencyNode[] = [];
  const lines = source.split("\n");

  lines.forEach((line, idx) => {
    const match = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i);
    if (match) {
      const tableName = match[1];
      nodes.push({
        id: `sql:${filePath}:table:${tableName}`,
        kind: "sql_table",
        label: tableName,
        filePath,
        line: idx + 1,
        language: "sql",
        detail: tableName,
      });
    }
  });

  return nodes;
}

// ─── Prisma extractor (regex-based) ─────────────────────────────────────────

export function extractPrismaNodes(
  filePath: string,
  source: string
): DependencyNode[] {
  const nodes: DependencyNode[] = [];
  const lines = source.split("\n");

  lines.forEach((line, idx) => {
    const match = line.match(/^model\s+(\w+)\s*\{/);
    if (match) {
      const modelName = match[1];
      nodes.push({
        id: `prisma:${filePath}:model:${modelName}`,
        kind: "prisma_model",
        label: modelName,
        filePath,
        line: idx + 1,
        language: "prisma",
        detail: modelName,
      });
    }
  });

  return nodes;
}
