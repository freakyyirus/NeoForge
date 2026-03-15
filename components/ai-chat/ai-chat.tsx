"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Send, Bot, User, FileText, X, Sparkles, Settings, History, Pencil, Trash2, Plus, RotateCcw } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  context?: { type: string; data: any }[];
  timestamp: Date;
  appliedFiles?: string[];
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  context?: { type: string; data: any }[];
  timestamp: string;
  appliedFiles?: string[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface StoredConversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
}

interface AIChatProps {
  onSendMessage: (
    message: string,
    context?: any[],
    apiKey?: string,
    model?: "gemini" | "claude" | "openrouter",
    providerModel?: string
  ) => Promise<string>;
  onApplyCode?: (code: string, language?: string) => string[] | void | Promise<string[] | void>;
  onApplyMultiFile?: (edits: Array<{ filePath: string; content: string }>) => string[] | void | Promise<string[] | void>;
  onApplyWorkspacePlan?: (plan: { folders: string[]; files: Array<{ filePath: string; content: string }>; deletedFiles: string[] }) => string[] | void | Promise<string[] | void>;
  onPreviewDiff?: (code: string) => void;
  onPreviewMultiFile?: (edits: Array<{ filePath: string; content: string }>) => void;
  onPushAndDeploy?: (commandText?: string) => Promise<{ message?: string } | void>;
  onGetEditorErrors?: () => string[];
  onRevertLastApply?: () => void;
  canRevertLastApply?: boolean;
  compact?: boolean;
  initialContext?: { type: string; data: any }[];
  className?: string;
}

function sanitizeAIText(text: string) {
  return text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
}

