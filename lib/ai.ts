import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"] as const;
const OPENROUTER_MODELS = [
  process.env.OPENROUTER_MODEL || "openrouter/auto",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
] as const;

function normalizeApiKey(value?: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function resolveApiKey(inputKey: string | undefined, envKey: string) {
  const key = normalizeApiKey(inputKey) || normalizeApiKey(process.env[envKey]);
  if (!key) {
    throw new Error(`${envKey} is missing. Add it to .env.local and restart the dev server.`);
  }
  return key;
}

function getGenAI(apiKey?: string) {
  const key = resolveApiKey(apiKey, "GOOGLE_GEMINI_API_KEY");
  return new GoogleGenerativeAI(key);
}

function getAnthropic(apiKey?: string) {
  const key = resolveApiKey(apiKey, "ANTHROPIC_API_KEY");
  return new Anthropic({
    apiKey: key,
  });
}

function getOpenRouterApiKey(apiKey?: string) {
  return resolveApiKey(apiKey, "OPENROUTER_API_KEY");
}

function getOpenRouterModels(providerModel?: string) {
  const override = normalizeApiKey(providerModel);
  if (override) {
    return [override];
  }

  return [...new Set(OPENROUTER_MODELS.filter(Boolean))];
}

async function callOpenRouter(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  maxTokens = 4096,
  apiKey?: string,
  providerModel?: string
) {
  const key = getOpenRouterApiKey(apiKey);
  let lastError: unknown;

  for (const model of getOpenRouterModels(providerModel)) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
        "X-Title": "NeoForge",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      return data?.choices?.[0]?.message?.content || "";
    }

    const providerMessage =
      data?.error?.metadata?.raw ||
      data?.error?.message ||
      data?.message ||
      "OpenRouter request failed";

    lastError = new Error(String(providerMessage));

    if (!/no endpoints found|provider returned error|model.*not found|unavailable/i.test(String(providerMessage))) {
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isGeminiQuotaError(error: unknown) {
  return /quota|rate limit|429|resource_exhausted|too many requests/i.test(getErrorMessage(error));
}

function isGeminiModelAvailabilityError(error: unknown) {
  return /404|not found|unsupported for generatecontent|model.*not found/i.test(getErrorMessage(error));
}

function isAnthropicBillingError(error: unknown) {
  return /credit balance is too low|billing|insufficient|rate limit|quota/i.test(getErrorMessage(error));
}

function isOpenRouterError(error: unknown) {
  return /openrouter|provider returned error|rate limit|quota|credits|payment|required/i.test(getErrorMessage(error));
}

function toUserFacingAIError(error: unknown) {
  const message = getErrorMessage(error);

  if (isGeminiQuotaError(error)) {
    return "Gemini quota exceeded for the current API key. Add a billed Gemini key or use a custom key in AI Settings.";
  }

  if (isAnthropicBillingError(error)) {
    return "Anthropic credits are unavailable for the current API key. Add credits or use another provider/custom key in AI Settings.";
  }

  if (isOpenRouterError(error)) {
    return "OpenRouter could not find a working provider/model for this request. Use OpenRouter model 'openrouter/auto' or another available model from your OpenRouter dashboard.";
  }

  return message;
}

async function runGeminiWithFallback<T>(
  apiKey: string | undefined,
  runner: (model: any) => Promise<T>
): Promise<T> {
  const genAI = getGenAI(apiKey);
  let lastError: unknown;

  for (const modelName of GEMINI_MODELS) {
    try {
      const geminiModel = genAI.getGenerativeModel({ model: modelName });
      return await runner(geminiModel);
    } catch (error) {
      lastError = error;
      if (!isGeminiQuotaError(error) && !isGeminiModelAvailabilityError(error)) {
        throw new Error(toUserFacingAIError(error));
      }
    }
  }

  throw new Error(toUserFacingAIError(lastError));
}

export type AIModel = "gemini" | "claude" | "openrouter";

export interface AICompletionOptions {
  model: AIModel;
  prompt: string;
  context?: string[];
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  providerModel?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateCodeCompletion(
  code: string,
  cursorPosition: number,
  model: AIModel = "gemini",
  apiKey?: string,
  providerModel?: string
): Promise<string> {
  const codeBeforeCursor = code.slice(0, cursorPosition);

  if (model === "openrouter") {
    return callOpenRouter([
      {
        role: "user",
        content: `Complete the following code. Only respond with the completion, no explanations.\n\n${codeBeforeCursor}`,
      },
    ], 256, apiKey, providerModel);
  }

  if (model === "claude") {
    try {
      const anthropic = getAnthropic(apiKey);
      const result = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `Complete the following code. Only respond with the completion, no explanations.\n\n${codeBeforeCursor}`,
          },
        ],
      });
      return result.content[0].type === "text" ? result.content[0].text : "";
    } catch (error) {
      if (!isAnthropicBillingError(error)) {
        throw new Error(toUserFacingAIError(error));
      }

      try {
        return await callOpenRouter([
          {
            role: "user",
            content: `Complete the following code. Only respond with the completion, no explanations.\n\n${codeBeforeCursor}`,
          },
        ], 256, apiKey, providerModel);
      } catch (fallbackError) {
        if (!isOpenRouterError(fallbackError)) {
          throw new Error(toUserFacingAIError(fallbackError));
        }
      }
    }
  }

  try {
    return await runGeminiWithFallback(apiKey, async (geminiModel) => {
      const result = await geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Complete the following code. Only respond with the completion, no explanations.\n\n${codeBeforeCursor}`,
              },
            ],
          },
        ],
      });

      return result.response.text();
    });
  } catch (geminiError) {
    if (!isGeminiQuotaError(geminiError) && !isGeminiModelAvailabilityError(geminiError)) {
      throw new Error(toUserFacingAIError(geminiError));
    }

    return callOpenRouter([
      {
        role: "user",
        content: `Complete the following code. Only respond with the completion, no explanations.\n\n${codeBeforeCursor}`,
      },
    ], 256, apiKey, providerModel);
  }
}

export async function generateCodeEdit(
  code: string,
  instruction: string,
  model: AIModel = "gemini",
  apiKey?: string,
  providerModel?: string
): Promise<string> {
  if (model === "openrouter") {
    return callOpenRouter([
      {
        role: "user",
        content: `Given the following code, ${instruction}. Return only the modified code, no explanations.\n\n\`\`\`\n${code}\n\`\`\``,
      },
    ], 4096, apiKey, providerModel);
  }

  if (model === "claude") {
    try {
      const anthropic = getAnthropic(apiKey);
      const result = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Given the following code, ${instruction}. Return only the modified code, no explanations.\n\n\`\`\`\n${code}\n\`\`\``,
          },
        ],
      });
      return result.content[0].type === "text" ? result.content[0].text : "";
    } catch (error) {
      if (!isAnthropicBillingError(error)) {
        throw new Error(toUserFacingAIError(error));
      }

      try {
        return await callOpenRouter([
          {
            role: "user",
            content: `Given the following code, ${instruction}. Return only the modified code, no explanations.\n\n\`\`\`\n${code}\n\`\`\``,
          },
        ], 4096, apiKey, providerModel);
      } catch (fallbackError) {
        if (!isOpenRouterError(fallbackError)) {
          throw new Error(toUserFacingAIError(fallbackError));
        }
      }
    }
  }

  try {
    return await runGeminiWithFallback(apiKey, async (geminiModel) => {
      const result = await geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Given the following code, ${instruction}. Return only the modified code, no explanations.\n\n\`\`\`\n${code}\n\`\`\``,
              },
            ],
          },
        ],
      });

      return result.response.text();
    });
  } catch (geminiError) {
    if (!isGeminiQuotaError(geminiError) && !isGeminiModelAvailabilityError(geminiError)) {
      throw new Error(toUserFacingAIError(geminiError));
    }

    return callOpenRouter([
      {
        role: "user",
        content: `Given the following code, ${instruction}. Return only the modified code, no explanations.\n\n\`\`\`\n${code}\n\`\`\``,
      },
    ], 4096, apiKey, providerModel);
  }
}

