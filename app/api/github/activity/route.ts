import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserOctokit } from "@/lib/github";

type GitHubEvent = {
  id: string;
  type: string;
  created_at: string;
  repo?: {
    name?: string;
  };
  payload?: {
    size?: number;
    commits?: Array<{ sha?: string }>;
    pull_request?: {
      number?: number;
      title?: string;
    };
    action?: string;
  };
};

function getPushCommitCount(event: GitHubEvent): number {
  if (event.type !== "PushEvent") return 0;
  const commitArrayCount = Array.isArray(event.payload?.commits)
    ? event.payload?.commits.length
    : 0;
  const sizeCount = Number.isFinite(event.payload?.size) ? (event.payload?.size as number) : 0;
  return Math.max(commitArrayCount, sizeCount, 0);
}

function toRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const seconds = Math.max(1, Math.floor((now - then) / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapActivity(event: GitHubEvent) {
  const repoName = event.repo?.name || "unknown repo";

  if (event.type === "PushEvent") {
    const commits = getPushCommitCount(event);
    return {
      id: event.id,
      type: "commit",
      message: `${commits} commit${commits === 1 ? "" : "s"} pushed to ${repoName}`,
      time: toRelativeTime(event.created_at),
      createdAt: event.created_at,
      commitCount: commits,
      status: "default" as const,
    };
  }

  if (event.type === "PullRequestEvent") {
    const action = event.payload?.action || "updated";
    const number = event.payload?.pull_request?.number;
    const title = event.payload?.pull_request?.title || "Pull request";
    return {
      id: event.id,
      type: "review",
      message: `PR #${number || "?"} ${action}: ${title}`,
      time: toRelativeTime(event.created_at),
      createdAt: event.created_at,
      commitCount: 0,
      status: action === "opened" ? ("warning" as const) : ("success" as const),
    };
  }

  return {
    id: event.id,
    type: "repo",
    message: `${event.type.replace(/Event$/, "")} in ${repoName}`,
    time: toRelativeTime(event.created_at),
    createdAt: event.created_at,
    commitCount: 0,
    status: "default" as const,
  };
}

async function getRealCommitMetrics(octokit: Awaited<ReturnType<typeof getUserOctokit>>, sinceIso: string) {
  const dayBuckets: Record<string, number> = {
    Sun: 0,
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
    Sat: 0,
  };

  let commitsThisWeek = 0;

  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 10,
  });

  await Promise.all(
    repos.map(async (repo) => {
      try {
        const { data: commits } = await octokit.repos.listCommits({
          owner: repo.owner.login,
          repo: repo.name,
          since: sinceIso,
          per_page: 100,
        });

        for (const commit of commits) {
          const date = commit.commit.author?.date || commit.commit.committer?.date;
          if (!date) continue;
          const day = new Date(date).toLocaleDateString("en-US", { weekday: "short" });
          if (!(day in dayBuckets)) continue;
          dayBuckets[day] += 1;
          commitsThisWeek += 1;
        }
      } catch (error: any) {
        // 409 can happen on empty repositories; skip those.
        if (error?.status === 409 || error?.status === 404) {
          return;
        }
        throw error;
      }
    })
  );

  const commitSeries = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => ({
    name,
    commits: dayBuckets[name],
  }));

  return {
    commitsThisWeek,
    commitSeries,
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const octokit = await getUserOctokit(user.id);
    const { data: authUser } = await octokit.users.getAuthenticated();

    const { data } = await octokit.activity.listEventsForAuthenticatedUser({
      username: authUser.login,
      per_page: 100,
    });

    const events = (data as GitHubEvent[]) || [];
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let commitsThisWeek = 0;
    let commitSeries: Array<{ name: string; commits: number }> = [];

    try {
      const metrics = await getRealCommitMetrics(octokit, sinceIso);
      commitsThisWeek = metrics.commitsThisWeek;
      commitSeries = metrics.commitSeries;
    } catch {
      // Fallback to event-derived counts if commit-history calls fail.
      const dayBuckets: Record<string, number> = {
        Sun: 0,
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
      };

      for (const event of events) {
        if (event.type !== "PushEvent") continue;
        const timestamp = new Date(event.created_at).getTime();
        if (!Number.isFinite(timestamp) || timestamp < new Date(sinceIso).getTime()) continue;
        const day = new Date(event.created_at).toLocaleDateString("en-US", { weekday: "short" });
        const count = getPushCommitCount(event);
        if (!(day in dayBuckets) || count <= 0) continue;
        dayBuckets[day] += count;
        commitsThisWeek += count;
      }

      commitSeries = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => ({
        name,
        commits: dayBuckets[name],
      }));
    }

    const activities = events
      .map(mapActivity)
      .filter((activity) => activity.type !== "commit" || (activity.commitCount || 0) > 0)
      .slice(0, 10);

    return NextResponse.json({
      commitsThisWeek,
      commitSeries,
      activities,
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error fetching GitHub activity:", error);
    if (error instanceof Error && error.message === "GitHub access token not found") {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to fetch GitHub activity" }, { status: 500 });
  }
}
