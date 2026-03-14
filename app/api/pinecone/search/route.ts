import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { queryCodebase } from "@/lib/pinecone";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repositoryId");
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "5");

    if (!repositoryId || !query) {
      return NextResponse.json({ error: "Repository ID and query are required" }, { status: 400 });
    }

    const results = await queryCodebase(repositoryId, query, limit);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error searching codebase:", error);
    return NextResponse.json({ error: "Failed to search codebase" }, { status: 500 });
  }
}
