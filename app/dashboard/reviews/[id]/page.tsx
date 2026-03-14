"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft } from "lucide-react";

type ReviewDetail = {
  id: string;
  prNumber: number;
  prTitle?: string;
  repository: string;
  status: string;
  summary?: string;
  walkthrough?: string;
  strengths?: string[] | string;
  issues?: Array<{ severity: string; message: string; line?: number }> | string;
  suggestions?: Array<{ file: string; suggestion: string; code?: string }> | string;
  createdAt: string;
};

function parseMaybeJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/reviews/${params.id}`, { cache: "no-store" });
        if (!res.ok) {
          setReview(null);
          return;
        }
        const data = await res.json();
        setReview(data);
      } catch {
        setReview(null);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      load();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/dashboard/reviews">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reviews
          </Link>
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Review not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const strengths = parseMaybeJson<string[]>(review.strengths, []);
  const issues = parseMaybeJson<Array<{ severity: string; message: string; line?: number }>>(review.issues, []);
  const suggestions = parseMaybeJson<Array<{ file: string; suggestion: string; code?: string }>>(review.suggestions, []);

  return (
    <div className="space-y-6">
      <Button variant="outline" asChild>
        <Link href="/dashboard/reviews">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reviews
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{review.prTitle || `PR #${review.prNumber}`}</CardTitle>
          <p className="text-sm text-muted-foreground">{review.repository}</p>
          <div>
            <Badge variant="secondary">{review.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-bold">Summary</h3>
            <p className="text-sm text-muted-foreground">{review.summary || "No summary available."}</p>
          </div>

          <div>
            <h3 className="font-bold">Walkthrough</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{review.walkthrough || "No walkthrough available."}</p>
          </div>

          <div>
            <h3 className="font-bold">Strengths</h3>
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">No strengths listed.</p>
            ) : (
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {strengths.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-bold">Issues</h3>
            {issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issues found.</p>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {issues.map((item, idx) => (
                  <li key={idx}>
                    <strong>[{item.severity.toUpperCase()}]</strong> {item.message}
                    {item.line ? ` (line ${item.line})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-bold">Suggestions</h3>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suggestions available.</p>
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                {suggestions.map((item, idx) => (
                  <div key={idx} className="rounded border border-black/20 p-3">
                    <p><strong>{item.file}</strong>: {item.suggestion}</p>
                    {item.code && <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{item.code}</pre>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
