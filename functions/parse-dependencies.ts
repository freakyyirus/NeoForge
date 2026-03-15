import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";

interface ParseDependenciesEvent {
  name: "project/parse.dependencies";
  data: {
    projectId: string;
    repoUrl: string;
  };
}

interface GraphNode {
  id: string;
  label: string;
  type: "frontend" | "service" | "database";
}

interface GraphEdge {
  source: string;
  target: string;
  type: "calls" | "queries";
}

interface DependencyGraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const parseDependencies = inngest.createFunction(
  {
    id: "project-parse-dependencies",
    name: "Project Parse Dependencies",
  },
  {
    event: "project/parse.dependencies",
  },
  async ({ event, step }) => {
    const parseEvent = event as ParseDependenciesEvent;
    const { projectId, repoUrl } = parseEvent.data;

    const files = await step.run("fetch-files", async () => {
      // Placeholder for real GitHub/WebContainer clone step.
      return {
        projectId,
        repoUrl,
        files: ["src/app/page.tsx", "services/auth.ts", "prisma/schema.prisma"],
      };
    });

    const graph = await step.run("extract-ast-graph", async (): Promise<DependencyGraphPayload> => {
      // Placeholder deterministic graph while AST extractors are integrated.
      return {
        nodes: [
          { id: "frontend", label: "Frontend", type: "frontend" },
          { id: "auth-service", label: "Auth Service", type: "service" },
          { id: "database", label: "DB", type: "database" },
        ],
        edges: [
          { source: "frontend", target: "auth-service", type: "calls" },
          { source: "auth-service", target: "database", type: "queries" },
        ],
      };
    });

    await step.run("save-graph", async () => {
      await (prisma as any).dependencyGraph.create({
        data: {
          projectId,
          nodes: graph.nodes,
          edges: graph.edges,
          meta: {
            source: "mock",
            fetchedFiles: files.files,
          },
        },
      });
    });

    await step.run("mark-project-ready", async () => {
      await (prisma as any).project.update({
        where: { id: projectId },
        data: {
          status: "ready",
        },
      });
    });

    return {
      success: true,
      projectId,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    };
  }
);
