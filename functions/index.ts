import { inngest } from "../lib/inngest/client";
import { prisma } from "../lib/prisma";
import { getUserRepositories, getPullRequestDiff, postPullRequestReview } from "../lib/github";
import { indexFile, deleteRepositoryIndex, queryCodebase } from "../lib/pinecone";
import { generatePRReview } from "../lib/ai";

interface IndexCodebaseEvent {
  name: "github.repo.index";
  data: {
    repositoryId: string;
  };
}

interface GenerateReviewEvent {
  name: "github.pr.opened";
  data: {
    repositoryId: string;
    prNumber: number;
    installationId: number;
  };
}

interface SyncUserRepositoriesEvent {
  name: "user.repositories.sync";
  data: {
    userId: string;
  };
}

export const indexCodebase = inngest.createFunction(
  {
    id: "index-codebase",
    name: "Index Codebase",
  },
  {
    event: "github.repo.index",
  },
  async ({ event, step }) => {
    const repository = await step.run("fetch-repository", async () => {
      return prisma.repository.findUnique({
        where: { id: (event as IndexCodebaseEvent).data.repositoryId },
        include: { user: true },
      });
    });

    if (!repository || !repository.user.githubAccessToken) {
      throw new Error("Repository or user not found");
    }

    const repoOwner = repository.owner;
    const repoName = repository.name;
    const repoToken = repository.user.githubAccessToken;

    await step.run("delete-existing-index", async () => {
      await deleteRepositoryIndex(repository.id);
    });

    const files = await step.run("fetch-files", async () => {
      const octokit = new (await import("@octokit/rest")).Octokit({
        auth: repoToken,
      });

      async function fetchDirectory(path: string): Promise<string[]> {
        const response = await octokit.repos.getContent({
          owner: repoOwner,
          repo: repoName,
          path,
        });

        const data = response.data;

        if (!Array.isArray(data)) return [];

        const files: string[] = [];
        
        for (const item of data) {
          if (item.type === "file" && !item.name.startsWith(".")) {
            files.push(item.path);
          } else if (item.type === "dir" && !item.name.startsWith(".")) {
            const subFiles = await fetchDirectory(item.path);
            files.push(...subFiles);
          }
        }

        return files;
      }

      return fetchDirectory("");
    });

    for (const filePath of files) {
      await step.run(`index-file-${filePath}`, async () => {
        const octokit = new (await import("@octokit/rest")).Octokit({
          auth: repository.user.githubAccessToken,
        });
        
        try {
          const response = await octokit.repos.getContent({
            owner: repository.owner,
            repo: repository.name,
            path: filePath,
          });

          const fileData = response.data;
          if (!Array.isArray(fileData) && fileData.type === "file" && "content" in fileData && fileData.content) {
            const content = Buffer.from(fileData.content, "base64").toString("utf-8");
            await indexFile(repository.id, filePath, content);
          }
        } catch (error) {
          console.error(`Error indexing file ${filePath}:`, error);
        }
      });
    }

    await step.run("update-repository", async () => {
      await prisma.repository.update({
        where: { id: (event as IndexCodebaseEvent).data.repositoryId },
        data: { lastIndexedAt: new Date() },
      });
    });

    return { success: true, filesIndexed: files.length };
  }
);

export const generateReview = inngest.createFunction(
  {
    id: "generate-pr-review",
    name: "Generate PR Review",
  },
  {
    event: "github.pr.opened",
  },
  async ({ event, step }) => {
    const reviewEvent = event as GenerateReviewEvent;
    const { repositoryId, prNumber } = reviewEvent.data;

    const repository = await step.run("fetch-repository", async () => {
      return prisma.repository.findUnique({
        where: { id: repositoryId },
        include: { user: true },
      });
    });

    if (!repository || !repository.user.githubAccessToken) {
      throw new Error("Repository or user not found");
    }

    const { pr, diff } = await step.run("fetch-pr-diff", async () => {
      const { getPullRequestDiff } = await import("../lib/github");
      return getPullRequestDiff(
        repository.owner,
        repository.name,
        prNumber,
        repository.user.githubAccessToken!
      );
    });

    await step.run("create-review-record", async () => {
      return prisma.review.create({
        data: {
          repositoryId: repository.id,
          userId: repository.userId,
          prNumber,
          prTitle: pr.title,
          prBody: pr.body || undefined,
          prState: pr.state,
          reviewType: "AUTOMATIC",
          status: "IN_PROGRESS",
          diff,
        },
      });
    });

    const context = await step.run("get-context", async () => {
      const { queryCodebase } = await import("../lib/pinecone");
      return queryCodebase(repository.id, pr.title + " " + (pr.body || ""), 5);
    });

    const reviewResult = await step.run("generate-review", async () => {
      return generatePRReview(
        pr.title || "",
        pr.body || "",
        diff,
        (context as { content: string }[]).map((c) => c.content)
      );
    });

    await step.run("save-review", async () => {
      return prisma.review.updateMany({
        where: { repositoryId: repository.id, prNumber },
        data: {
          status: "COMPLETED",
          walkthrough: reviewResult.walkthrough,
          sequenceDiagrams: JSON.stringify(reviewResult.sequenceDiagrams),
          summary: reviewResult.summary,
          strengths: JSON.stringify(reviewResult.strengths),
          issues: JSON.stringify(reviewResult.issues),
          suggestions: JSON.stringify(reviewResult.suggestions),
        },
      });
    });

    await step.run("post-to-github", async () => {
      const reviewBody = `## NeoForge AI Review

### Summary
${reviewResult.summary}

### Strengths
${reviewResult.strengths.map((s) => `- ${s}`).join("\n")}

### Issues Found
${reviewResult.issues.map((i) => `- **[${i.severity.toUpperCase()}]** ${i.message}${i.line ? ` (line ${i.line})` : ""}`).join("\n")}

### Suggestions
${reviewResult.suggestions.map((s) => `**${s.file}**: ${s.suggestion}${s.code ? `\n\`\`\`\n${s.code}\n\`\`\`` : ""}`).join("\n\n")}

---
*Generated by NeoForge AI Code Review*`;

      await postPullRequestReview(
        repository.owner,
        repository.name,
        prNumber,
        repository.user.githubAccessToken!,
        reviewBody
      );
    });

    return { success: true };
  }
);

export const syncUserRepositories = inngest.createFunction(
  {
    id: "sync-user-repositories",
    name: "Sync User Repositories",
  },
  {
    event: "user.repositories.sync",
  },
  async ({ event, step }) => {
    const syncEvent = event as SyncUserRepositoriesEvent;
    const { userId } = syncEvent.data;

    const user = await step.run("fetch-user", async () => {
      return prisma.user.findUnique({
        where: { id: userId },
      });
    });

    if (!user?.githubAccessToken) {
      throw new Error("User not found or no GitHub token");
    }

    const repos = await step.run("fetch-repos", async () => {
      return getUserRepositories(userId);
    });

    await step.run("save-repos", async () => {
      for (const repo of repos) {
        await prisma.repository.upsert({
          where: {
            owner_name: {
              owner: repo.owner.login,
              name: repo.name,
            },
          },
          create: {
            owner: repo.owner.login,
            name: repo.name,
            githubId: String(repo.id),
            githubNodeId: repo.node_id,
            userId: user.id,
          },
          update: {
            updatedAt: new Date(),
          },
        });
      }
    });

    return { success: true, reposCount: repos.length };
  }
);
