import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getUserRepositories } from "@/lib/github";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repos = await getUserRepositories(user.id);
    
    const connectedRepos = await prisma.repository.findMany({
      where: { userId: user.id },
      select: { id: true, githubId: true },
    });
    
    const connectedIds = new Set(connectedRepos.map(r => r.githubId));
    const connectedByGithubId = new Map(connectedRepos.map((r) => [r.githubId, r.id]));

    return NextResponse.json({
      repos: repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        language: repo.language,
        updatedAt: repo.updated_at,
        connected: connectedIds.has(String(repo.id)),
        connectedRepositoryId: connectedByGithubId.get(String(repo.id)) || null,
      }))
    });
  } catch (error) {
    console.error("Error fetching repos:", error);
    return NextResponse.json({ error: "Failed to fetch repositories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { repoId, owner, name } = body;
    const githubId = String(repoId || "").trim();

    if (!githubId || !owner || !name) {
      return NextResponse.json({ error: "repoId, owner, and name are required" }, { status: 400 });
    }

    const existingRepo = await prisma.repository.findFirst({
      where: { 
        userId: user.id,
        githubId,
      },
    });

    if (existingRepo) {
      return NextResponse.json({ error: "Repository already connected" }, { status: 400 });
    }

    const userRepo = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscription: true },
    });

    if (userRepo?.subscription?.tier === "FREE") {
      const repoCount = await prisma.repository.count({
        where: { userId: user.id },
      });

      if (repoCount >= 5) {
        return NextResponse.json({ 
          error: "Free tier limit reached. Upgrade to Pro for unlimited repositories." 
        }, { status: 403 });
      }
    }

    const repo = await prisma.repository.create({
      data: {
        owner,
        name,
        githubId,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, repository: repo });
  } catch (error) {
    console.error("Error connecting repo:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Repository already connected" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to connect repository" }, { status: 500 });
  }
}