export async function chatWithAI(
  messages: ChatMessage[],
  context: string[] = [],
  model: AIModel = "gemini",
  apiKey?: string,
  providerModel?: string
): Promise<string> {
  const CHAT_MAX_TOKENS = 1800;
  const outputGuidance =
    "When returning code edits for one file, use a fenced code block. " +
    "For workspace changes with folders and multiple files, prefer this JSON block format: ```json {\"folders\":[\"/src/components\"],\"files\":[{\"path\":\"/src/components/Button.tsx\",\"content\":\"...full file content...\"}]} ```. " +
    "As a fallback, for multi-file edits use: `### File: /path/to/file.ext` then a fenced code block with full file content. " +
    "If the user asks to create or edit multiple files/folders, return ONLY the JSON block and no prose. " +
    "Keep responses concise and avoid long explanations unless the user explicitly asks for explanation.";

  const systemPrompt = context.length > 0
    ? `You are an expert code assistant. ${outputGuidance} The user is working on a codebase. Here is some relevant context from the codebase:\n\n${context.join("\n\n")}`
    : `You are an expert code assistant. ${outputGuidance}`;

  if (model === "openrouter") {
    return callOpenRouter([
      { role: "system", content: systemPrompt },
      ...messages,
    ], CHAT_MAX_TOKENS, apiKey, providerModel);
  }

  if (model === "claude") {
    try {
      const anthropic = getAnthropic(apiKey);
      const result = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: CHAT_MAX_TOKENS,
        system: systemPrompt,
        messages: messages as any,
      });
      return result.content[0].type === "text" ? result.content[0].text : "";
    } catch (error) {
      if (!isAnthropicBillingError(error)) {
        throw new Error(toUserFacingAIError(error));
      }

      try {
        return await callOpenRouter([
          { role: "system", content: systemPrompt },
          ...messages,
        ], CHAT_MAX_TOKENS, apiKey, providerModel);
      } catch (fallbackError) {
        if (!isOpenRouterError(fallbackError)) {
          throw new Error(toUserFacingAIError(fallbackError));
        }
      }
    }
  }

  const contents = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  try {
    return await runGeminiWithFallback(apiKey, async (geminiModel) => {
      const result = await geminiModel.generateContent({
        contents,
        systemInstruction: {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
      });

      return result.response.text();
    });
  } catch (geminiError) {
    if (!isGeminiQuotaError(geminiError) && !isGeminiModelAvailabilityError(geminiError)) {
      throw new Error(toUserFacingAIError(geminiError));
    }

    return callOpenRouter([
      { role: "system", content: systemPrompt },
      ...messages,
    ], CHAT_MAX_TOKENS, apiKey, providerModel);
  }
}

