import { NextRequest, NextResponse } from "next/server";
import { WebContainer } from "@webcontainer/api";

const webcontainerInstance: { instance: WebContainer | null } = { instance: null };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    if (!webcontainerInstance.instance) {
      webcontainerInstance.instance = await WebContainer.boot();
    }

    return NextResponse.json({ 
      success: true, 
      ready: true,
    });
  } catch (error) {
    console.error("Error starting WebContainer:", error);
    return NextResponse.json({ error: "Failed to start WebContainer" }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({ 
      ready: !!webcontainerInstance.instance,
    });
  } catch (error) {
    console.error("Error checking WebContainer status:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
