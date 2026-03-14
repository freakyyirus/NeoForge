"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, GitBranch, ArrowRight, FolderPlus } from "lucide-react";

type Repo = {
  id: string;
  fullName: string;
  connected: boolean;
};

function toProjectId(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";

  return `${base}-${Date.now().toString(36)}`;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const loadRepos = async () => {
      try {
        const res = await fetch("/api/github/repos", { cache: "no-store" });
        const data = await res.json();
        const list = Array.isArray(data?.repos) ? data.repos : [];
        setRepos(
          list.map((repo: any) => ({
            id: String(repo.id),
            fullName: repo.fullName,
            connected: !!repo.connected,
          }))
        );
      } catch (error) {
        console.error("Failed to load repositories:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRepos();
  }, []);

  const connectedRepos = useMemo(() => repos.filter((repo) => repo.connected), [repos]);

  const createProject = async () => {
    if (!name.trim()) return;

    setCreating(true);
    const projectId = toProjectId(name);
    const query = new URLSearchParams();
    query.set("name", name.trim());
    if (selectedRepo) {
      query.set("repo", selectedRepo);
    }

    router.push(`/ide/${projectId}?${query.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Project</h1>
        <p className="text-muted-foreground">Choose a name and optionally link a connected repository.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Project Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="project-name">Project name</label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Project"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="repo-select">Connected repository (optional)</label>
            {connectedRepos.length === 0 ? (
              <div className="rounded-md border border-dashed border-black/30 bg-muted/40 p-3">
                <p className="text-sm text-muted-foreground">
                  No connected repositories yet. Connect one first to link it with this project.
                </p>
                <Button className="mt-3" variant="outline" asChild>
                  <Link href="/dashboard/repositories">
                    <GitBranch className="mr-2 h-4 w-4" />
                    Connect Repository
                  </Link>
                </Button>
              </div>
            ) : (
              <select
                id="repo-select"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
              >
                <option value="">No repository</option>
                {connectedRepos.map((repo) => (
                  <option key={repo.id} value={repo.fullName}>
                    {repo.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard">Cancel</Link>
            </Button>
            <Button onClick={createProject} disabled={!name.trim() || creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Open in IDE
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
