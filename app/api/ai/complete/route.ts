import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { generateCodeCompletion } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code, cursorPosition, model = "gemini", apiKey, providerModel } = body;

    if (!code || cursorPosition === undefined) {
      return NextResponse.json({ error: "Code and cursor position required" }, { status: 400 });
    }

    const completion = await generateCodeCompletion(code, cursorPosition, model, apiKey, providerModel);

    return NextResponse.json({ completion });
  } catch (error) {
    console.error("Error generating completion:", error);
    const message = error instanceof Error ? error.message : "Failed to generate completion";
    const status = /missing|unauthorized|invalid|api key|authentication/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