function stripCodeBlocks(text: string): string {
  return text
    // Fenced blocks with a language tag and/or path attribute before the newline
    .replace(/```[^\n`]*\n[\s\S]*?```/g, "")
    // Fenced blocks with no language tag (opening fence directly followed by content)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeAssistantMessage(text: string): string {
  let cleaned = stripCodeBlocks(text);
  // Strip raw JSON blobs (workspace plans returned without fences)
  cleaned = cleaned.replace(/\{\s*"(?:folders|files|deletedFiles)[\s\S]*?\}/g, "");
  cleaned = cleaned.replace(/"path"\s*:\s*"[^"]+"\s*,\s*"content"\s*:\s*"[\s\S]*?(?=\}\s*,\s*\{|\}\s*\]|$)/gi, "");
  cleaned = cleaned.replace(/\{\s*"path"\s*:\s*"[^"]+"[\s\S]*?\}/gi, "");
  cleaned = sanitizeAIText(cleaned);
  // Remove leftover artefact headers
  cleaned = cleaned.replace(/^\s*files:\s*$/gim, "");
  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

function hasScaffoldArtifact(text: string): boolean {
  if (!text) return false;
  return (
    /"files"\s*:\s*\[/i.test(text) ||
    /"path"\s*:\s*"\//i.test(text) ||
    /"content"\s*:\s*"/i.test(text) ||
    /\},\s*\{"path"\s*:/i.test(text)
  );
}

function normalizeAssistantPath(rawPath: string): string {
  let cleaned = (rawPath || "").trim();
  if (!cleaned) return "";

  cleaned = cleaned
    .replace(/^[-*+\s]+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^`+|`+$/g, "")
    .replace(/^\*+|\*+$/g, "")
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")
    .replace(/\s+\|.*$/, "")
    .replace(/[*_]+$/g, "")
    .replace(/[),;:.]+$/g, "")
    .replace(/\\/g, "/")
    .trim();

  if (!cleaned) return "";
  if (!cleaned.startsWith("/") && !cleaned.startsWith("📁")) {
    cleaned = `/${cleaned}`;
  }

  if (cleaned.startsWith("📁")) {
    const folder = normalizeAssistantPath(cleaned.replace(/^📁\s*/, ""));
    return folder ? `📁 ${folder}` : "";
  }

  return cleaned.replace(/\/+/g, "/");
}

function sanitizeAppliedFiles(paths: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  paths.forEach((path) => {
    const normalized = normalizeAssistantPath(path);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function decodeJsonStringLiteral(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  try {
    return JSON.parse(`"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return trimmed
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

export function AIChat({
  onSendMessage,
  onApplyCode,
  onApplyMultiFile,
  onApplyWorkspacePlan,
  onPreviewDiff,
  onPreviewMultiFile,
  onPushAndDeploy,
  onGetEditorErrors,
  onRevertLastApply,
  canRevertLastApply = false,
  compact = false,
  initialContext,
  className,
}: AIChatProps) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<any[]>(initialContext || []);
  const [model, setModel] = useState<"gemini" | "claude" | "openrouter">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [providerModel, setProviderModel] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const activeRequestIdRef = useRef(0);
  const cancelledRequestIdsRef = useRef<Set<number>>(new Set());

  const storageKey = `neoforge-ai-chat:${pathname}`;

  const createConversation = (title = "New chat"): Conversation => {
    const now = new Date();
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  };

  const selectConversation = (conversationId: string) => {
    const selected = conversations.find((conversation) => conversation.id === conversationId);
    if (!selected) return;
    setActiveConversationId(selected.id);
    setMessages(selected.messages);
    setShowHistory(false);
  };

  const startNewChat = () => {
    if (isLoading && activeRequestIdRef.current > 0) {
      cancelledRequestIdsRef.current.add(activeRequestIdRef.current);
      setIsLoading(false);
    }
    const next = createConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveConversationId(next.id);
    setMessages([]);
    setInput("");
    setShowHistory(false);
  };

  const cancelOngoingRequest = () => {
    if (!isLoading || activeRequestIdRef.current <= 0) return;

    cancelledRequestIdsRef.current.add(activeRequestIdRef.current);
    setIsLoading(false);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Canceled the in-progress request.",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
  };

  const renameConversation = (conversationId: string) => {
    const current = conversations.find((conversation) => conversation.id === conversationId);
    if (!current) return;

    const nextTitle = window.prompt("Rename chat", current.title);
    if (nextTitle === null) return;

    const cleaned = nextTitle.trim();
    if (!cleaned) return;

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title: cleaned.slice(0, 80), updatedAt: new Date() }
          : conversation
      )
    );
  };

  const deleteConversation = (conversationId: string) => {
    const remaining = conversations.filter((conversation) => conversation.id !== conversationId);

    if (remaining.length === 0) {
      const replacement = createConversation();
      setConversations([replacement]);
      setActiveConversationId(replacement.id);
      setMessages([]);
      return;
    }

    const nextActive = remaining
      .slice()
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

    setConversations(remaining);
    if (activeConversationId === conversationId) {
      setActiveConversationId(nextActive.id);
      setMessages(nextActive.messages);
    }
  };

  const formatConversationTime = (date: Date) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  };

  useEffect(() => {
    setContext(initialContext || []);
  }, [initialContext]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        const initial = createConversation();
        setConversations([initial]);
        setActiveConversationId(initial.id);
        setMessages([]);
        return;
      }

      const parsed = JSON.parse(raw);

      // Migration path: previous versions stored only an array of messages.
      if (Array.isArray(parsed)) {
        const migratedMessages = (parsed as StoredMessage[]).map((message) => ({
          ...message,
          content: message.role === "assistant" ? stripCodeBlocks(message.content) : message.content,
          timestamp: new Date(message.timestamp),
        }));
        const migratedConversation = createConversation("Previous chat");
        migratedConversation.messages = migratedMessages;
        migratedConversation.updatedAt = new Date();
        setConversations([migratedConversation]);
        setActiveConversationId(migratedConversation.id);
        setMessages(migratedMessages);
        return;
      }

      const storedConversations = Array.isArray(parsed?.conversations)
        ? (parsed.conversations as StoredConversation[])
        : [];

      const hydrated = storedConversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title || "Untitled chat",
        createdAt: new Date(conversation.createdAt),
        updatedAt: new Date(conversation.updatedAt),
        messages: (conversation.messages || []).map((message) => ({
          ...message,
          content: message.role === "assistant" ? stripCodeBlocks(message.content) : message.content,
          timestamp: new Date(message.timestamp),
        })),
      }));

      if (hydrated.length === 0) {
        const initial = createConversation();
        setConversations([initial]);
        setActiveConversationId(initial.id);
        setMessages([]);
        return;
      }

      const requestedActive = typeof parsed?.activeConversationId === "string"
        ? parsed.activeConversationId
        : hydrated[0].id;
      const active = hydrated.find((conversation) => conversation.id === requestedActive) || hydrated[0];

      setConversations(hydrated);
      setActiveConversationId(active.id);
      setMessages(active.messages);
    } catch (error) {
      console.error("Failed to restore chat history:", error);
      const fallback = createConversation();
      setConversations([fallback]);
      setActiveConversationId(fallback.id);
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      if (conversations.length === 0) return;
      const serializable = {
        version: 2,
        activeConversationId,
        conversations: conversations.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          messages: conversation.messages.map((message) => ({
            ...message,
            timestamp: message.timestamp.toISOString(),
          })),
        })),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(serializable));
    } catch (error) {
      console.error("Failed to persist chat history:", error);
    }
  }, [conversations, activeConversationId, storageKey]);

  useEffect(() => {
    if (!activeConversationId) return;
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId
          ? { ...conversation, messages, updatedAt: new Date() }
          : conversation
      )
    );
  }, [messages, activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const node = scrollAreaRef.current;
    if (!node) return;

    const handleScroll = () => {
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      setShowJumpToLatest(distanceFromBottom > 120);
    };

    handleScroll();
    node.addEventListener("scroll", handleScroll);
    return () => node.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const node = scrollAreaRef.current;
    if (!node) return;

    const handleWheel = (event: WheelEvent) => {
      if (node.scrollHeight <= node.clientHeight) return;

      const nextScrollTop = node.scrollTop + event.deltaY;
      const maxScrollTop = node.scrollHeight - node.clientHeight;
      const clamped = Math.max(0, Math.min(maxScrollTop, nextScrollTop));

      if (clamped !== node.scrollTop) {
        event.preventDefault();
        event.stopPropagation();
        node.scrollTop = clamped;
      }
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    const isRequestCancelled = () =>
      cancelledRequestIdsRef.current.has(requestId) || activeRequestIdRef.current !== requestId;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      context: context.length > 0 ? context : undefined,
      timestamp: new Date(),
    };

    if (activeConversationId) {
      const title = input.trim().slice(0, 40) || "New chat";
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === activeConversationId && conversation.messages.length === 0
            ? { ...conversation, title }
            : conversation
        )
      );
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setIsLoading(true);

    try {
      const editorErrors = onGetEditorErrors ? onGetEditorErrors() : [];
      const requestContext =
        editorErrors.length > 0
          ? [...context, { type: "editor_errors", data: editorErrors }]
          : context;

      let deleteTargetsFromInput = extractDeleteTargetsFromText(input);
      if (isDeleteAllIntent(input)) {
        const knownPaths = extractKnownWorkspacePaths(messages, context);
        if (knownPaths.length > 0) {
          deleteTargetsFromInput = knownPaths;
        }
      }
      const isDeleteOnlyIntent =
        deleteTargetsFromInput.length > 0 &&
        !/\b(create|add|build|generate|write|implement|scaffold|setup)\b/i.test(input);

      // If user clearly asks to delete, apply immediately instead of generating scaffold responses.
      if (isDeleteOnlyIntent && onApplyWorkspacePlan) {
        const appliedResult = await onApplyWorkspacePlan({
          folders: [],
          files: [],
          deletedFiles: deleteTargetsFromInput,
        });
        if (isRequestCancelled()) return;
        const appliedFiles = sanitizeAppliedFiles(
          (appliedResult && appliedResult.length > 0
            ? appliedResult
            : deleteTargetsFromInput.map((path) => `🗑️ ${path}`)
          ).filter(Boolean)
        );

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Deleted: ${deleteTargetsFromInput.join(", ")}`,
          timestamp: new Date(),
          appliedFiles: appliedFiles.length > 0 ? appliedFiles : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      const stopIntent = /\b(stop|pause|hold|wait|cancel)\b/i.test(input);
      const workspaceIntent = !stopIntent && /\b(folder|folders|file|files|project|scaffold|structure|setup|create|edit|build|make|write|generate|add|implement|delete|remove|rm|app|website|webpage|product|full[-\s]?stack|backend|frontend|api|dashboard)\b/i.test(input);
      const pushDeployIntent = /\b(push|commit|deploy|redeploy|publish|ship)\b/i.test(input);
      const codeInstruction = [
        "AUTONOMOUS BUILD MODE — behave like a coding copilot that directly builds the product:",
        "1. Do NOT ask which component/library to use unless absolutely required to proceed. Make reasonable engineering choices and implement immediately.",
        "2. If user asks for app/website/product/full-stack work, generate complete working structure directly (frontend + backend/API + config needed for run/preview).",
        "3. Begin with 1-2 plain-English sentences ONLY: what you changed and which files were touched. No code in prose.",
        "4. All code MUST be inside fenced code blocks. NEVER output code/JSON as plain prose.",
        "5. For multi-file / scaffold requests: place all files in ONE fenced ```json block with this exact shape:",
        '   {"folders":["/src"],"files":[{"path":"/index.html","content":"full content"}],"deletedFiles":[]}',
        "6. For a single-file edit: use ONE fenced code block with the correct language tag (e.g. ```tsx).",
        "7. Paths must be absolute (start with /). Provide COMPLETE file contents, not snippets.",
        "8. Keep building momentum across turns by default. Only stop or pause if user explicitly says stop/pause/cancel.",
      ].join("\n");
      const optimizedMessage = workspaceIntent
        ? `${input}\n\n${codeInstruction}\n\nReturn EXACTLY one fenced \`\`\`json block in the required shape and nothing else (no prose before or after).`
        : `${input}\n\n${codeInstruction}`;

      const response = await onSendMessage(optimizedMessage, requestContext, apiKey || undefined, model, providerModel || undefined);
      if (isRequestCancelled()) return;
      const firstCodeBlock = extractCodeBlock(response);
      const multiFileEdits = extractMultiFileEdits(response);
      const workspacePlan = extractWorkspacePlan(response);
      const finalWorkspacePlan = {
        ...workspacePlan,
        deletedFiles: Array.from(new Set([...workspacePlan.deletedFiles, ...deleteTargetsFromInput])),
      };

      const appliedWorkspace =
        (finalWorkspacePlan.folders.length > 0 || finalWorkspacePlan.files.length > 0 || finalWorkspacePlan.deletedFiles.length > 0) &&
        Boolean(onApplyWorkspacePlan);
      const appliedMultiFile = !appliedWorkspace && multiFileEdits.length > 0 && Boolean(onApplyMultiFile);
      const appliedSingleFile = !appliedWorkspace && !appliedMultiFile && Boolean(firstCodeBlock && firstCodeBlock.code && onApplyCode);

      const descriptionText = sanitizeAssistantMessage(response);
      const responseHasScaffoldArtifact = hasScaffoldArtifact(response) || hasScaffoldArtifact(descriptionText);

      // Code NEVER appears in chat — always use stripped description only.
      let assistantContent = descriptionText;
      let appliedFiles: string[] = [];

      if (appliedWorkspace) {
        const appliedResult = await onApplyWorkspacePlan?.(finalWorkspacePlan);
        if (isRequestCancelled()) return;
        appliedFiles = sanitizeAppliedFiles((appliedResult && appliedResult.length > 0 ? appliedResult : [
          ...finalWorkspacePlan.folders.map((f) => `📁 ${f}`),
          ...finalWorkspacePlan.files.map((f) => f.filePath),
          ...finalWorkspacePlan.deletedFiles.map((f) => `🗑️ ${f}`),
        ]).filter(Boolean));
      } else if (appliedMultiFile) {
        const appliedResult = await onApplyMultiFile?.(multiFileEdits);
        if (isRequestCancelled()) return;
        appliedFiles = sanitizeAppliedFiles((appliedResult && appliedResult.length > 0
          ? appliedResult
          : multiFileEdits.map((e) => e.filePath)).filter(Boolean));
      } else if (appliedSingleFile) {
        const appliedResult = await onApplyCode?.(firstCodeBlock!.code, firstCodeBlock?.language);
        if (isRequestCancelled()) return;
        appliedFiles = sanitizeAppliedFiles((appliedResult && appliedResult.length > 0 ? appliedResult : []).filter(Boolean));
      }

      // Never leak scaffold/code blobs into chat for workspace requests.
      if (workspaceIntent) {
        const plannedFiles = sanitizeAppliedFiles([
          ...finalWorkspacePlan.folders.map((folderPath) => `📁 ${folderPath}`),
          ...finalWorkspacePlan.files.map((file) => file.filePath),
          ...finalWorkspacePlan.deletedFiles.map((filePath) => `🗑️ ${filePath}`),
        ]);

        const summaryTargets = appliedFiles.length > 0 ? appliedFiles : plannedFiles;
        assistantContent = appliedFiles.length > 0
          ? `Updated: ${appliedFiles.join(", ")}`
          : summaryTargets.length > 0
          ? `Planned: ${summaryTargets.join(", ")}`
          : "Processed workspace request.";
      } else if (appliedWorkspace || appliedMultiFile || appliedSingleFile) {
        assistantContent = appliedFiles.length > 0
          ? `Updated: ${appliedFiles.join(", ")}`
          : "Applied changes to workspace.";
      } else if (responseHasScaffoldArtifact) {
        assistantContent = "Processed request.";
      } else if (!assistantContent) {
        assistantContent = descriptionText || "Done.";
      }

      if (pushDeployIntent && onPushAndDeploy) {
        const pushResult = await onPushAndDeploy(input);
        if (isRequestCancelled()) return;
        if (pushResult?.message) {
          assistantContent = `${assistantContent}\n\n${pushResult.message}`;
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
        appliedFiles: appliedFiles.length > 0 ? appliedFiles : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      if (isRequestCancelled()) return;
      const details = error instanceof Error ? error.message : "Unknown error";
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `AI request failed: ${details}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      cancelledRequestIdsRef.current.delete(requestId);
      if (activeRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize: reset then grow to fit content
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const clearContext = () => {
    setContext([]);
  };

  const clearHistory = () => {
    if (!activeConversationId) return;
    setMessages([]);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId
          ? { ...conversation, messages: [], title: "New chat", updatedAt: new Date() }
          : conversation
      )
    );
  };

  const extractCodeBlock = (content: string) => {
    const match = content.match(/```(\w+)?\n([\s\S]*?)```/);
    if (!match) return null;
    return {
      language: match[1]?.toLowerCase(),
      code: match[2]?.trim() || "",
    };
  };

  const extractMultiFileEdits = (content: string) => {
    const edits: Array<{ filePath: string; content: string }> = [];
    const seen = new Set<string>();

    const headingPattern = /(?:^|\n)\s*(?:#+\s*)?file\s*:\s*([^\n]+)\n```(?:[\w+-]+)?\n([\s\S]*?)```/gi;
    let headingMatch: RegExpExecArray | null;
    while ((headingMatch = headingPattern.exec(content)) !== null) {
      const filePath = normalizeAssistantPath(headingMatch[1]);
      const block = headingMatch[2].trim();
      if (!filePath || !block) continue;
      const key = `${filePath}:${block.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edits.push({ filePath, content: block });
    }

    const fencePathPattern = /```(?:[\w+-]+)?\s*path=([^\n]+)\n([\s\S]*?)```/gi;
    let fencePathMatch: RegExpExecArray | null;
    while ((fencePathMatch = fencePathPattern.exec(content)) !== null) {
      const filePath = normalizeAssistantPath(fencePathMatch[1]);
      const block = fencePathMatch[2].trim();
      if (!filePath || !block) continue;
      const key = `${filePath}:${block.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edits.push({ filePath, content: block });
    }

    // Recover from malformed scaffold blobs: {"path":"...","content":"..."}
    const looseJsonFilePattern = /"path"\s*:\s*"([^"\n]+)"\s*,\s*"content"\s*:\s*"((?:\\.|[^"\\])*)"/gi;
    let looseMatch: RegExpExecArray | null;
    while ((looseMatch = looseJsonFilePattern.exec(content)) !== null) {
      const filePath = normalizeAssistantPath(looseMatch[1]);
      const decoded = decodeJsonStringLiteral(looseMatch[2] || "").trim();
      if (!filePath || !decoded) continue;
      const key = `${filePath}:${decoded.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edits.push({ filePath, content: decoded });
    }

    return edits;
  };

  const extractWorkspacePlan = (content: string) => {
    const folders = new Set<string>();

    const folderHeadingPattern = /(?:^|\n)\s*(?:#+\s*)?folder\s*:\s*([^\n]+)/gi;
    let folderMatch: RegExpExecArray | null;
    while ((folderMatch = folderHeadingPattern.exec(content)) !== null) {
      const folderPath = normalizeAssistantPath(folderMatch[1]);
      if (folderPath) {
        folders.add(folderPath);
      }
    }

    const jsonBlockPattern = /```json\n([\s\S]*?)```/gi;
    const filesFromJson: Array<{ filePath: string; content: string }> = [];
    const deletedFromJson = new Set<string>();
    let jsonBlockMatch: RegExpExecArray | null;

    while ((jsonBlockMatch = jsonBlockPattern.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1]);
        if (Array.isArray(parsed?.folders)) {
          parsed.folders.forEach((folder: unknown) => {
            if (typeof folder === "string" && folder.trim()) {
              const normalized = normalizeAssistantPath(folder);
              if (normalized) folders.add(normalized);
            }
          });
        }

        if (Array.isArray(parsed?.files)) {
          parsed.files.forEach((file: unknown) => {
            if (
              file &&
              typeof file === "object" &&
              typeof (file as { path?: unknown }).path === "string" &&
              typeof (file as { content?: unknown }).content === "string"
            ) {
              filesFromJson.push({
                filePath: normalizeAssistantPath((file as { path: string }).path || ""),
                content: (file as { content: string }).content,
              });
            }
          });
        }

        if (Array.isArray(parsed?.deletedFiles)) {
          parsed.deletedFiles.forEach((item: unknown) => {
            if (typeof item === "string") {
              const normalized = normalizeAssistantPath(item);
              if (normalized) deletedFromJson.add(normalized);
            }
          });
        }

        if (Array.isArray(parsed?.delete)) {
          parsed.delete.forEach((item: unknown) => {
            if (typeof item === "string") {
              const normalized = normalizeAssistantPath(item);
              if (normalized) deletedFromJson.add(normalized);
            }
          });
        }
      } catch {
        // Ignore invalid JSON blocks.
      }
    }

    // Also accept raw JSON object responses without fenced blocks.
    const trimmed = content.trim();
    if (filesFromJson.length === 0 && trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed?.folders)) {
          parsed.folders.forEach((folder: unknown) => {
            if (typeof folder === "string" && folder.trim()) {
              const normalized = normalizeAssistantPath(folder);
              if (normalized) folders.add(normalized);
            }
          });
        }
        if (Array.isArray(parsed?.files)) {
          parsed.files.forEach((file: unknown) => {
            if (
              file &&
              typeof file === "object" &&
              typeof (file as { path?: unknown }).path === "string" &&
              typeof (file as { content?: unknown }).content === "string"
            ) {
              filesFromJson.push({
                filePath: normalizeAssistantPath((file as { path: string }).path || ""),
                content: (file as { content: string }).content,
              });
            }
          });
        }

        if (Array.isArray(parsed?.deletedFiles)) {
          parsed.deletedFiles.forEach((item: unknown) => {
            if (typeof item === "string") {
              const normalized = normalizeAssistantPath(item);
              if (normalized) deletedFromJson.add(normalized);
            }
          });
        }

        if (Array.isArray(parsed?.delete)) {
          parsed.delete.forEach((item: unknown) => {
            if (typeof item === "string") {
              const normalized = normalizeAssistantPath(item);
              if (normalized) deletedFromJson.add(normalized);
            }
          });
        }
      } catch {
        // Ignore invalid raw JSON.
      }
    }

    const files = filesFromJson.length > 0 ? filesFromJson : extractMultiFileEdits(content);
    return {
      folders: Array.from(folders),
      files,
      deletedFiles: Array.from(deletedFromJson),
    };
  };

  const extractDeleteTargetsFromText = (text: string) => {
    const hasDeleteIntent = /\b(delete|remove|rm)\b/i.test(text);
    if (!hasDeleteIntent) return [] as string[];

    const targets = new Set<string>();
    const genericDeleteWords = new Set([
      "all",
      "everything",
      "files",
      "file",
      "folders",
      "folder",
      "directories",
      "directory",
      "workspace",
      "project",
      "the",
      "this",
      "that",
    ]);

    const commandPattern = /(?:delete|remove|rm)\s+(?:the\s+)?(?:file|folder|directory)?\s*[:\-]?\s*["'`]?([^\s"'`,;]+)["'`]?/gi;
    let match: RegExpExecArray | null;
    while ((match = commandPattern.exec(text)) !== null) {
      const raw = (match[1] || "").trim().toLowerCase();
      if (genericDeleteWords.has(raw)) continue;
      const normalized = normalizeAssistantPath(raw);
      if (normalized && !normalized.startsWith("📁")) {
        targets.add(normalized);
      }
    }

    const explicitPathPattern = /["'`]?([./]?[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-.]+)+)["'`]?/g;
    while ((match = explicitPathPattern.exec(text)) !== null) {
      const normalized = normalizeAssistantPath(match[1] || "");
      if (normalized && !normalized.startsWith("📁")) {
        targets.add(normalized);
      }
    }

    return Array.from(targets);
  };

  const isDeleteAllIntent = (text: string) => {
    const hasDeleteIntent = /\b(delete|remove|rm)\b/i.test(text);
    const hasAllIntent = /\b(all|everything|entire|whole)\b/i.test(text);
    const hasWorkspaceScope = /\b(files?|folders?|directories?|workspace|project)\b/i.test(text);
    return hasDeleteIntent && (hasAllIntent || hasWorkspaceScope);
  };

  const extractKnownWorkspacePaths = (allMessages: Message[], currentContext: any[]) => {
    const paths = new Set<string>();

    const addPath = (rawPath: string) => {
      const normalized = normalizeAssistantPath(rawPath || "");
      if (!normalized || normalized === "/") return;
      paths.add(normalized);
    };

    allMessages.forEach((message) => {
      (message.appliedFiles || []).forEach((item) => {
        const withoutPrefix = item.replace(/^📁\s*/, "").replace(/^🗑️\s*/, "");
        addPath(withoutPrefix);
      });

      const textMatches = message.content.match(/\/(?:[a-zA-Z0-9_.-]+\/?)+/g) || [];
      textMatches.forEach((matchPath) => addPath(matchPath));

      (message.context || []).forEach((ctx) => {
        if (typeof ctx?.data?.filePath === "string") {
          addPath(ctx.data.filePath);
        }
      });
    });

    currentContext.forEach((ctx) => {
      if (typeof ctx?.data?.filePath === "string") {
        addPath(ctx.data.filePath);
      }
    });

    return Array.from(paths).sort((a, b) => b.length - a.length);
  };

  const renderMessageContent = (content: string) => {
    // Double-safety: strip code blocks before rendering (catches legacy stored messages)
    const safe = sanitizeAIText(stripCodeBlocks(content));
    return safe
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((part, index) => (
        <p key={index} className="whitespace-pre-wrap break-words">{part}</p>
      ));
  };

  return (
    <div className={cn("flex h-full flex-col rounded-lg border-4 border-black bg-white", className)}>
      <div className={cn("flex items-center justify-between border-b-4 border-black bg-muted", compact ? "px-2 py-2" : "px-4 py-3")}>
        <div className="flex items-center gap-2">
          <Sparkles className={cn("text-accent", compact ? "h-4 w-4" : "h-5 w-5")} />
          <span className={cn("font-bold", compact ? "text-sm" : "")}>AI ASSISTANT</span>
          <span className="text-xs font-medium text-muted-foreground">({model})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded border border-black/20 bg-white hover:bg-muted disabled:opacity-40"
            onClick={onRevertLastApply}
            disabled={!canRevertLastApply || !onRevertLastApply}
            aria-label="Revert last AI apply"
            title="Revert last AI apply"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded border border-black/20 bg-white hover:bg-muted"
            onClick={startNewChat}
            aria-label="Start new chat"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <Dialog open={showHistory} onOpenChange={setShowHistory}>
            <DialogTrigger
              className="flex h-7 w-7 items-center justify-center rounded border border-black/20 bg-white hover:bg-muted"
              aria-label="Open chat history"
            >
              <History className="h-3.5 w-3.5" />
            </DialogTrigger>
            <DialogContent className="border-4 border-black" onClick={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle>Chat History</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-3">
                <Button type="button" variant="outline" className="w-full" onClick={startNewChat}>
                  Start New Chat
                </Button>
                <div className="max-h-72 space-y-2 overflow-auto pr-1">
                  {conversations
                    .slice()
                    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                    .map((conversation) => (
                      <div
                        key={conversation.id}
                        className={cn(
                          "w-full rounded-md border-2 border-black p-2",
                          conversation.id === activeConversationId ? "bg-primary/20" : "bg-white"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => selectConversation(conversation.id)}
                          className="w-full rounded-md p-1 text-left hover:bg-muted"
                        >
                          <p className="truncate text-sm font-bold">{conversation.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {conversation.messages.length} messages • {formatConversationTime(conversation.updatedAt)}
                          </p>
                        </button>
                        <div className="mt-2 flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => renameConversation(conversation.id)}
                            aria-label="Rename chat"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteConversation(conversation.id)}
                            aria-label="Delete chat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger
              className="flex h-7 w-7 items-center justify-center rounded border border-black/20 bg-white hover:bg-muted"
              aria-label="Open AI settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </DialogTrigger>
            <DialogContent className="border-4 border-black" onClick={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle>AI Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="mb-2 block text-sm font-bold">Model</label>
                  <div className="flex gap-2">
                    <Button
                      variant={model === "gemini" ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setModel("gemini")}
                      type="button"
                    >
                      Gemini
                    </Button>
                    <Button
                      variant={model === "claude" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setModel("claude")}
                      type="button"
                    >
                      Claude
                    </Button>
                    <Button
                      variant={model === "openrouter" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setModel("openrouter")}
                      type="button"
                    >
                      OpenRouter
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold">Custom API Key (Optional)</label>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Leave empty to use your default API key from environment variables
                  </p>
                  <Input
                    type="password"
                    placeholder={
                      model === "gemini"
                        ? "Enter Google AI API Key"
                        : model === "claude"
                        ? "Enter Anthropic API Key"
                        : "Enter OpenRouter API Key"
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                {model === "openrouter" && (
                  <div>
                    <label className="mb-2 block text-sm font-bold">OpenRouter Model</label>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Enter any currently available OpenRouter model id, for example a free one from your OpenRouter models page.
                    </p>
                    <Input
                      placeholder="meta-llama/llama-3.3-70b-instruct:free"
                      value={providerModel}
                      onChange={(e) => setProviderModel(e.target.value)}
                    />
                  </div>
                )}
                <Button onClick={() => setShowSettings(false)} className="w-full" type="button">
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {context.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {context.length} context files
              </span>
              <Button variant="ghost" size="sm" onClick={clearContext}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <div
        ref={scrollAreaRef}
        className="chat-scrollbar min-h-0 flex-1 overflow-y-scroll overflow-x-hidden overscroll-contain p-4"
      >
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="font-bold">Start a conversation</p>
              <p className="text-sm text-muted-foreground">
                Ask me about your code, request refactoring, or get help with bugs.
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black",
                  message.role === "user" ? "bg-secondary" : "bg-primary"
                )}
              >
                {message.role === "user" ? (
                  <User className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-black" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-lg border-2 border-black p-3",
                  message.role === "user" ? "bg-secondary text-white" : "bg-muted"
                )}
              >
                {(() => {
                  return (
                    <>
                {message.context && message.context.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1 border-b border-black/20 pb-2">
                    {message.context.map((ctx, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 rounded bg-black/10 px-2 py-0.5 text-xs"
                      >
                        <FileText className="h-3 w-3" />
                        {ctx.data?.filePath || "Context"}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-sm">{renderMessageContent(message.content)}</div>
                {message.role === "assistant" && message.appliedFiles && message.appliedFiles.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    <p className="text-xs font-bold text-muted-foreground">Files written to editor:</p>
                    <div className="flex flex-wrap gap-1">
                      {message.appliedFiles.map((filePath, i) => (
                        <span
                          key={i}
                          className="flex max-w-full items-start gap-1 rounded-md border border-black/20 bg-primary/10 px-2 py-0.5 text-xs font-mono font-medium"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="break-all">{filePath.startsWith("📁") ? filePath : filePath}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString()}
                </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-primary">
                <Bot className="h-4 w-4 text-black" />
              </div>
              <div className="flex items-center gap-2 rounded-lg border-2 border-black bg-muted px-4 py-3">
                <div className="h-2 w-2 animate-bounce rounded-full bg-black" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-black" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-black" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {messages.length > 0 && showJumpToLatest && (
            <div className="sticky bottom-2 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
              >
                Jump to latest
              </Button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="border-t-4 border-black p-3">
        <div className="flex items-end gap-2 rounded-lg border-2 border-black bg-white px-3 py-2 focus-within:border-black focus-within:ring-1 focus-within:ring-black">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI anything… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
            style={{ maxHeight: "200px", minHeight: "24px" }}
          />
          <div className="flex shrink-0 items-center gap-1 pb-0.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="flex h-7 w-7 items-center justify-center rounded border border-black/20 hover:bg-muted"
                title="Clear chat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {isLoading && (
              <button
                type="button"
                onClick={cancelOngoingRequest}
                className="flex h-7 w-7 items-center justify-center rounded border border-black/20 bg-white hover:bg-muted"
                title="Cancel response"
                aria-label="Cancel response"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="flex h-7 w-7 items-center justify-center rounded bg-black text-white hover:bg-black/80 disabled:opacity-40"
              title="Send (Enter)"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
