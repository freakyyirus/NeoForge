import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { chatWithAI, generateCodeEdit } from "@/lib/ai";
import { queryCodebase } from "@/lib/pinecone";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      message, 
      type = "chat",
      model = "gemini",
      code,
      instruction,
      repositoryId,
      filePath,
      apiKey,
      providerModel,
    } = body;

    let context: string[] = [];

    if (repositoryId) {
      const searchResults = await queryCodebase(repositoryId, message, 5);
      context = searchResults.map((r: { filePath: string; content: string }) => `${r.filePath}:\n${r.content}`);
    }

    let response: string;

    if (type === "edit" && code && instruction) {
      response = await generateCodeEdit(code, instruction, model, apiKey, providerModel);
    } else if (type === "chat") {
      const history = body.history || [];
      response = await chatWithAI(
        [...history, { role: "user" as const, content: message }],
        context,
        model,
        apiKey,
        providerModel
      );
    } else {
      return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error in AI chat:", error);
    const message = error instanceof Error ? error.message : "Failed to process request";
    const status = /missing|unauthorized|invalid|api key|authentication/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
