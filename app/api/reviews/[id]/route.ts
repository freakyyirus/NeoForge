import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const review = await prisma.review.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        repository: {
          select: {
            owner: true,
            name: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: review.id,
      prNumber: review.prNumber,
      prTitle: review.prTitle,
      prBody: review.prBody,
      prState: review.prState,
      reviewType: review.reviewType,
      status: review.status,
      diff: review.diff,
      walkthrough: review.walkthrough,
      sequenceDiagrams: review.sequenceDiagrams,
      summary: review.summary,
      strengths: review.strengths,
      issues: review.issues,
      suggestions: review.suggestions,
      repository: `${review.repository.owner}/${review.repository.name}`,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching review:", error);
    return NextResponse.json({ error: "Failed to fetch review" }, { status: 500 });
  }
}
