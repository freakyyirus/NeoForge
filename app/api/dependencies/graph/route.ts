// POST /api/dependencies/graph
// Body: { projectRoot: string, format?: "raw" | "d3" }
// Returns the full DAG — either as raw DependencyGraph or D3-compatible format

import { NextRequest, NextResponse } from "next/server";
import { buildDag, invalidateDagCache } from "@/lib/dependency-engine/scanner";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectRoot, format = "d3", bustCache } = body as {
      projectRoot?: string;
      format?: "raw" | "d3";
      bustCache?: boolean;
    };

    if (!projectRoot) {
      return NextResponse.json(
        { error: "projectRoot is required" },
        { status: 400 }
      );
    }

    if (projectRoot.includes("..")) {
      return NextResponse.json({ error: "Invalid projectRoot" }, { status: 400 });
    }

    if (bustCache) invalidateDagCache(projectRoot);

    const dag = buildDag(projectRoot);

    const graph =
      format === "d3" ? dag.toD3Graph() : dag.toSerializable();

    return NextResponse.json({
      projectRoot,
      format,
      nodeCount: dag.allNodes().length,
      edgeCount: dag.allEdges().length,
      graph,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