export interface PRReviewResult {
  walkthrough: string;
  sequenceDiagrams: string[];
  summary: string;
  strengths: string[];
  issues: { severity: "high" | "medium" | "low"; message: string; line?: number }[];
  suggestions: { file: string; suggestion: string; code?: string }[];
}

export async function generatePRReview(
  prTitle: string,
  prBody: string,
  diff: string,
  context: string[] = [],
  model: AIModel = "gemini",
  apiKey?: string,
  providerModel?: string
): Promise<PRReviewResult> {
  const prompt = `You are an expert code reviewer. Review the following pull request.

PR Title: ${prTitle}
PR Body: ${prBody}

Diff:
${diff}

${context.length > 0 ? `Relevant codebase context:\n${context.join("\n\n")}` : ""}

Provide a comprehensive review with the following sections:
1. Walkthrough - line-by-line explanation of the changes
2. Sequence diagrams (in Mermaid.js format) if applicable
3. Summary - brief overview of the changes
4. Strengths - what was done well
5. Issues - problems found with severity (high/medium/low)
6. Suggestions - specific code improvements

Return the result as JSON in this exact format:
{
  "walkthrough": "...",
  "sequenceDiagrams": ["mermaid code 1", "mermaid code 2"],
  "summary": "...",
  "strengths": ["...", "..."],
  "issues": [{"severity": "high", "message": "...", "line": 123}],
  "suggestions": [{"file": "path/to/file.ts", "suggestion": "...", "code": "..."}]
}`;

  if (model === "openrouter") {
    const response = await callOpenRouter([{ role: "user", content: prompt }], 8192, apiKey, providerModel);
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    }
    throw new Error("Failed to parse AI response");
  }

  if (model === "claude") {
    try {
      const anthropic = getAnthropic(apiKey);
      const result = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });
      const response = result.content[0].type === "text" ? result.content[0].text : "";
      return JSON.parse(response);
    } catch (error) {
      if (!isAnthropicBillingError(error)) {
        throw new Error(toUserFacingAIError(error));
      }

      try {
        const response = await callOpenRouter([{ role: "user", content: prompt }], 8192, apiKey, providerModel);
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        }
        throw new Error("Failed to parse AI response");
      } catch (fallbackError) {
        if (!isOpenRouterError(fallbackError)) {
          throw new Error(toUserFacingAIError(fallbackError));
        }
      }
    }
  }

  let response: string;

  try {
    response = await runGeminiWithFallback(apiKey, async (geminiModel) => {
      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      return result.response.text();
    });
  } catch (geminiError) {
    if (!isGeminiQuotaError(geminiError) && !isGeminiModelAvailabilityError(geminiError)) {
      throw new Error(toUserFacingAIError(geminiError));
    }

    response = await callOpenRouter([{ role: "user", content: prompt }], 8192, apiKey, providerModel);
  }

  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  }

  throw new Error("Failed to parse AI response");
}
