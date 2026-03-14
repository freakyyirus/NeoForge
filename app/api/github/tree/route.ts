import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getUserOctokit } from "@/lib/github";

const MAX_FILES = 200;
const MAX_FILE_SIZE_BYTES = 200 * 1024;

function isLikelyTextPath(path: string) {
  const lower = path.toLowerCase();
  const denied = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".tar", ".gz", ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".mp3", ".mov", ".avi", ".wasm", ".exe", ".dll", ".so", ".dylib"];
  return !denied.some((ext) => lower.endsWith(ext));
}

function decodeBase64Utf8(content: string) {
  return Buffer.from(content, "base64").toString("utf-8");
}

function isBinaryLike(content: string) {
  return /\u0000/.test(content);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repository = request.nextUrl.searchParams.get("repository") || "";
    const [owner, repo] = repository.split("/");
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
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch || "main";

    const { data: treeData } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: "1",
    });

    const allBlobEntries = (treeData.tree || []).filter((entry) => entry.type === "blob" && typeof entry.path === "string");

    const candidateEntries = allBlobEntries
      .filter((entry) => !!entry.path && isLikelyTextPath(entry.path || ""))
      .filter((entry) => typeof entry.size !== "number" || entry.size <= MAX_FILE_SIZE_BYTES)
      .slice(0, MAX_FILES);

    const fetched = await Promise.all(
      candidateEntries.map(async (entry) => {
        try {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: entry.path!,
            ref: defaultBranch,
          });

          if (Array.isArray(data) || data.type !== "file" || !("content" in data) || !data.content) {
            return null;
          }

          const decoded = decodeBase64Utf8(data.content);
          if (isBinaryLike(decoded)) return null;

          return {
            path: `/${entry.path!.replace(/\\/g, "/")}`,
            content: decoded,
          };
        } catch {
          return null;
        }
      })
    );

    const files = fetched.filter((file): file is { path: string; content: string } => !!file);

    return NextResponse.json({
      repository,
      branch: defaultBranch,
      files,
      totalFiles: allBlobEntries.length,
      loadedFiles: files.length,
      truncated: allBlobEntries.length > files.length || allBlobEntries.length > MAX_FILES,
    });
  } catch (error) {
    console.error("Error fetching repository tree:", error);
    if (error instanceof Error && error.message === "GitHub access token not found") {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to fetch repository tree" }, { status: 500 });
  }
}
