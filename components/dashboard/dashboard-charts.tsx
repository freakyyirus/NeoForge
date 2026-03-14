"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardStatsProps {
  totalRepos: number;
  totalReviews: number;
  recentCommits: number;
  pendingReviews: number;
}

interface CommitPoint {
  name: string;
  commits: number;
}

interface ActivityItem {
  id: string;
  type: "review" | "commit" | "repo";
  message: string;
  time: string;
  status: "success" | "warning" | "default";
}

const defaultCommitData: CommitPoint[] = [
  { name: "Mon", commits: 12 },
  { name: "Tue", commits: 19 },
  { name: "Wed", commits: 8 },
  { name: "Thu", commits: 15 },
  { name: "Fri", commits: 22 },
  { name: "Sat", commits: 5 },
  { name: "Sun", commits: 3 },
];

const reviewData = [
  { name: "Completed", value: 45, color: "#00FF66" },
  { name: "In Progress", value: 15, color: "#FF9900" },
  { name: "Pending", value: 10, color: "#0066FF" },
];

type ReviewSlice = {
  name: string;
  value: number;
  color: string;
};

const languageData = [
  { name: "TypeScript", value: 35, color: "#0066FF" },
  { name: "Python", value: 25, color: "#00FF66" },
  { name: "JavaScript", value: 20, color: "#FFE600" },
  { name: "Rust", value: 10, color: "#FF00FF" },
  { name: "Other", value: 10, color: "#666666" },
];

export function DashboardStats({
  totalRepos,
  totalReviews,
  recentCommits,
  pendingReviews,
}: DashboardStatsProps) {
  const stats = [
    { label: "Repositories", value: totalRepos, color: "bg-primary" },
    { label: "Total Reviews", value: totalReviews, color: "bg-secondary" },
    { label: "Commits (Week)", value: recentCommits, color: "bg-accent" },
    { label: "Pending Reviews", value: pendingReviews, color: "bg-warning" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className={`absolute right-0 top-0 h-24 w-24 ${stat.color} opacity-20`} />
            <div className="text-4xl font-bold">{stat.value}</div>
            <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CommitChart({ data = defaultCommitData }: { data?: CommitPoint[] }) {
  const hasCommitData = data.some((point) => point.commits > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commits This Week</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#000" />
              <XAxis dataKey="name" stroke="#000" tick={{ fill: "#000", fontWeight: "bold" }} />
              <YAxis stroke="#000" tick={{ fill: "#000", fontWeight: "bold" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFF",
                  border: "4px solid #000",
                  borderRadius: "0",
                  boxShadow: "4px 4px 0px 0px #000",
                }}
              />
              <Bar dataKey="commits" fill="#0066FF" stroke="#000" strokeWidth={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!hasCommitData && (
          <p className="mt-3 text-sm text-muted-foreground">
            No commits found in the last 7 days.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ReviewStatusChart({ data = reviewData }: { data?: ReviewSlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Status</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No reviews yet. Connect a repository and trigger a PR review.
            </p>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#000" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFF",
                    border: "4px solid #000",
                    borderRadius: "0",
                    boxShadow: "4px 4px 0px 0px #000",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-4 flex justify-center gap-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded-sm border-2 border-black"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function LanguageDistribution() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Language Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={languageData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent = 0 }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {languageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} stroke="#000" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFF",
                  border: "4px solid #000",
                  borderRadius: "0",
                  boxShadow: "4px 4px 0px 0px #000",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentActivity({ activities = [] }: { activities?: ActivityItem[] }) {
  const items = activities;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recent GitHub activity yet.
          </p>
        ) : (
        <div className="space-y-4">
          {items.map((activity, index) => (
            <div key={index} className="flex items-start gap-3 border-b-2 border-black/10 pb-3 last:border-0">
              <div
                className={`mt-1 h-2 w-2 shrink-0 rounded-full border-2 border-black ${
                  activity.status === "success"
                    ? "bg-success"
                    : activity.status === "warning"
                    ? "bg-warning"
                    : "bg-secondary"
                }`}
              />
              <div className="flex-1">
                <p className="font-medium">{activity.message}</p>
                <p className="text-sm text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
