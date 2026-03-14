import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getUserOctokit } from "@/lib/github";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { repository, filePath, content, message } = body;

    if (!repository || !filePath || typeof content !== "string") {
      return NextResponse.json({ error: "repository, filePath and content are required" }, { status: 400 });
    }

    const [owner, repo] = String(repository).split("/");
    if (!owner || !repo) {
      return NextResponse.json({ error: "repository must be in owner/repo format" }, { status: 400 });
    }

    const connected = await prisma.repository.findFirst({
      where: {
        userId: user.id,
        owner,
        name: repo,
      },
      select: { id: true },
    });

    if (!connected) {
      return NextResponse.json({ error: "Repository is not connected in NeoForge" }, { status: 403 });
    }

    const octokit = await getUserOctokit(user.id);
    const normalizedPath = String(filePath).replace(/^\/+/, "");

    let sha: string | undefined;

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: normalizedPath,
      });

      if (!Array.isArray(data) && data.type === "file") {
        sha = data.sha;
      }
    } catch (error: any) {
      if (error?.status !== 404) {
        throw error;
      }
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: normalizedPath,
      message: message || `chore: update ${normalizedPath} from NeoForge IDE`,
      content: Buffer.from(content, "utf-8").toString("base64"),
      sha,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error committing file to GitHub:", error);
    if (error instanceof Error && error.message === "GitHub access token not found") {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to commit file to GitHub" }, { status: 500 });
  }
}
