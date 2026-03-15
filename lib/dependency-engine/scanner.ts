// ─── Project scanner ─────────────────────────────────────────────────────────
// Walks a project directory, calls the right extractor per file type,
// populates a DependencyDAG, and caches the result.

import fs from "fs";
import path from "path";
import { DependencyDAG } from "./dag";
import type { DependencyNode } from "./types";
import {
  extractTypeScriptNodes,
  extractGoNodes,
  extractSQLNodes,
  extractPrismaNodes,
} from "./ast-parser";

const SUPPORTED_EXTENSIONS = new Set(["ts", "tsx", "go", "sql", "prisma"]);
const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".turbo",
]);

// Simple module-level cache (per process lifetime / per serverless warm start)
const dagCache = new Map<string, { dag: DependencyDAG; builtAt: number }>();
const CACHE_TTL_MS = 60_000; // rebuild at most once per minute

function walkDir(dir: string, fileList: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return fileList;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, fileList);
    } else if (entry.isFile()) {
      const ext = entry.name.split(".").pop() ?? "";
      if (SUPPORTED_EXTENSIONS.has(ext)) fileList.push(full);
    }
  }
  return fileList;
}

export function buildDag(projectRoot: string): DependencyDAG {
  const cached = dagCache.get(projectRoot);
  if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) {
    return cached.dag;
  }

  const dag = new DependencyDAG();
  const files = walkDir(projectRoot);

  for (const filePath of files) {
    const ext = filePath.split(".").pop() ?? "";
    let source: string;
    try {
      source = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    let extracted: DependencyNode[] = [];
    if (ext === "ts" || ext === "tsx") {
      extracted = extractTypeScriptNodes(filePath, source);
    } else if (ext === "go") {
      extracted = extractGoNodes(filePath, source);
    } else if (ext === "sql") {
      extracted = extractSQLNodes(filePath, source);
    } else if (ext === "prisma") {
      extracted = extractPrismaNodes(filePath, source);
    }

    for (const node of extracted) dag.addNode(node);
  }

  // Infer cross-language edges after all nodes are loaded
  dag.inferEdges();

  dagCache.set(projectRoot, { dag, builtAt: Date.now() });
  return dag;
}

// Force a cache bust (useful after file changes)
export function invalidateDagCache(projectRoot: string) {
  dagCache.delete(projectRoot);
}
