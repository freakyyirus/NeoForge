"use client";

import React from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { Loader2, ScanLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProjectStatus = "processing" | "ready" | "booting" | "error";

interface DependencyGraphNode {
  id: string;
  label: string;
  type: string;
}

interface DependencyGraphEdge {
  source: string;
  target: string;
  type: string;
}

interface DependencyGraphPayload {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
}

interface ProjectStatusQueryResult {
  id: string;
  name: string;
  status: ProjectStatus;
  dependencyGraph: DependencyGraphPayload | null;
}

interface ProjectDashboardProps {
  projectId: string;
}

const getProjectDashboardRef = makeFunctionReference<"query">("projects:getProjectDashboard");

function DependencyGraph({ graph }: { graph: DependencyGraphPayload | null }) {
  if (!graph || graph.nodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dependency Graph</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No dependency graph generated yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>DependencyGraph</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Nodes</p>
          <ul className="space-y-2">
            {graph.nodes.map((node) => (
              <li key={node.id} className="rounded-md border p-2 text-sm">
                <span className="font-semibold">{node.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">({node.type})</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Edges</p>
          <ul className="space-y-2">
            {graph.edges.map((edge, index) => (
              <li key={`${edge.source}-${edge.target}-${index}`} className="rounded-md border p-2 text-sm">
                {edge.source} -&gt; {edge.target}
                <span className="ml-2 text-xs text-muted-foreground">({edge.type})</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectDashboard({ projectId }: ProjectDashboardProps) {
  const project = useQuery(
    getProjectDashboardRef,
    { projectId }
  ) as ProjectStatusQueryResult | undefined;

  if (project === undefined) {
    return (
      <Card>
        <CardContent className="flex min-h-[220px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (project.status === "processing") {
    return (
      <Card className="border-2 border-black">
        <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="h-24 w-24 animate-pulse rounded-full border-4 border-primary/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <ScanLine className="h-8 w-8 animate-pulse text-primary" />
            </div>
          </div>
          <p className="text-sm font-medium">Analyzing cross-language dependencies...</p>
        </CardContent>
      </Card>
    );
  }

  return <DependencyGraph graph={project.dependencyGraph} />;
}
