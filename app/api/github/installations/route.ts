import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserOctokit } from "@/lib/github";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const octokit = await getUserOctokit(user.id);

    const response = await octokit.apps.listInstallationsForAuthenticatedUser();
    const installations = response.data.installations || [];

    return NextResponse.json({
      installations: installations.map((install) => ({
        id: install.id,
        account: install.account,
        repositorySelection: install.repository_selection,
        createdAt: install.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching installations:", error);
    if (error instanceof Error && error.message === "GitHub access token not found") {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to fetch installations" }, { status: 500 });
  }
}
