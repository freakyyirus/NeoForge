"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DashboardStats,
  CommitChart,
  ReviewStatusChart,
  RecentActivity,
} from "@/components/dashboard/dashboard-charts";
import { Plus, GitBranch, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  totalRepos: number;
  totalReviews: number;
  recentCommits: number;
  pendingReviews: number;
  commitData: { name: string; commits: number }[];
  activities: {
    id: string;
    type: "review" | "commit" | "repo";
    message: string;
    time: string;
    createdAt?: string;
    commitCount?: number;
    status: "success" | "warning" | "default";
  }[];
  reviewStatusData: { name: string; value: number; color: string }[];
}

function deriveReviewStatusFromActivities(
  activities: Array<{ type?: string; message?: string }> | undefined
) {
  const counts = {
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
  };

  const reviewActivities = Array.isArray(activities)
    ? activities.filter((activity) => activity?.type === "review")
    : [];

  reviewActivities.forEach((activity) => {
    const message = String(activity?.message || "").toLowerCase();
    const actionMatch = message.match(/pr\s*#\d+\s+([^:]+):/i);
    const action = (actionMatch?.[1] || "").trim();

    if (["opened", "reopened", "ready_for_review", "review_requested"].includes(action)) {
      counts.pending += 1;
      return;
    }

    if (["synchronize", "edited", "converted_to_draft"].includes(action)) {
      counts.inProgress += 1;
      return;
    }

    if (["closed", "merged"].includes(action)) {
      counts.completed += 1;
      return;
    }
  });

  return counts;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    totalRepos: 0,
    totalReviews: 0,
    recentCommits: 0,
    pendingReviews: 0,
    commitData: [
      { name: "Mon", commits: 0 },
      { name: "Tue", commits: 0 },
      { name: "Wed", commits: 0 },
      { name: "Thu", commits: 0 },
      { name: "Fri", commits: 0 },
      { name: "Sat", commits: 0 },
      { name: "Sun", commits: 0 },
    ],
    activities: [],
    reviewStatusData: [
      { name: "Completed", value: 0, color: "#00FF66" },
      { name: "In Progress", value: 0, color: "#FF9900" },
      { name: "Pending", value: 0, color: "#0066FF" },
      { name: "Failed", value: 0, color: "#FF3B30" },
    ],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fallbackCommitSeries = [
    { name: "Mon", commits: 0 },
    { name: "Tue", commits: 0 },
    { name: "Wed", commits: 0 },
    { name: "Thu", commits: 0 },
    { name: "Fri", commits: 0 },
    { name: "Sat", commits: 0 },
    { name: "Sun", commits: 0 },
  ];

  const fetchDashboardData = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      }

      const [reposRes, reviewsRes, activityRes] = await Promise.all([
        fetch("/api/github/repos", { cache: "no-store" }),
        fetch("/api/reviews?limit=100", { cache: "no-store" }),
        fetch("/api/github/activity", { cache: "no-store" }),
      ]);

      const reposData = await reposRes.json();
      const reviewsData = await reviewsRes.json();
      const activityData = await activityRes.json();

      const githubRepos = Array.isArray(reposData?.repos) ? reposData.repos : [];
      const reviews = reviewsData.reviews || [];
      const statusCounts = reviewsData?.statusCounts || {};
      const apiReviewStatus = activityData?.reviewStatus || {};
      let pendingReviews = Number(apiReviewStatus.pending || statusCounts.PENDING || 0);
      let inProgressReviews = Number(apiReviewStatus.inProgress || statusCounts.IN_PROGRESS || 0);
      let completedReviews = Number(apiReviewStatus.completed || statusCounts.COMPLETED || 0);
      let failedReviews = Number(apiReviewStatus.failed || statusCounts.FAILED || 0);

      // Fallback: when DB-backed review counts are empty, derive from real GitHub PR activity.
      if (pendingReviews + inProgressReviews + completedReviews + failedReviews === 0) {
        const activityDerived = deriveReviewStatusFromActivities(activityData?.activities);
        pendingReviews = activityDerived.pending;
        inProgressReviews = activityDerived.inProgress;
        completedReviews = activityDerived.completed;
        failedReviews = activityDerived.failed;
      }

      const derivedTotalReviews = pendingReviews + inProgressReviews + completedReviews + failedReviews;
      const commitData = Array.isArray(activityData?.commitSeries)
        ? activityData.commitSeries
        : fallbackCommitSeries;

      setData({
        totalRepos: githubRepos.length,
        totalReviews: Number.isFinite(reviewsData?.pagination?.total) && reviewsData.pagination.total > 0
          ? reviewsData.pagination.total
          : derivedTotalReviews > 0
          ? derivedTotalReviews
          : reviews.length,
        recentCommits: activityData?.commitsThisWeek || 0,
        pendingReviews,
        commitData,
        activities: Array.isArray(activityData?.activities) ? activityData.activities : [],
        reviewStatusData: [
          { name: "Completed", value: completedReviews, color: "#00FF66" },
          { name: "In Progress", value: inProgressReviews, color: "#FF9900" },
          { name: "Pending", value: pendingReviews, color: "#0066FF" },
          { name: "Failed", value: failedReviews, color: "#FF3B30" },
        ],
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const onFocus = () => {
      fetchDashboardData(true);
    };

    const interval = window.setInterval(() => {
      fetchDashboardData(true);
    }, 15000);

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here&apos;s your overview.</p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Now
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/repositories">
              <GitBranch className="mr-2 h-4 w-4" />
              Add Repository
            </Link>
          </Button>
          <Button variant="primary" asChild>
            <Link href="/ide/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      <DashboardStats
        totalRepos={data.totalRepos}
        totalReviews={data.totalReviews}
        recentCommits={data.recentCommits}
        pendingReviews={data.pendingReviews}
      />

      {data.totalRepos === 0 && (
        <Card className="border-2 border-black bg-warning/10">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Connect your GitHub repository first, then create a new project to start coding in the IDE.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/dashboard/repositories">Connect Repository</Link>
              </Button>
              <Button variant="primary" asChild>
                <Link href="/ide/new">Create Project</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <CommitChart data={data.commitData} />
        <ReviewStatusChart data={data.reviewStatusData} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity activities={data.activities} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/ide/new">
                <Plus className="mr-2 h-4 w-4" />
                Create New Project
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
            <Link href="/dashboard/repositories">
                <GitBranch className="mr-2 h-4 w-4" />
                Connect Repository
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/dashboard/reviews">
                <ArrowRight className="mr-2 h-4 w-4" />
                View All Reviews
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}