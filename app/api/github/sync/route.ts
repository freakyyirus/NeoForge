import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getUserOctokit } from "@/lib/github";
import { inngest } from "@/lib/inngest/client";

type FileChange = {
  path: string;
  content: string;
};

function normalizeGitPath(inputPath: string) {
  return String(inputPath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

async function getExistingFileSha(octokit: Awaited<ReturnType<typeof getUserOctokit>>, owner: string, repo: string, path: string) {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if (!Array.isArray(data) && data.type === "file") {
      return data.sha;
    }
    return null;
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const repoUrl = String(body?.repoUrl || "").trim();

    // New async parse flow: mark project as processing and fan out to Inngest.
    // This branch is additive and keeps legacy repo sync behavior below unchanged.
    if (projectId && repoUrl) {
      try {
        await (prisma as any).project.update({
          where: { id: projectId },
          data: {
            status: "processing",
            repoUrl,
          },
        });
      } catch {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      await inngest.send({
        name: "project/parse.dependencies",
        data: {
          projectId,
          repoUrl,
        },
      });

      return NextResponse.json({
        success: true,
        queued: true,
        projectId,
        status: "processing",
      });
    }

    const repository = String(body?.repository || "");
    const message = String(body?.message || "chore: sync workspace from NeoForge IDE");
    const redeploy = Boolean(body?.redeploy);
    const rawChanges = Array.isArray(body?.changes) ? body.changes : [];
    const rawDeletedFiles = Array.isArray(body?.deletedFiles) ? body.deletedFiles : [];

    const changes: FileChange[] = rawChanges
      .map((item: any) => ({
        path: normalizeGitPath(item?.path || ""),
        content: typeof item?.content === "string" ? item.content : "",
      }))
      .filter((item: FileChange) => !!item.path);

    const deletedFiles: string[] = rawDeletedFiles
      .map((item: any) => normalizeGitPath(item))
      .filter((item: string) => !!item);

    if (!repository) {
      return NextResponse.json({ error: "repository is required" }, { status: 400 });
    }

    const [owner, repo] = repository.split("/");
    if (!owner || !repo) {
      return NextResponse.json({ error: "repository must be in owner/repo format" }, { status: 400 });
    }

    if (changes.length === 0 && deletedFiles.length === 0 && !redeploy) {
      return NextResponse.json({ error: "No changes, deletions, or redeploy requested" }, { status: 400 });
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

    const updated: string[] = [];
    const deleted: string[] = [];

    for (const change of changes) {
      const sha = await getExistingFileSha(octokit, owner, repo, change.path);
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: change.path,
        message,
        content: Buffer.from(change.content, "utf-8").toString("base64"),
        sha: sha || undefined,
      });
      updated.push(`/${change.path}`);
    }

    for (const path of deletedFiles) {
      const sha = await getExistingFileSha(octokit, owner, repo, path);
      if (!sha) continue;
      await octokit.repos.deleteFile({
        owner,
        repo,
        path,
        message,
        sha,
      });
      deleted.push(`/${path}`);
    }

    let redeployTriggered = false;
    let redeployInfo = "";

    if (redeploy) {
      const deployHookUrl = process.env.DEPLOY_HOOK_URL || process.env.VERCEL_DEPLOY_HOOK_URL || "";
      if (!deployHookUrl) {
        redeployInfo = "Redeploy hook not configured (set DEPLOY_HOOK_URL or VERCEL_DEPLOY_HOOK_URL).";
      } else {
        const redeployResponse = await fetch(deployHookUrl, { method: "POST" });
        if (!redeployResponse.ok) {
          redeployInfo = `Redeploy hook failed with status ${redeployResponse.status}.`;
        } else {
          redeployTriggered = true;
          redeployInfo = "Redeploy triggered.";
        }
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: updated.length,
      deletedCount: deleted.length,
      updated,
      deleted,
      redeployTriggered,
      redeployInfo,
    });
  } catch (error) {
    console.error("Error syncing repository:", error);
    if (error instanceof Error && error.message === "GitHub access token not found") {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to sync repository" }, { status: 500 });
  }
}
