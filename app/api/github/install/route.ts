import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { installationId, repositoryId } = body;

    if (!installationId || !repositoryId) {
      return NextResponse.json({ error: "Installation ID and repository ID are required" }, { status: 400 });
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { githubAccessToken: true },
    });

    if (!userRecord?.githubAccessToken) {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
    }

    const octokit = new (await import("@octokit/rest")).Octokit({
      auth: userRecord.githubAccessToken,
    });

    const repoResponse = await octokit.repos.get({
      owner: repositoryId.split("/")[0],
      repo: repositoryId.split("/")[1],
    });

    await prisma.repository.upsert({
      where: {
        owner_name: {
          owner: repoResponse.data.owner.login,
          name: repoResponse.data.name,
        },
      },
      create: {
        owner: repoResponse.data.owner.login,
        name: repoResponse.data.name,
        githubId: String(repoResponse.data.id),
        githubNodeId: repoResponse.data.node_id,
        userId: user.id,
        webhookId: "",
        webhookSecret: "",
      },
      update: {
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "Repository installed successfully" });
  } catch (error) {
    console.error("Error installing repository:", error);
    return NextResponse.json({ error: "Failed to install repository" }, { status: 500 });
  }
}
