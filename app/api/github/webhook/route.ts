import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);
    
    if (event === "pull_request") {
      const action = payload.action;
      const pr = payload.pull_request;
      const repo = payload.repository;

      if (action === "opened" || action === "synchronize") {
        const repository = await prisma.repository.findFirst({
          where: {
            owner: repo.owner.login,
            name: repo.name,
          },
        });

        if (repository) {
          await inngest.send({
            name: "github.pr.opened",
            data: {
              repositoryId: repository.id,
              prNumber: pr.number,
              installationId: payload.installation?.id || 0,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
