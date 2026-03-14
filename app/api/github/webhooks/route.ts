import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repositories = await prisma.repository.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        owner: true,
        name: true,
        webhookId: true,
        webhookSecret: true,
        lastIndexedAt: true,
      },
    });

    return NextResponse.json({ repositories });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { repositoryId, action } = body;

    if (!repositoryId || !action) {
      return NextResponse.json({ error: "Repository ID and action are required" }, { status: 400 });
    }

    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, userId: user.id },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    if (action === "create") {
      const webhookSecret = Math.random().toString(36).substring(2, 15);
      
      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          webhookId: `wh_${Date.now()}`,
          webhookSecret,
        },
      });

      return NextResponse.json({ 
        success: true, 
        webhookUrl: `/api/github/webhook`,
        webhookSecret,
      });
    }

    if (action === "delete") {
      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          webhookId: null,
          webhookSecret: null,
        },
      });

      return NextResponse.json({ success: true, message: "Webhook removed" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error managing webhook:", error);
    return NextResponse.json({ error: "Failed to manage webhook" }, { status: 500 });
  }
}
