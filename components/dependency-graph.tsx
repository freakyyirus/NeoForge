"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";

type NodeColor = "green" | "blue" | "yellow" | "white" | "red";

export interface PolyglotNode {
  id: string;
  label: string;
  lang: "POSTGRESQL" | "GO" | "PYTHON" | "TYPESCRIPT" | string;
  color: NodeColor;
}

export interface PolyglotEdge {
  from: string;
  to: string;
}

export interface PolyglotDependencyGraphProps {
  className?: string;
  title?: string;
  sourceNodeId?: string;
  nodes?: PolyglotNode[];
  edges?: PolyglotEdge[];
}

const DEFAULT_NODES: PolyglotNode[] = [
  { id: "user-db", label: "User DB", lang: "POSTGRESQL", color: "green" },
  { id: "auth", label: "Auth Service", lang: "GO", color: "blue" },
  { id: "checkout", label: "Checkout API", lang: "PYTHON", color: "yellow" },
  { id: "frontend", label: "Frontend Dashboard", lang: "TYPESCRIPT", color: "white" },
  { id: "tx-db", label: "Transactions DB", lang: "POSTGRESQL", color: "red" },
];

const DEFAULT_EDGES: PolyglotEdge[] = [
  { from: "frontend", to: "auth" },
  { from: "frontend", to: "checkout" },
  { from: "auth", to: "user-db" },
  { from: "checkout", to: "auth" },
  { from: "checkout", to: "tx-db" },
];

type NodePosition = { x: number; y: number };

const NODE_POSITIONS: Record<string, NodePosition> = {
  frontend: { x: 50, y: 16 },
  auth: { x: 34, y: 48 },
  checkout: { x: 66, y: 48 },
  "user-db": { x: 28, y: 80 },
  "tx-db": { x: 72, y: 80 },
};

const colorClasses: Record<NodeColor, string> = {
  green: "border-emerald-400/80 bg-emerald-500/10 text-emerald-200 shadow-emerald-500/30",
  blue: "border-sky-400/80 bg-sky-500/10 text-sky-200 shadow-sky-500/30",
  yellow: "border-amber-300/80 bg-amber-400/10 text-amber-100 shadow-amber-400/30",
  white: "border-zinc-100/80 bg-zinc-100/10 text-zinc-100 shadow-zinc-200/30",
  red: "border-rose-400/80 bg-rose-500/10 text-rose-200 shadow-rose-500/30",
};

function edgeKey(edge: PolyglotEdge): string {
  return `${edge.from}->${edge.to}`;
}

export default function DependencyGraph({
  className,
  title = "Polyglot Dependency Impact",
  sourceNodeId = "user-db",
  nodes = DEFAULT_NODES,
  edges = DEFAULT_EDGES,
}: PolyglotDependencyGraphProps) {
  const [affectedNodes, setAffectedNodes] = useState<Set<string>>(new Set());
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const timersRef = useRef<number[]>([]);

  const clearAnimationTimers = useCallback(() => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
  }, []);

  const resetGraph = useCallback(() => {
    clearAnimationTimers();
    setIsRunning(false);
    setAffectedNodes(new Set());
    setActiveEdges(new Set());
  }, [clearAnimationTimers]);

  const runBlastRadius = useCallback(() => {
    if (isRunning) return;

    resetGraph();
    setIsRunning(true);

    // Step 1: Source schema node pulses/activates.
    setAffectedNodes(new Set([sourceNodeId]));

    // Step 2: Dependency edge + Auth service become affected.
    timersRef.current.push(
      window.setTimeout(() => {
        setAffectedNodes(new Set([sourceNodeId, "auth"]));
        setActiveEdges(new Set(["auth->user-db"]));
      }, 850)
    );

    // Step 3: Upstream services become affected.
    timersRef.current.push(
      window.setTimeout(() => {
        setAffectedNodes(new Set([sourceNodeId, "auth", "frontend", "checkout"]));
        setActiveEdges(new Set(["auth->user-db", "frontend->auth", "checkout->auth"]));
        setIsRunning(false);
      }, 1700)
    );
  }, [isRunning, resetGraph, sourceNodeId]);

  const affectedCount = affectedNodes.size;
  const totalServices = nodes.length;

  const computedNodes = useMemo(
    () => nodes.map((node) => ({ ...node, position: NODE_POSITIONS[node.id] })),
    [nodes]
  );

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-white/10 bg-[#070b14] p-5 text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_24px_60px_rgba(0,0,0,0.45),0_0_80px_rgba(59,130,246,0.15)]",
        className || "",
      ].join(" ")}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-wide">{title}</h2>
          <p className="mt-1 text-xs text-zinc-400">Blast radius simulation for a schema-breaking data-layer change.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200">
            Schema Breaking Change
          </span>
          <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            AFFECTED {affectedCount}/{totalServices} Services
          </span>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={runBlastRadius}
          disabled={isRunning}
          className="rounded-md border border-indigo-300/40 bg-indigo-500/20 px-3 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Simulate Schema Change
        </button>
        <button
          type="button"
          onClick={resetGraph}
          className="rounded-md border border-zinc-400/30 bg-zinc-700/20 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-600/30"
        >
          Reset Graph
        </button>
      </div>

      <div className="relative h-[420px] w-full rounded-xl border border-white/10 bg-black/20">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="arrow-neutral" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L8,4 L0,8 z" fill="#71717a" />
            </marker>
            <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L8,4 L0,8 z" fill="#fb7185" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const from = NODE_POSITIONS[edge.from];
            const to = NODE_POSITIONS[edge.to];
            if (!from || !to) return null;
            const isActive = activeEdges.has(edgeKey(edge));

            return (
              <line
                key={edgeKey(edge)}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isActive ? "#fb7185" : "#52525b"}
                strokeWidth={isActive ? 0.8 : 0.55}
                markerEnd={isActive ? "url(#arrow-active)" : "url(#arrow-neutral)"}
                className={isActive ? "animate-pulse" : ""}
              />
            );
          })}
        </svg>

        {computedNodes.map((node) => {
          const isAffected = affectedNodes.has(node.id);
          const isSource = node.id === sourceNodeId;
          const fallbackPosition = { x: 50, y: 50 };
          const position = node.position || fallbackPosition;

          return (
            <div
              key={node.id}
              className={[
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2 text-center shadow-lg backdrop-blur-sm transition",
                isAffected
                  ? "border-rose-400 bg-rose-500/20 text-rose-100 shadow-rose-500/50"
                  : colorClasses[node.color],
                isSource && isAffected ? "animate-pulse" : "",
              ].join(" ")}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-300">{node.lang}</div>
              <div className="text-sm font-semibold">{node.label}</div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Future integration: this graph can be generated dynamically from GitHub repository analysis (services, API calls, and schema references).
      </p>
    </div>
  );
}
