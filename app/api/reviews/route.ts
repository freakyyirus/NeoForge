import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repositoryId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const where: any = { userId: user.id };
    if (repositoryId) {
      where.repositoryId = repositoryId;
    }

    const [reviews, total, statusCountsRaw] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          repository: {
            select: { owner: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
      prisma.review.groupBy({
        by: ["status"],
        where,
        _count: {
          _all: true,
        },
      }),
    ]);

    const statusCounts = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      FAILED: 0,
    };

    for (const item of statusCountsRaw) {
      const key = item.status as keyof typeof statusCounts;
      if (key in statusCounts) {
        statusCounts[key] = item._count._all;
      }
    }

    return NextResponse.json({
      reviews: reviews.map(r => ({
        id: r.id,
        prNumber: r.prNumber,
        prTitle: r.prTitle,
        prState: r.prState,
        status: r.status,
        reviewType: r.reviewType,
        repository: `${r.repository.owner}/${r.repository.name}`,
        createdAt: r.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      statusCounts,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { repositoryId, prNumber } = body;

    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        userId: user.id,
      },
      include: { user: true },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const userRepo = await prisma.user.findUnique({
      where: { id: user.id },
      include: { subscription: true },
    });

    if (userRepo?.subscription?.tier === "FREE") {
      const reviewCount = await prisma.review.count({
        where: { 
          repositoryId,
          reviewType: "AUTOMATIC",
        },
      });

      if (reviewCount >= 5) {
        return NextResponse.json({ 
          error: "Free tier limit reached. Upgrade to Pro for unlimited reviews." 
        }, { status: 403 });
      }
    }

    const existingReview = await prisma.review.findFirst({
      where: { repositoryId, prNumber },
    });

    if (existingReview) {
      return NextResponse.json({ error: "Review already exists for this PR" }, { status: 400 });
    }

    await inngest.send({
      name: "github.pr.opened",
      data: {
        repositoryId: repository.id,
        prNumber,
        installationId: 0,
      },
    });

    return NextResponse.json({ success: true, message: "Review triggered successfully" });
  } catch (error) {
    console.error("Error triggering review:", error);
    return NextResponse.json({ error: "Failed to trigger review" }, { status: 500 });
  }
}
