"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, FileCode, CheckCircle, Clock, Loader2, RefreshCw } from "lucide-react";

interface Review {
  id: string;
  prNumber: number;
  prTitle: string;
  prState: string;
  status: string;
  reviewType: string;
  repository: string;
  createdAt: string;
}

interface ConnectedRepo {
  id: string;
  fullName: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      const [reviewsRes, reposRes] = await Promise.all([
        fetch("/api/reviews?limit=100", { cache: "no-store" }),
        fetch("/api/github/repos", { cache: "no-store" }),
      ]);

      const reviewsData = await reviewsRes.json();
      const reposData = await reposRes.json();

      setReviews(Array.isArray(reviewsData?.reviews) ? reviewsData.reviews : []);

      const repos = Array.isArray(reposData?.repos) ? reposData.repos : [];
      const connected = repos
        .filter((r: any) => r.connected && r.connectedRepositoryId)
        .map((r: any) => ({
          id: String(r.connectedRepositoryId),
          fullName: r.fullName,
        }));
      setConnectedRepos(connected);
      if (!selectedRepoId && connected.length > 0) {
        setSelectedRepoId(connected[0].id);
      }
    } catch {
      setError("Failed to load reviews.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerReview = async () => {
    const pr = Number.parseInt(prNumber, 10);
    if (!selectedRepoId || !Number.isFinite(pr) || pr <= 0) {
      setError("Select a repository and enter a valid PR number.");
      return;
    }

    setTriggering(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId: selectedRepoId,
          prNumber: pr,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to trigger review.");
        return;
      }

      setMessage("Review triggered. It will appear once processing starts.");
      setPrNumber("");
      await loadData(true);
    } catch {
      setError("Network error while triggering review.");
    } finally {
      setTriggering(false);
    }
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = review.prTitle?.toLowerCase().includes(search.toLowerCase()) ||
      review.repository.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || 
      (filter === "completed" && review.status === "COMPLETED") ||
      (filter === "in_progress" && review.status === "IN_PROGRESS") ||
      (filter === "pending" && review.status === "PENDING");
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">View and manage your AI code reviews.</p>
        </div>
        <Button variant="outline" onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">Trigger New Review</p>
          {connectedRepos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No connected repositories found. Connect one first in the Repositories tab.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
              <select
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {connectedRepos.map((repo) => (
                  <option key={repo.id} value={repo.id}>{repo.fullName}</option>
                ))}
              </select>
              <Input
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
                placeholder="PR Number"
              />
              <Button onClick={triggerReview} disabled={triggering}>
                {triggering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Trigger
              </Button>
            </div>
          )}
          {message && <p className="text-sm text-green-700">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all" onClick={() => setFilter("all")}>All Reviews</TabsTrigger>
            <TabsTrigger value="completed" onClick={() => setFilter("completed")}>Completed</TabsTrigger>
            <TabsTrigger value="in_progress" onClick={() => setFilter("in_progress")}>In Progress</TabsTrigger>
            <TabsTrigger value="pending" onClick={() => setFilter("pending")}>Pending</TabsTrigger>
          </TabsList>
          
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search reviews..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10" 
            />
          </div>
        </div>

        <TabsContent value={filter} className="mt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredReviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileCode className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">No reviews found</p>
                <p className="text-muted-foreground">Connect a repository to start getting AI reviews.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredReviews.map((review) => (
                <Card key={review.id} className="transition-all hover:shadow-[4px_4px_0px_0px_#000]">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-black bg-primary">
                          <FileCode className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold">{review.prTitle || `PR #${review.prNumber}`}</h3>
                            <Badge
                              variant={
                                review.status === "COMPLETED"
                                  ? "success"
                                  : review.status === "IN_PROGRESS"
                                  ? "warning"
                                  : "secondary"
                              }
                            >
                              {review.status === "COMPLETED" ? (
                                <CheckCircle className="mr-1 h-3 w-3" />
                              ) : review.status === "IN_PROGRESS" ? (
                                <Clock className="mr-1 h-3 w-3" />
                              ) : null}
                              {review.status.toLowerCase().replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            #{review.prNumber} • {review.repository} • {new Date(review.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/reviews/${review.id}`}>
                        <FileCode className="mr-2 h-4 w-4" />
                        View Review
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
