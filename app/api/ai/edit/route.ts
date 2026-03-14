import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { generateCodeEdit } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code, instruction, model = "gemini", apiKey, providerModel } = body;

    if (!code || !instruction) {
      return NextResponse.json({ error: "Code and instruction are required" }, { status: 400 });
    }

    const completion = await generateCodeEdit(code, instruction, model, apiKey, providerModel);

    return NextResponse.json({ completion });
  } catch (error) {
    console.error("Error generating code edit:", error);
    const message = error instanceof Error ? error.message : "Failed to generate code edit";
    const status = /missing|unauthorized|invalid|api key|authentication/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
