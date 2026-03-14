import { Octokit } from "@octokit/rest";
import { prisma } from "./prisma";

export function createOctokit(accessToken: string) {
  return new Octokit({
    auth: accessToken,
  });
}

export async function getUserOctokit(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "github",
      accessToken: {
        not: null,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      accessToken: true,
    },
  });

  if (account?.accessToken) {
    return createOctokit(account.accessToken);
  }

  // Legacy fallback for users migrated from older auth schema.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubAccessToken: true },
  });

  if (!user?.githubAccessToken) {
    throw new Error("GitHub access token not found");
  }

  return createOctokit(user.githubAccessToken);
}

export async function getUserRepositories(userId: string) {
  const octokit = await getUserOctokit(userId);
  
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
  });

  return repos;
}

export async function getRepositoryContent(
  owner: string,
  repo: string,
  path: string,
  accessToken: string
) {
  const octokit = createOctokit(accessToken);
  
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    const data = response.data;

    if (Array.isArray(data)) {
      return { type: "dir" as const, content: data };
    }

    if (data.type === "file" && "content" in data && data.content) {
      return { 
        type: "file" as const, 
        content: Buffer.from(data.content, "base64").toString("utf-8"),
        sha: data.sha,
      };
    }

    return null;
  } catch (error: any) {
    if (error.status === 404) return null;
    throw error;
  }
}

export async function getPullRequestDiff(
  owner: string,
  repo: string,
  pullNumber: number,
  accessToken: string
) {
  const octokit = createOctokit(accessToken);

  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return {
    pr,
    files,
    diff: files.map(f => f.patch).filter(Boolean).join("\n"),
  };
}

export async function createWebhook(
  owner: string,
  repo: string,
  accessToken: string,
  webhookUrl: string,
  webhookSecret: string
) {
  const octokit = createOctokit(accessToken);

  const { data: webhook } = await octokit.repos.createWebhook({
    owner,
    repo,
    config: {
      url: webhookUrl,
      content_type: "json",
      secret: webhookSecret,
    },
    events: ["pull_request"],
    active: true,
  });

  return webhook;
}

export async function postPullRequestReview(
  owner: string,
  repo: string,
  pullNumber: number,
  accessToken: string,
  body: string,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" = "COMMENT"
) {
  const octokit = createOctokit(accessToken);

  const { data: review } = await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    body,
    event,
  });

  return review;
}
