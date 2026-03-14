"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GitBranch, Plus, Search, Trash2, RefreshCw, Loader2 } from "lucide-react";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  language: string;
  updatedAt: string;
  connected: boolean;
}

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [connectingRepoId, setConnectingRepoId] = useState<string | null>(null);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/repos")
      .then(res => res.json())
      .then(data => {
        if (data.repos) setRepos(data.repos);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleConnect = async (repo: Repository) => {
    setConnectingRepoId(String(repo.id));
    setConnectMessage(null);
    setConnectError(null);

    try {
      const res = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: String(repo.id),
          owner: repo.fullName.split("/")[0],
          name: repo.name,
        }),
      });
      const data = await res.json();
      
      if (res.ok || data?.error === "Repository already connected") {
        setRepos((prev) => prev.map((r) =>
          String(r.id) === String(repo.id) ? { ...r, connected: true } : r
        ));
        setConnectMessage(`${repo.fullName} connected successfully.`);
      } else {
        setConnectError(data?.error || "Failed to connect repository.");
      }
    } catch (error) {
      console.error("Failed to connect repo:", error);
      setConnectError("Network error while connecting repository.");
    } finally {
      setConnectingRepoId(null);
    }
  };

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(search.toLowerCase()) ||
    repo.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Repositories</h1>
          <p className="text-muted-foreground">Connect your GitHub repositories.</p>
        </div>
        <Button variant="primary" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search repositories..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10" 
          />
        </div>
      </div>

      {connectMessage && (
        <p className="text-sm text-green-700">{connectMessage}</p>
      )}
      {connectError && (
        <p className="text-sm text-red-600">{connectError}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredRepos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitBranch className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No repositories found</p>
            <p className="text-muted-foreground">Connect your GitHub account to see your repos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRepos.map((repo) => (
            <Card key={repo.id} className="transition-all hover:shadow-[4px_4px_0px_0px_#000]">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-black bg-muted">
                    <GitBranch className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{repo.fullName}</h3>
                      <Badge variant={repo.connected ? "success" : "secondary"}>
                        {repo.connected ? "Connected" : "Not Connected"}
                      </Badge>
                      {repo.private && <Badge variant="default">Private</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {repo.description || "No description"}
                    </p>
                    {repo.language && (
                      <p className="text-xs text-muted-foreground">Language: {repo.language}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!repo.connected && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleConnect(repo)}
                      disabled={connectingRepoId === String(repo.id)}
                    >
                      {connectingRepoId === String(repo.id) ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-1 h-4 w-4" />
                      )}
                      {connectingRepoId === String(repo.id) ? "Connecting..." : "Connect"}
                    </Button>
                  )}
                  {repo.connected && (
                    <>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="mr-1 h-4 w-4" />
                        Re-index
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
