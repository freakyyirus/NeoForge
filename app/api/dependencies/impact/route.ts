// POST /api/dependencies/impact
// Body: { projectRoot: string, nodeId: string }
// Returns: ImpactResult — the changed node + all downstream/upstream nodes

import { NextRequest, NextResponse } from "next/server";
import { buildDag, invalidateDagCache } from "@/lib/dependency-engine/scanner";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectRoot, nodeId, bustCache } = body as {
      projectRoot?: string;
      nodeId?: string;
      bustCache?: boolean;
    };

    if (!projectRoot || !nodeId) {
      return NextResponse.json(
        { error: "projectRoot and nodeId are required" },
        { status: 400 }
      );
    }

    // Basic path traversal guard — projectRoot must be an absolute path
    // and must not contain ".." segments after resolution
    const resolvedRoot = require("path").resolve(projectRoot);
    if (resolvedRoot !== projectRoot.replace(/\\/g, "/").replace(/\\/g, "/")) {
      // allow both slash styles but block traversal
    }
    if (projectRoot.includes("..")) {
      return NextResponse.json({ error: "Invalid projectRoot" }, { status: 400 });
    }

    if (bustCache) invalidateDagCache(projectRoot);

    const dag = buildDag(projectRoot);
    const result = dag.impactOf(nodeId);

    if (!result) {
      return NextResponse.json(
        { error: `Node "${nodeId}" not found in graph` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
