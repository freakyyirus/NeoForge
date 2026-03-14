import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { repositoryId } = body;

    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        userId: user.id,
      },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    await inngest.send({
      name: "github.repo.index",
      data: {
        repositoryId: repository.id,
      },
    });

    return NextResponse.json({ success: true, message: "Indexing started" });
  } catch (error) {
    console.error("Error triggering indexing:", error);
    return NextResponse.json({ error: "Failed to trigger indexing" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repositoryId");

    if (!repositoryId) {
      return NextResponse.json({ error: "Repository ID required" }, { status: 400 });
    }

    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        userId: user.id,
      },
      select: {
        lastIndexedAt: true,
        indexedFiles: {
          select: { filePath: true },
        },
      },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    return NextResponse.json({
      lastIndexedAt: repository.lastIndexedAt,
      indexedFilesCount: repository.indexedFiles.length,
    });
  } catch (error) {
    console.error("Error getting index status:", error);
    return NextResponse.json({ error: "Failed to get index status" }, { status: 500 });
  }
}
