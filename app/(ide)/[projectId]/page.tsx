"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { CodeEditor } from "@/components/editor/code-editor";
import { TerminalComponent } from "@/components/terminal/terminal";
import { AIChat } from "@/components/ai-chat/ai-chat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import JSZip from "jszip";
import {
  PanelLeft,
  PanelRight,
  Terminal as TerminalIcon,
  Bot,
  Play,
  Save,
  GitCommit,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Settings,
  Share2,
  Download,
  Link2,
  FolderArchive,
  GripVertical,
  Loader2,
  X,
  Bug,
  SquareTerminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
}

interface DiffOp {
  type: "equal" | "add" | "remove";
  line: string;
  hunkId: number;
}

interface DiffHunk {
  id: number;
  oldStart: number;
  newStart: number;
  oldLines: string[];
  newLines: string[];
  accepted: boolean;
}

interface MultiFileDraft {
  filePath: string;
  content: string;
  selected: boolean;
}

interface ReviewFinding {
  severity: "critical" | "major" | "minor" | "nit";
  title: string;
  line?: number;
  explanation: string;
  suggestion?: string;
}

interface WorkspaceSnapshot {
  files: FileItem[];
  fileContents: Record<string, string>;
  selectedFile: string | null;
  fileContent: string;
}

const initialFiles: FileItem[] = [];

export default function IDEPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repository = searchParams.get("repo") || "";
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(250);
  const [isChatMaximized, setIsChatMaximized] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(256);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [activeTab, setActiveTab] = useState("terminal");
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [previewUrl, setPreviewUrl] = useState("http://localhost:3000");
  const [previewMode, setPreviewMode] = useState<"app" | "editor">("app");
  const [runOutput, setRunOutput] = useState("");
  const [runError, setRunError] = useState("");
  const [isRunningPreviewCode, setIsRunningPreviewCode] = useState(false);
  const [showCmdK, setShowCmdK] = useState(false);
  const [cmdKLoading, setCmdKLoading] = useState(false);
  const [cmdKInstruction, setCmdKInstruction] = useState("");
  const [cmdKResult, setCmdKResult] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [diffTargetFilePath, setDiffTargetFilePath] = useState<string | null>(null);
  const [diffOps, setDiffOps] = useState<DiffOp[]>([]);
  const [diffHunks, setDiffHunks] = useState<DiffHunk[]>([]);
  const [showMultiFilePreview, setShowMultiFilePreview] = useState(false);
  const [multiFileDrafts, setMultiFileDrafts] = useState<MultiFileDraft[]>([]);
  const [resizeCursor, setResizeCursor] = useState<"col-resize" | "row-resize" | null>(null);
  const [isReviewingCode, setIsReviewingCode] = useState(false);
  const [reviewFindings, setReviewFindings] = useState<ReviewFinding[]>([]);
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewRawResponse, setReviewRawResponse] = useState("");
  const [jumpToLine, setJumpToLine] = useState<number | null>(null);
  const [jumpToLineSignal, setJumpToLineSignal] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [previewRefreshSignal, setPreviewRefreshSignal] = useState(0);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const isResizingBottom = useRef(false);
  const previousBottomHeight = useRef(250);
  const centerColumnRef = useRef<HTMLDivElement>(null);
  const fileContentsRef = useRef<Record<string, string>>({});
  const loadedRepositoryRef = useRef<string | null>(null);
  const repoBaselineRef = useRef<Record<string, string>>({});
  const aiApplyHistoryRef = useRef<WorkspaceSnapshot[]>([]);
  const [canRevertLastApply, setCanRevertLastApply] = useState(false);

  const normalizePath = useCallback((inputPath: string) => {
    const normalized = inputPath.replace(/\\/g, "/").trim();
    if (!normalized) return "/";
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }, []);

  const getParentPath = useCallback((inputPath: string) => {
    const normalized = normalizePath(inputPath);
    const lastSlash = normalized.lastIndexOf("/");
    return lastSlash <= 0 ? "/" : normalized.slice(0, lastSlash);
  }, [normalizePath]);

  const findNode = useCallback((tree: FileItem[], path: string): FileItem | null => {
    for (const item of tree) {
      if (item.path === path) return item;
      if (item.children?.length) {
        const nested = findNode(item.children, path);
        if (nested) return nested;
      }
    }
    return null;
  }, []);

  const insertPath = useCallback((tree: FileItem[], targetPath: string, isDirectory: boolean) => {
    const segments = normalizePath(targetPath).split("/").filter(Boolean);
    if (segments.length === 0) return tree;

    const next = JSON.parse(JSON.stringify(tree)) as FileItem[];
    let level = next;
    let currentPath = "";

    for (let i = 0; i < segments.length; i += 1) {
      const name = segments[i];
      currentPath = `${currentPath}/${name}`;
      const isLast = i === segments.length - 1;
      let node = level.find((item) => item.path === currentPath);

      if (!node) {
        node = {
          name,
          path: currentPath,
          isDirectory: !isLast || isDirectory,
          children: !isLast || isDirectory ? [] : undefined,
        };
        level.push(node);
      }

      if (!isLast) {
        node.isDirectory = true;
        node.children = node.children || [];
        level = node.children;
      }
    }

    return next;
  }, [normalizePath]);

  const renameInTree = useCallback((items: FileItem[], oldPath: string, newPath: string): FileItem[] => {
    return items.map((item) => {
      const updatedPath = item.path === oldPath || item.path.startsWith(`${oldPath}/`)
        ? `${newPath}${item.path.slice(oldPath.length)}`
        : item.path;
      const updatedName = updatedPath.split("/").filter(Boolean).pop() || item.name;
      return {
        ...item,
        name: updatedName,
        path: updatedPath,
        children: item.children ? renameInTree(item.children, oldPath, newPath) : undefined,
      };
    });
  }, []);

  const deleteFromTree = useCallback((items: FileItem[], targetPath: string): FileItem[] => {
    return items
      .filter((item) => !(item.path === targetPath || item.path.startsWith(`${targetPath}/`)))
      .map((item) => ({
        ...item,
        children: item.children ? deleteFromTree(item.children, targetPath) : undefined,
      }));
  }, []);

  const createOrUpdateFile = useCallback((path: string, content: string) => {
    const normalizedPath = normalizePath(path);
    setFiles((prev) => insertPath(prev, normalizedPath, false));
    fileContentsRef.current[normalizedPath] = content;
    setSelectedFile(normalizedPath);
    setFileContent(content);
  }, [insertPath, normalizePath]);

  const createFolderPath = useCallback((path: string) => {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath || normalizedPath === "/") return;
    setFiles((prev) => insertPath(prev, normalizedPath, true));
  }, [insertPath, normalizePath]);

  const pushAIApplySnapshot = useCallback(() => {
    aiApplyHistoryRef.current.push({
      files: JSON.parse(JSON.stringify(files)) as FileItem[],
      fileContents: { ...fileContentsRef.current },
      selectedFile,
      fileContent,
    });

    if (aiApplyHistoryRef.current.length > 20) {
      aiApplyHistoryRef.current.shift();
    }

    setCanRevertLastApply(aiApplyHistoryRef.current.length > 0);
  }, [fileContent, files, selectedFile]);

  const handleRevertLastAIApply = useCallback(() => {
    const snapshot = aiApplyHistoryRef.current.pop();
    if (!snapshot) {
      setTerminalOutput((prev) => [...prev, "[AI revert skipped: No previous apply snapshot]"]);
      setCanRevertLastApply(false);
      return;
    }

    setFiles(snapshot.files);
    fileContentsRef.current = snapshot.fileContents;
    setSelectedFile(snapshot.selectedFile);
    setFileContent(snapshot.fileContent);
    setCanRevertLastApply(aiApplyHistoryRef.current.length > 0);
    setTerminalOutput((prev) => [...prev, "[AI revert complete: Restored previous workspace state]"]);
  }, []);

  const getEditorErrors = useCallback(() => {
    const diagnostics: string[] = [];

    if (runError.trim()) {
      diagnostics.push(`Latest run error: ${runError.trim()}`);
    }

    const recentTerminalErrors = terminalOutput
      .filter((line) => {
        const lower = line.toLowerCase();
        return lower.includes("[error]") || lower.includes("[stderr]");
      })
      .slice(-5);

    recentTerminalErrors.forEach((line) => {
      diagnostics.push(`Terminal: ${line}`);
    });

    if (selectedFile && selectedFile.endsWith(".json") && fileContent.trim()) {
      try {
        JSON.parse(fileContent);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON syntax.";
        diagnostics.push(`JSON parse error in ${selectedFile}: ${message}`);
      }
    }

    return diagnostics.slice(0, 10);
  }, [fileContent, runError, selectedFile, terminalOutput]);

  const computeDiffData = useCallback((originalContent: string, nextContent: string) => {
    const oldLines = originalContent.replace(/\r\n/g, "\n").split("\n");
    const newLines = nextContent.replace(/\r\n/g, "\n").split("\n");
    const rows = oldLines.length;
    const cols = newLines.length;
    const lcs: number[][] = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));

    for (let i = rows - 1; i >= 0; i -= 1) {
      for (let j = cols - 1; j >= 0; j -= 1) {
        if (oldLines[i] === newLines[j]) {
          lcs[i][j] = lcs[i + 1][j + 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
      }
    }

    const ops: DiffOp[] = [];
    const hunks: DiffHunk[] = [];
    let i = 0;
    let j = 0;
    let oldLineNumber = 1;
    let newLineNumber = 1;
    let currentHunkId = -1;

    while (i < rows || j < cols) {
      if (i < rows && j < cols && oldLines[i] === newLines[j]) {
        ops.push({ type: "equal", line: oldLines[i], hunkId: -1 });
        i += 1;
        j += 1;
        oldLineNumber += 1;
        newLineNumber += 1;
        currentHunkId = -1;
        continue;
      }

      if (currentHunkId === -1) {
        currentHunkId = hunks.length;
        hunks.push({
          id: currentHunkId,
          oldStart: oldLineNumber,
          newStart: newLineNumber,
          oldLines: [],
          newLines: [],
          accepted: true,
        });
      }

      if (j < cols && (i === rows || lcs[i][j + 1] >= lcs[i + 1][j])) {
        const line = newLines[j];
        ops.push({ type: "add", line, hunkId: currentHunkId });
        hunks[currentHunkId].newLines.push(line);
        j += 1;
        newLineNumber += 1;
      } else if (i < rows) {
        const line = oldLines[i];
        ops.push({ type: "remove", line, hunkId: currentHunkId });
        hunks[currentHunkId].oldLines.push(line);
        i += 1;
        oldLineNumber += 1;
      }
    }

    return { ops, hunks };
  }, []);

  const renderFinalContentFromDiff = useCallback((ops: DiffOp[], hunks: DiffHunk[]) => {
    const lines: string[] = [];
    const acceptedMap = new Map(hunks.map((hunk) => [hunk.id, hunk.accepted]));

    ops.forEach((op) => {
      if (op.type === "equal") {
        lines.push(op.line);
        return;
      }

      const accepted = acceptedMap.get(op.hunkId) ?? false;
      if (accepted && op.type === "add") {
        lines.push(op.line);
      }
      if (!accepted && op.type === "remove") {
        lines.push(op.line);
      }
    });

    return lines.join("\n");
  }, []);

  const openDiffPreview = useCallback((proposedCode: string) => {
    const promptPath = !selectedFile
      ? window.prompt("Select target file path for this change", "/src/App.tsx")
      : null;
    const targetPath = normalizePath(selectedFile || promptPath || "");
    if (!targetPath || targetPath === "/") return;

    const currentContent = fileContentsRef.current[targetPath] || "";
    const { ops, hunks } = computeDiffData(currentContent, proposedCode);
    setDiffTargetFilePath(targetPath);
    setDiffOps(ops);
    setDiffHunks(hunks);
    setShowDiffPreview(true);
  }, [computeDiffData, normalizePath, selectedFile]);

  const toggleHunkAcceptance = useCallback((hunkId: number) => {
    setDiffHunks((prev) =>
      prev.map((hunk) =>
        hunk.id === hunkId ? { ...hunk, accepted: !hunk.accepted } : hunk
      )
    );
  }, []);

  const applyDiffPreview = useCallback(() => {
    if (!diffTargetFilePath) return;

    const nextContent = renderFinalContentFromDiff(diffOps, diffHunks);
    createOrUpdateFile(diffTargetFilePath, nextContent);
    fileContentsRef.current[diffTargetFilePath] = nextContent;
    setTerminalOutput((prev) => [...prev, `[AI diff applied to ${diffTargetFilePath}]`]);
    setShowDiffPreview(false);
  }, [createOrUpdateFile, diffHunks, diffOps, diffTargetFilePath, renderFinalContentFromDiff]);

  const openMultiFilePreview = useCallback((edits: Array<{ filePath: string; content: string }>) => {
    if (edits.length === 0) return;
    const drafts = edits.map((edit) => ({
      filePath: normalizePath(edit.filePath),
      content: edit.content,
      selected: true,
    }));
    setMultiFileDrafts(drafts);
    setShowMultiFilePreview(true);
  }, [normalizePath]);

  const toggleMultiFileSelection = useCallback((filePath: string) => {
    setMultiFileDrafts((prev) =>
      prev.map((draft) =>
        draft.filePath === filePath ? { ...draft, selected: !draft.selected } : draft
      )
    );
  }, []);

  const applySelectedMultiFileEdits = useCallback(() => {
    const selectedDrafts = multiFileDrafts.filter((draft) => draft.selected);
    if (selectedDrafts.length === 0) {
      setTerminalOutput((prev) => [...prev, "[AI multi-file apply skipped: No files selected]"]);
      return;
    }

    selectedDrafts.forEach((draft) => {
      createOrUpdateFile(draft.filePath, draft.content);
      fileContentsRef.current[draft.filePath] = draft.content;
    });

    setTerminalOutput((prev) => [...prev, `[AI multi-file apply complete: ${selectedDrafts.length} file(s)]`]);
    setShowMultiFilePreview(false);
  }, [createOrUpdateFile, multiFileDrafts]);

  useEffect(() => {
    if (selectedFile && fileContentsRef.current[selectedFile] !== undefined) {
      setFileContent(fileContentsRef.current[selectedFile]);
    } else {
      setFileContent("");
    }
  }, [selectedFile]);

  useEffect(() => {
    if (!repository || loadedRepositoryRef.current === repository) return;

    let cancelled = false;

    const loadRepositoryFiles = async () => {
      try {
        setTerminalOutput((prev) => [...prev, `[repo] Loading files from ${repository}...`]);
        const response = await fetch(`/api/github/tree?repository=${encodeURIComponent(repository)}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          setTerminalOutput((prev) => [...prev, `[repo] Failed to load files: ${data?.error || "Unknown error"}`]);
          return;
        }

        const repoFiles = Array.isArray(data?.files) ? data.files : [];
        const nextContents: Record<string, string> = {};

        repoFiles.forEach((file: { path?: string; content?: string }) => {
          const path = normalizePath(String(file.path || ""));
          if (!path || path === "/") return;
          nextContents[path] = typeof file.content === "string" ? file.content : "";
        });

        const nextTree = Object.keys(nextContents).reduce<FileItem[]>((acc, path) => {
          return insertPath(acc, path, false);
        }, []);

        if (cancelled) return;

        fileContentsRef.current = nextContents;
        repoBaselineRef.current = { ...nextContents };
        setFiles(nextTree);

        const preferredPath = ["/index.html", "/src/App.tsx", "/README.md"].find((path) => nextContents[path] !== undefined);
        const firstPath = preferredPath || Object.keys(nextContents)[0] || null;

        setSelectedFile(firstPath);
        setFileContent(firstPath ? nextContents[firstPath] || "" : "");

        setTerminalOutput((prev) => {
          const lines = [...prev, `[repo] Loaded ${Object.keys(nextContents).length} file(s) from ${repository}`];
          if (data?.truncated) {
            lines.push("[repo] Large repository detected. Showing a partial set of text files.");
          }
          return lines;
        });

        loadedRepositoryRef.current = repository;
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unknown error";
        setTerminalOutput((prev) => [...prev, `[repo] Failed to load files: ${message}`]);
      }
    };

    loadRepositoryFiles();

    return () => {
      cancelled = true;
    };
  }, [insertPath, normalizePath, repository]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCmdK(true);
      }
      if (e.key === "Escape") {
        setShowCmdK(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingLeft.current && !isResizingRight.current && !isResizingBottom.current) {
        return;
      }

      if (isResizingLeft.current) {
        const newWidth = Math.max(150, Math.min(400, e.clientX));
        setLeftPanelWidth(newWidth);
      }
      if (isResizingRight.current) {
        const newWidth = Math.max(200, Math.min(500, window.innerWidth - e.clientX));
        setRightPanelWidth(newWidth);
      }
      if (isResizingBottom.current) {
        const containerRect = centerColumnRef.current?.getBoundingClientRect();
        const containerHeight = containerRect?.height || window.innerHeight;
        const cursorYInside = containerRect ? e.clientY - containerRect.top : e.clientY;
        const newHeight = Math.max(120, Math.min(containerHeight - 120, containerHeight - cursorYInside));
        setBottomPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
      isResizingBottom.current = false;
      setResizeCursor(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  const handleFileCreate = (parentPath: string, name: string, isDirectory: boolean) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const normalizedParent = normalizePath(parentPath || "/");
    const parentNode = findNode(files, normalizedParent);
    const safeParent = parentNode && !parentNode.isDirectory ? getParentPath(normalizedParent) : normalizedParent;
    const targetPath = normalizePath(trimmedName.startsWith("/") ? trimmedName : `${safeParent}/${trimmedName}`);

    setFiles((prev) => insertPath(prev, targetPath, isDirectory));
    if (!isDirectory) {
      fileContentsRef.current[targetPath] = fileContentsRef.current[targetPath] || "";
      setSelectedFile(targetPath);
      setFileContent(fileContentsRef.current[targetPath]);
    }
  };

  const handleFileRename = (oldPath: string, newPath: string) => {
    const source = normalizePath(oldPath);
    const target = normalizePath(newPath);
    if (source === target) return;

    setFiles((prev) => renameInTree(prev, source, target));

    const nextContents: Record<string, string> = {};
    Object.entries(fileContentsRef.current).forEach(([path, content]) => {
      const nextPath = path === source || path.startsWith(`${source}/`)
        ? `${target}${path.slice(source.length)}`
        : path;
      nextContents[nextPath] = content;
    });
    fileContentsRef.current = nextContents;

    if (selectedFile && (selectedFile === source || selectedFile.startsWith(`${source}/`))) {
      const nextSelected = `${target}${selectedFile.slice(source.length)}`;
      setSelectedFile(nextSelected);
      setFileContent(fileContentsRef.current[nextSelected] || "");
    }
  };

  const handleFileDelete = (path: string) => {
    const target = normalizePath(path);
    setFiles((prev) => deleteFromTree(prev, target));

    const nextContents: Record<string, string> = {};
    Object.entries(fileContentsRef.current).forEach(([itemPath, content]) => {
      if (!(itemPath === target || itemPath.startsWith(`${target}/`))) {
        nextContents[itemPath] = content;
      }
    });
    fileContentsRef.current = nextContents;

    if (selectedFile && (selectedFile === target || selectedFile.startsWith(`${target}/`))) {
      setSelectedFile(null);
      setFileContent("");
    }
  };

  const handleCommand = useCallback(async (command: string) => {
    setIsExecuting(true);
    setTerminalOutput((prev) => [...prev, `$ ${command}`]);

    const lower = command.toLowerCase();
    if (lower.includes("npm run dev") || lower.includes("pnpm dev") || lower.includes("yarn dev") || lower.includes("next dev")) {
      setActiveTab("preview");
      setTerminalOutput((prev) => [...prev, "[preview] Opening preview tab at http://localhost:3000"]);
      setPreviewUrl("http://localhost:3000");
    }

    try {
      const response = await fetch("/api/webcontainer/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, stream: true }),
      });
      if (!response.ok) {
        const data = await response.json();
        setTerminalOutput((prev) => [...prev, `[error] ${data?.error || "Failed to execute command"}`]);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setTerminalOutput((prev) => [...prev, "[error] Streaming reader unavailable"]);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      const appendChunkLines = (chunk: string, kind: "stdout" | "stderr") => {
        const lines = chunk.replace(/\r\n/g, "\n").split("\n").filter((line) => line.length > 0);
        if (lines.length === 0) return;
        setTerminalOutput((prev) => [...prev, ...lines.map((line) => (kind === "stderr" ? `[stderr] ${line}` : line))]);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const records = buffer.split("\n");
        buffer = records.pop() || "";

        records.forEach((record) => {
          if (!record.trim()) return;
          try {
            const packet = JSON.parse(record) as { type?: string; data?: string; code?: number | null };
            if (packet.type === "stdout" && typeof packet.data === "string") {
              appendChunkLines(packet.data, "stdout");
            } else if (packet.type === "stderr" && typeof packet.data === "string") {
              appendChunkLines(packet.data, "stderr");
            } else if (packet.type === "error" && typeof packet.data === "string") {
              setTerminalOutput((prev) => [...prev, `[error] ${packet.data}`]);
            } else if (packet.type === "exit") {
              setTerminalOutput((prev) => [...prev, `[exit ${packet.code ?? "unknown"}]`]);
            }
          } catch {
            setTerminalOutput((prev) => [...prev, record]);
          }
        });
      }

      if (buffer.trim()) {
        try {
          const packet = JSON.parse(buffer) as { type?: string; data?: string; code?: number | null };
          if (packet.type === "stdout" && typeof packet.data === "string") {
            appendChunkLines(packet.data, "stdout");
          } else if (packet.type === "stderr" && typeof packet.data === "string") {
            appendChunkLines(packet.data, "stderr");
          } else if (packet.type === "exit") {
            setTerminalOutput((prev) => [...prev, `[exit ${packet.code ?? "unknown"}]`]);
          }
        } catch {
          setTerminalOutput((prev) => [...prev, buffer]);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error";
      setTerminalOutput((prev) => [...prev, `[error] ${message}`]);
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const handleSave = () => {
    if (selectedFile) {
      fileContentsRef.current[selectedFile] = fileContent;
      setTerminalOutput((prev) => [...prev, `[File saved: ${selectedFile}]`]);
    }
  };

  const handleCommitToGitHub = async () => {
    if (!selectedFile) {
      setTerminalOutput((prev) => [...prev, "[Commit failed: No file selected]"]);
      return;
    }

    if (!repository) {
      setTerminalOutput((prev) => [...prev, "[Commit failed: No connected repository selected. Open IDE from /ide/new with a repo.]"]);
      return;
    }

    setIsCommitting(true);
    try {
      const response = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository,
          filePath: selectedFile,
          content: fileContent,
          message: `chore: update ${selectedFile} from NeoForge IDE`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setTerminalOutput((prev) => [...prev, `[Commit failed: ${data?.error || "Unknown error"}]`]);
        return;
      }

      setTerminalOutput((prev) => [...prev, `[Committed to ${repository}: ${selectedFile}]`]);
    } catch {
      setTerminalOutput((prev) => [...prev, "[Commit failed: Network error]"]);
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePushWorkspaceToGitHub = async (commandText?: string) => {
    if (!repository) {
      setTerminalOutput((prev) => [...prev, "[Push failed: No connected repository selected. Open IDE from /ide/new with a repo.]"]);
      return { message: "Push failed: no connected repository selected." };
    }

    const commitMessage = (commandText || "").trim().slice(0, 180) || "chore: sync workspace from AI agent";
    const baseline = repoBaselineRef.current;

    const allFiles = {
      ...fileContentsRef.current,
      ...(selectedFile && fileContent ? { [selectedFile]: fileContent } : {}),
    };

    const changes = Object.entries(allFiles)
      .filter(([path, content]) => baseline[path] !== content)
      .map(([path, content]) => ({ path, content }));

    const deletedFiles = Object.keys(baseline).filter((path) => allFiles[path] === undefined);
    const shouldRedeploy = /\b(deploy|redeploy|ship|publish)\b/i.test(commandText || "");

    if (changes.length === 0 && deletedFiles.length === 0 && !shouldRedeploy) {
      setTerminalOutput((prev) => [...prev, "[Push skipped: No file changes detected]"]);
      return { message: "No file changes to push." };
    }

    setIsCommitting(true);
    setTerminalOutput((prev) => [...prev, `[Push] Syncing ${changes.length} change(s), ${deletedFiles.length} deletion(s)...`]);

    try {
      const response = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository,
          message: commitMessage,
          changes: changes.map((change) => ({
            path: change.path.replace(/^\//, ""),
            content: change.content,
          })),
          deletedFiles: deletedFiles.map((path) => path.replace(/^\//, "")),
          redeploy: shouldRedeploy,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const err = data?.error || "Failed to sync repository";
        setTerminalOutput((prev) => [...prev, `[Push failed: ${err}]`]);
        return { message: `Push failed: ${err}` };
      }

      repoBaselineRef.current = { ...allFiles };

      const deployNote = shouldRedeploy
        ? (data?.redeployTriggered ? " Redeploy triggered." : ` ${data?.redeployInfo || "Redeploy not triggered."}`)
        : "";

      const summary = `Pushed ${data?.updatedCount ?? changes.length} file(s) and deleted ${data?.deletedCount ?? deletedFiles.length} file(s).${deployNote}`;
      setTerminalOutput((prev) => [...prev, `[Push] ${summary}`]);
      return { message: summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error";
      setTerminalOutput((prev) => [...prev, `[Push failed: ${message}]`]);
      return { message: `Push failed: ${message}` };
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCmdKExecute = async () => {
    if (!cmdKInstruction.trim() || !selectedFile) return;

    setCmdKLoading(true);
    setCmdKResult("");

    try {
      const response = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: fileContent,
          instruction: cmdKInstruction,
          model: "gemini",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCmdKResult(data.completion || "");
      } else {
        setCmdKResult("Failed to generate edit. Please try again.");
      }
    } catch (error) {
      console.error("Cmd+K error:", error);
      setCmdKResult("Error generating edit. Please try again.");
    } finally {
      setCmdKLoading(false);
    }
  };

  const handleCmdKApply = () => {
    if (cmdKResult && selectedFile) {
      setFileContent(cmdKResult);
      fileContentsRef.current[selectedFile] = cmdKResult;
      setShowCmdK(false);
      setCmdKInstruction("");
      setCmdKResult("");
    }
  };

  const handleAIChat = async (
    message: string,
    context?: any[],
    apiKey?: string,
    model: "gemini" | "claude" | "openrouter" = "gemini",
    providerModel?: string
  ) => {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "chat",
        message,
        model,
        apiKey,
        providerModel,
        context,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "AI chat failed");
    }

    return data?.response || "No response received from AI.";
  };

  const handleAIApplyCode = (code: string, language?: string) => {
    const pickDefaultFilePath = (lang?: string) => {
      const normalized = (lang || "").toLowerCase();
      if (["cpp", "c++", "cc", "cxx", "hpp", "h"].includes(normalized)) return "/main.cpp";
      if (["c"].includes(normalized)) return "/main.c";
      if (["python", "py"].includes(normalized)) return "/main.py";
      if (["javascript", "js", "node"].includes(normalized)) return "/src/main.js";
      if (["typescript", "ts", "tsx"].includes(normalized)) return "/src/main.ts";
      if (["html", "htm"].includes(normalized)) return "/index.html";
      if (["java"].includes(normalized)) return "/Main.java";
      if (["rust", "rs"].includes(normalized)) return "/src/main.rs";
      return "/src/main.txt";
    };

    if (!selectedFile) {
      pushAIApplySnapshot();
      const targetPath = pickDefaultFilePath(language);
      createOrUpdateFile(targetPath, code);
      setActiveTab("preview");
      setPreviewMode("editor");
      setTerminalOutput((prev) => [...prev, `[AI created and applied code to ${normalizePath(targetPath)}]`]);
      return [normalizePath(targetPath)];
    }

    pushAIApplySnapshot();
    setFileContent(code);
    fileContentsRef.current[selectedFile] = code;
    setActiveTab("preview");
    setPreviewMode("editor");
    setTerminalOutput((prev) => [...prev, `[AI applied code to ${selectedFile}]`]);
    return [selectedFile];
  };

  const handleAIAutoApplyMultiFile = (edits: Array<{ filePath: string; content: string }>) => {
    if (edits.length === 0) return [];

    pushAIApplySnapshot();

    edits.forEach((edit) => {
      const normalized = normalizePath(edit.filePath);
      createOrUpdateFile(normalized, edit.content);
      fileContentsRef.current[normalized] = edit.content;
    });

    const firstFile = normalizePath(edits[0].filePath);
    setSelectedFile(firstFile);
    setFileContent(fileContentsRef.current[firstFile] || "");
    setActiveTab("preview");
    setPreviewMode("editor");
    setTerminalOutput((prev) => [...prev, `[AI auto-applied ${edits.length} files to editor]`]);
    return edits.map((edit) => normalizePath(edit.filePath));
  };

  const handleAIAutoApplyWorkspacePlan = (plan: { folders: string[]; files: Array<{ filePath: string; content: string }>; deletedFiles: string[] }) => {
    const { folders, files: planFiles, deletedFiles } = plan;
    if (folders.length === 0 && planFiles.length === 0 && deletedFiles.length === 0) return [];

    pushAIApplySnapshot();

    folders.forEach((folderPath) => {
      createFolderPath(folderPath);
    });

    planFiles.forEach((file) => {
      const normalized = normalizePath(file.filePath);
      createOrUpdateFile(normalized, file.content);
      fileContentsRef.current[normalized] = file.content;
    });

    deletedFiles.forEach((filePath) => {
      const normalized = normalizePath(filePath);
      setFiles((prev) => deleteFromTree(prev, normalized));
      const nextContents: Record<string, string> = {};
      Object.entries(fileContentsRef.current).forEach(([itemPath, content]) => {
        if (!(itemPath === normalized || itemPath.startsWith(`${normalized}/`))) {
          nextContents[itemPath] = content;
        }
      });
      fileContentsRef.current = nextContents;

      if (selectedFile && (selectedFile === normalized || selectedFile.startsWith(`${normalized}/`))) {
        setSelectedFile(null);
        setFileContent("");
      }
    });

    if (planFiles.length > 0) {
      const firstFile = normalizePath(planFiles[0].filePath);
      setSelectedFile(firstFile);
      setFileContent(fileContentsRef.current[firstFile] || "");
    }

    setActiveTab("preview");
    setPreviewMode("editor");
    setTerminalOutput((prev) => [...prev, `[AI applied workspace plan: ${folders.length} folder(s), ${planFiles.length} file(s), ${deletedFiles.length} deletion(s)]`]);
    return [
      ...folders.map((folderPath) => `📁 ${normalizePath(folderPath)}`),
      ...planFiles.map((file) => normalizePath(file.filePath)),
      ...deletedFiles.map((filePath) => `🗑️ ${normalizePath(filePath)}`),
    ];
  };

  const getLanguage = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "py":
        return "python";
      case "json":
        return "json";
      case "md":
        return "markdown";
      default:
        return "text";
    }
  };

  const focusEditor = () => {
    setShowLeftPanel(false);
    setShowRightPanel(false);
    setShowBottomPanel(false);
    setIsChatMaximized(false);
  };

  const restoreLayout = () => {
    setShowLeftPanel(true);
    setShowRightPanel(true);
    setShowBottomPanel(true);
  };

  const toggleChatMaximize = () => {
    if (!showBottomPanel) {
      setShowBottomPanel(true);
    }

    if (isChatMaximized) {
      setBottomPanelHeight(previousBottomHeight.current || 250);
      setIsChatMaximized(false);
      return;
    }

    previousBottomHeight.current = bottomPanelHeight;
    setBottomPanelHeight(Math.max(300, Math.floor(window.innerHeight * 0.7)));
    setIsChatMaximized(true);
  };

  const escapeHtml = (input: string) => {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const buildEditorPreviewDoc = () => {
    if (!selectedFile) {
      return `<!doctype html><html><body style="font-family: sans-serif; padding: 16px;">No file selected.</body></html>`;
    }

    const ext = selectedFile.split(".").pop()?.toLowerCase() || "";
    if (ext === "html" || ext === "htm") {
      return fileContent || "<!doctype html><html><body></body></html>";
    }

    return `<!doctype html>
<html>
  <body style="margin:0; background:#f5f5f5; color:#000; font-family:'JetBrains Mono', monospace;">
    <div style="padding:12px; border-bottom:2px solid #000; background:#fff; font-weight:700;">${escapeHtml(selectedFile)}</div>
    <pre style="margin:0; padding:12px; white-space:pre-wrap; word-break:break-word;">${escapeHtml(fileContent || "")}</pre>
  </body>
</html>`;
  };

  const isWebPreviewableFromEditor = () => {
    if (!selectedFile) return false;
    const ext = selectedFile.split(".").pop()?.toLowerCase() || "";
    return ext === "html" || ext === "htm";
  };

  const isRunnableCodeFile = () => {
    if (!selectedFile) return false;
    const ext = selectedFile.split(".").pop()?.toLowerCase() || "";
    return ["cpp", "cc", "cxx", "c", "py", "js", "java", "rs"].includes(ext);
  };

  // ── Workspace live-preview builder ─────────────────────────────────────────
  const resolveAssetPath = (baseHtmlPath: string, href: string): string => {
    if (!href || href.startsWith("http") || href.startsWith("//") || href.startsWith("data:")) return "";
    const stripped = href.replace(/^\.\//, "");
    if (stripped.startsWith("/")) return stripped;
    const dir = baseHtmlPath.substring(0, baseHtmlPath.lastIndexOf("/"));
    const parts = `${dir}/${stripped}`.split("/").filter(Boolean);
    const resolved: string[] = [];
    for (const p of parts) {
      if (p === "..") resolved.pop();
      else if (p !== ".") resolved.push(p);
    }
    return "/" + resolved.join("/");
  };

  const buildWorkspacePreviewDoc = (): { doc: string; entryFile: string | null; fileCount: number; isFramework: boolean } => {
    // Merge saved files with the currently open file so preview works even before an explicit save
    const allFiles = {
      ...fileContentsRef.current,
      ...(selectedFile && fileContent ? { [selectedFile]: fileContent } : {}),
    };
    const paths = Object.keys(allFiles);
    const fileCount = paths.length;

    // Detect framework projects (cannot inline-build these)
    const isFramework = paths.some((p) =>
      p.endsWith("package.json") ||
      p.endsWith("next.config.ts") ||
      p.endsWith("next.config.js") ||
      p.endsWith("vite.config.ts") ||
      p.endsWith("vite.config.js")
    );

    // Find entry HTML
    const priorities = ["/index.html", "/public/index.html", "/src/index.html", "/dist/index.html"];
    let entryPath: string | null = priorities.find((p) => allFiles[p] !== undefined) ?? null;
    if (!entryPath) {
      entryPath = paths.find((p) => p.endsWith(".html") || p.endsWith(".htm")) ?? null;
    }

    if (!entryPath) {
      return { doc: "", entryFile: null, fileCount, isFramework };
    }

    let html = allFiles[entryPath];

    // Inline <link rel="stylesheet" href="..."> → <style>
    html = html.replace(
      /<link([^>]*)>/gi,
      (match, attrs: string) => {
        if (!/rel=["']stylesheet["']/i.test(attrs)) return match;
        const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
        if (!hrefMatch) return match;
        const resolved = resolveAssetPath(entryPath!, hrefMatch[1]);
        if (!resolved || allFiles[resolved] === undefined) return match;
        return `<style>${allFiles[resolved]}</style>`;
      }
    );

    // Inline <script src="..."> → <script> inline (skip CDN/external)
    html = html.replace(
      /<script([^>]*)>[\s\S]*?<\/script>/gi,
      (match, attrs: string) => {
        const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
        if (!srcMatch) return match;
        const src = srcMatch[1];
        if (src.startsWith("http") || src.startsWith("//")) return match; // keep CDN
        const resolved = resolveAssetPath(entryPath!, src);
        if (!resolved || allFiles[resolved] === undefined) return match;
        const remainingAttrs = attrs.replace(/src=["'][^"']+["']/i, "").trim();
        return `<script ${remainingAttrs}>${allFiles[resolved]}</script>`;
      }
    );

    return { doc: html, entryFile: entryPath, fileCount, isFramework };
  };

  const buildLivePreviewDoc = () => {
    if (!selectedFile) {
      return `<!doctype html><html><body style="font-family: sans-serif; padding: 16px;">No file selected.</body></html>`;
    }

    const ext = selectedFile.split(".").pop()?.toLowerCase() || "";

    if (ext === "html" || ext === "htm") {
      return fileContent || "<!doctype html><html><body></body></html>";
    }

    if (ext === "css") {
      return `<!doctype html>
<html>
  <head>
    <style>${fileContent}</style>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 20px;">
    <h2>Live CSS Preview</h2>
    <p>Edit your CSS file to see changes instantly.</p>
    <div class="preview-card">Preview card</div>
    <button class="preview-btn">Preview button</button>
  </body>
</html>`;
    }

    if (ext === "js" || ext === "jsx") {
      return `<!doctype html>
<html>
  <body style="font-family: system-ui, sans-serif; padding: 20px;">
    <h2>Live JavaScript Preview</h2>
    <p>Output:</p>
    <pre id="output" style="padding: 12px; border: 1px solid #ccc; background: #fafafa;"></pre>
    <script>
      const output = document.getElementById("output");
      try {
${fileContent}
        if (typeof result !== "undefined") {
          output.textContent = String(result);
        } else if (!output.textContent) {
          output.textContent = "Script executed successfully.";
        }
      } catch (error) {
        output.textContent = String(error);
      }
    </script>
  </body>
</html>`;
    }

    return `<!doctype html>
<html>
  <body style="margin:0; background:#f5f5f5; color:#000; font-family:'JetBrains Mono', monospace;">
    <div style="padding:12px; border-bottom:2px solid #000; background:#fff; font-weight:700;">${escapeHtml(selectedFile)}</div>
    <pre style="margin:0; padding:12px; white-space:pre-wrap; word-break:break-word;">${escapeHtml(fileContent || "")}</pre>
  </body>
</html>`;
  };

  const runCodeReview = async () => {
    if (!selectedFile) return;

    setIsReviewingCode(true);
    setReviewFindings([]);
    setReviewSummary("");
    setReviewRawResponse("");

    try {
      const reviewPrompt = `You are CodeRabbit-style reviewer. Review this file for bugs, regressions, security, and maintainability.\n\nFile: ${selectedFile}\n\nReturn ONLY one JSON object in this format:\n{\"summary\":\"one short paragraph\",\"findings\":[{\"severity\":\"critical|major|minor|nit\",\"title\":\"...\",\"line\":123,\"explanation\":\"...\",\"suggestion\":\"...\"}]}.\n\nCode:\n${fileContent}`;

      const response = await handleAIChat(reviewPrompt, selectedFile ? [{ type: "file", data: { filePath: selectedFile, content: fileContent } }] : [], undefined, "gemini");
      setReviewRawResponse(response);

      const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const jsonCandidate = jsonBlockMatch ? jsonBlockMatch[1] : response;

      try {
        const parsed = JSON.parse(jsonCandidate);
        const parsedSummary = typeof parsed?.summary === "string" ? parsed.summary : "Review complete.";
        const findings = Array.isArray(parsed?.findings) ? parsed.findings : [];
        const normalizedFindings: ReviewFinding[] = findings
          .map((finding: any) => {
            const severity = ["critical", "major", "minor", "nit"].includes(String(finding?.severity))
              ? (finding.severity as "critical" | "major" | "minor" | "nit")
              : "minor";
            const title = typeof finding?.title === "string" ? finding.title : "Issue";
            const line = typeof finding?.line === "number" ? finding.line : undefined;
            const explanation = typeof finding?.explanation === "string" ? finding.explanation : "No explanation provided.";
            const suggestion = typeof finding?.suggestion === "string" ? finding.suggestion : undefined;
            return { severity, title, line, explanation, suggestion };
          })
          .slice(0, 30);

        setReviewSummary(parsedSummary);
        setReviewFindings(normalizedFindings);
      } catch {
        setReviewSummary("Review complete, but response was not strict JSON.");
      }

      setActiveTab("review");
      setTerminalOutput((prev) => [...prev, `[AI review complete for ${selectedFile}]`]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Review failed";
      setReviewSummary("Review failed. See details below.");
      setReviewRawResponse(message);
      setTerminalOutput((prev) => [...prev, `[AI review failed: ${message}]`]);
    } finally {
      setIsReviewingCode(false);
    }
  };

  const jumpToReviewLine = useCallback((line?: number) => {
    if (!selectedFile || typeof line !== "number" || Number.isNaN(line) || line < 1) {
      return;
    }

    setJumpToLine(line);
    setJumpToLineSignal((prev) => prev + 1);
    setShowBottomPanel(true);
    setActiveTab("review");
    setTerminalOutput((prev) => [...prev, `[Review] Jumped editor cursor to ${selectedFile}:${line}`]);
  }, [selectedFile]);

  const runCurrentFilePreview = async () => {
    if (!selectedFile) return;

    setIsRunningPreviewCode(true);
    setRunOutput("");
    setRunError("");

    try {
      const response = await fetch("/api/webcontainer/run-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: selectedFile, code: fileContent }),
      });

      const data = await response.json();
      if (!response.ok) {
        setRunError(data?.error || "Failed to run current file");
        return;
      }

      const stdout = typeof data?.stdout === "string" ? data.stdout : "";
      const stderr = typeof data?.stderr === "string" ? data.stderr : "";
      const exitCode = typeof data?.exitCode === "number" ? data.exitCode : 0;

      setRunOutput(`${stdout}${stderr ? `\n${stderr}` : ""}\n[exit ${exitCode}]`.trim());
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Failed to run current file");
    } finally {
      setIsRunningPreviewCode(false);
    }
  };

  const handleShareWorkspace = async () => {
    if (isSharing) return;

    setIsSharing(true);
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      const text = selectedFile
        ? `NeoForge IDE session (${selectedFile})`
        : "NeoForge IDE session";

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "NeoForge IDE",
          text,
          url,
        });
        setTerminalOutput((prev) => [...prev, "[Share] Shared current IDE link"]);
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url || text);
        setTerminalOutput((prev) => [...prev, "[Share] Link copied to clipboard"]);
        return;
      }

      if (typeof window !== "undefined") {
        window.prompt("Copy this link", url || text);
      }
      setTerminalOutput((prev) => [...prev, "[Share] Manual copy opened"]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Share failed";
      setTerminalOutput((prev) => [...prev, `[Share] ${message}`]);
    } finally {
      setIsSharing(false);
    }
  };

  const downloadCurrentFile = async () => {
    if (!selectedFile) return;
    const content = fileContentsRef.current[selectedFile] ?? fileContent;
    const zip = new JSZip();
    const fileName = selectedFile.split("/").pop() || "file";
    zip.file(fileName, content);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setShowShareMenu(false);
  };

  const downloadCodebase = async () => {
    const zip = new JSZip();
    const allFiles = fileContentsRef.current;
    const fileEntries = Object.entries(allFiles);
    if (fileEntries.length === 0) {
      // fallback: at least add the current open file
      if (selectedFile) zip.file(selectedFile.replace(/^\//, ""), fileContent);
    } else {
      for (const [path, content] of fileEntries) {
        zip.file(path.replace(/^\//, ""), content);
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codebase.zip";
    a.click();
    URL.revokeObjectURL(url);
    setShowShareMenu(false);
  };

  const safePreviewUrl = previewUrl.trim();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted">
      <header className="flex h-12 items-center justify-between border-b-4 border-black bg-white px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            title="Go back"
            className="shrink-0 rounded border-2 border-black p-1 hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Badge variant="secondary" className="shrink-0">main</Badge>
          <span className="truncate text-sm font-medium">{selectedFile || "No file selected"}</span>
        </div>
        
        <div className="flex shrink-0 items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowCmdK(true)}
            className="gap-2 text-muted-foreground"
          >
            <span className="text-xs">⌘K</span>
          </Button>
          <div className="flex items-center gap-2 rounded-xl border-2 border-black bg-white px-2 py-1 shadow-[4px_4px_0px_0px_#000]">
            <button
              type="button"
              aria-label={showLeftPanel ? "Collapse explorer" : "Expand explorer"}
              title={showLeftPanel ? "Collapse explorer" : "Expand explorer"}
              onClick={() => setShowLeftPanel((value) => !value)}
              className={`flex h-8 w-8 items-center justify-center rounded-md border-2 border-black transition-colors ${showLeftPanel ? "bg-primary text-black" : "bg-white text-muted-foreground"}`}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Focus editor"
              title="Focus editor"
              onClick={() => {
                if (!showLeftPanel && !showRightPanel && !showBottomPanel) {
                  restoreLayout();
                } else {
                  focusEditor();
                }
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-md border-2 border-black transition-colors ${!showLeftPanel && !showRightPanel && !showBottomPanel ? "bg-primary text-black" : "bg-white text-muted-foreground"}`}
            >
              {!showLeftPanel && !showRightPanel && !showBottomPanel ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            {!showBottomPanel && (
              <button
                type="button"
                aria-label="Expand bottom panel"
                title="Expand bottom panel"
                onClick={() => setShowBottomPanel(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-black bg-white text-muted-foreground transition-colors"
              >
                <TerminalIcon className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label={isChatMaximized ? "Restore bottom panel" : "Maximize bottom panel"}
              title={isChatMaximized ? "Restore bottom panel" : "Maximize bottom panel"}
              onClick={toggleChatMaximize}
              className={`flex h-8 w-8 items-center justify-center rounded-md border-2 border-black transition-colors ${isChatMaximized ? "bg-primary text-black" : "bg-white text-muted-foreground"}`}
            >
              {isChatMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              aria-label={showRightPanel ? "Collapse right panel" : "Expand right panel"}
              title={showRightPanel ? "Collapse right panel" : "Expand right panel"}
              onClick={() => setShowRightPanel((value) => !value)}
              className={`flex h-8 w-8 items-center justify-center rounded-md border-2 border-black transition-colors ${showRightPanel ? "bg-primary text-black" : "bg-white text-muted-foreground"}`}
            >
              <PanelRight className="h-4 w-4" />
            </button>
          </div>
          <span className="text-sm text-muted-foreground">
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
          <Button variant="ghost" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCommitToGitHub} disabled={isCommitting}>
            {isCommitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCommit className="h-4 w-4" />}
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShareMenu((v) => !v)}
              aria-label="Share / download"
              title="Share / download"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {showShareMenu && (
              <>
                {/* backdrop to close menu */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowShareMenu(false)}
                />
                <div className="absolute right-0 top-9 z-50 min-w-[200px] rounded-lg border-2 border-black bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={handleShareWorkspace}
                    disabled={isSharing}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted disabled:opacity-40"
                  >
                    {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Share link
                  </button>
                  <button
                    type="button"
                    onClick={downloadCurrentFile}
                    disabled={!selectedFile}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                    Download current file
                  </button>
                  <button
                    type="button"
                    onClick={downloadCodebase}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <FolderArchive className="h-4 w-4" />
                    Download codebase (.zip)
                  </button>
                </div>
              </>
            )}
          </div>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {showLeftPanel && (
          <>
            <aside 
              className="shrink-0 border-r-2 border-black bg-white"
              style={{ width: leftPanelWidth }}
            >
              <FileExplorer
                files={files}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onFileCreate={handleFileCreate}
                onFileRename={handleFileRename}
                onFileDelete={handleFileDelete}
                className="h-full rounded-none border-0"
              />
            </aside>
            <div
              className="w-1.5 cursor-col-resize border-l-2 border-black bg-muted/60 hover:bg-primary"
              onMouseDown={(e) => {
                e.preventDefault();
                isResizingLeft.current = true;
                setResizeCursor("col-resize");
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
              }}
            />
          </>
        )}

        <div ref={centerColumnRef} className="relative flex flex-1 flex-col overflow-hidden">
          <div
            className="flex-1 overflow-hidden"
            style={{ height: showBottomPanel ? `calc(100% - ${bottomPanelHeight}px)` : "100%" }}
          >
            {selectedFile ? (
              <CodeEditor
                value={fileContent}
                onChange={setFileContent}
                language={getLanguage(selectedFile)}
                onCursorChange={setCursorPosition}
                onSave={handleSave}
                jumpToLine={jumpToLine}
                jumpToLineSignal={jumpToLineSignal}
                className="h-full rounded-none border-0"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-white">
                <p className="text-muted-foreground">No files yet. Ask AI to generate code and click Apply To Editor.</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const path = window.prompt("Create file path", "/src/App.tsx");
                    if (path) {
                      createOrUpdateFile(path, "");
                    }
                  }}
                >
                  Create First File
                </Button>
              </div>
            )}
          </div>

          {showBottomPanel && (
            <div
              className="relative z-10 h-3 cursor-row-resize border-t-2 border-black bg-muted/60 hover:bg-primary"
              onMouseDown={(e) => {
                e.preventDefault();
                isResizingBottom.current = true;
                setResizeCursor("row-resize");
                document.body.style.cursor = "row-resize";
                document.body.style.userSelect = "none";
              }}
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-black/60">
                <GripVertical className="h-3 w-3" />
              </div>
            </div>
          )}

          <div
            className="shrink-0 border-t-4 border-black bg-white"
            style={{
              height: showBottomPanel ? bottomPanelHeight : 0,
              display: showBottomPanel ? "block" : "none",
            }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full min-h-0 flex-col">
              <div className="flex items-center border-b-4 border-black px-2">
                <TabsList className="flex w-full items-center border-0 bg-transparent">
                  <TabsTrigger value="terminal" className="flex items-center gap-2">
                    <TerminalIcon className="h-4 w-4" />
                    Terminal
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="output" className="flex items-center gap-2">
                    <SquareTerminal className="h-4 w-4" />
                    Output
                  </TabsTrigger>
                  <TabsTrigger value="debug" className="flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Debug
                  </TabsTrigger>
                  <TabsTrigger value="review" className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Review
                  </TabsTrigger>
                  <button
                    type="button"
                    aria-label="Collapse bottom panel"
                    title="Collapse bottom panel"
                    onClick={() => {
                      setShowBottomPanel(false);
                      setIsChatMaximized(false);
                    }}
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-md border-2 border-black bg-white text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </TabsList>
              </div>
              
              <TabsContent value="terminal" className="m-0 min-h-0 flex-1">
                <TerminalComponent
                  onCommand={handleCommand}
                  output={terminalOutput}
                  isExecuting={isExecuting}
                  className="h-full rounded-none border-0"
                />
              </TabsContent>

              <TabsContent value="preview" className="m-0 min-h-0 flex-1 p-2">
                {(() => {
                  const ws = previewMode === "app" ? buildWorkspacePreviewDoc() : null;
                  return (
                    <div className="flex h-full flex-col gap-2 rounded-lg border-4 border-black bg-white p-2">
                      {/* Mode selector */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" size="sm" variant={previewMode === "app" ? "primary" : "outline"} onClick={() => setPreviewMode("app")}>
                          Live Workspace
                        </Button>
                        <Button type="button" size="sm" variant={previewMode === "editor" ? "primary" : "outline"} onClick={() => setPreviewMode("editor")}>
                          Dev Server
                        </Button>
                        <Button type="button" size="sm" variant={(previewMode as string) === "file" ? "primary" : "outline"} onClick={() => setPreviewMode("editor" as any)}>
                          File
                        </Button>
                        {previewMode === "app" && (
                          <button
                            type="button"
                            className="ml-auto flex h-7 w-7 items-center justify-center rounded border border-black/20 hover:bg-muted"
                            title="Refresh preview"
                            onClick={() => setPreviewRefreshSignal((n) => n + 1)}
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                          </button>
                        )}
                      </div>

                      {/* Live Workspace mode */}
                      {previewMode === "app" && (() => {
                        if (!ws) return null;
                        const { doc, entryFile, fileCount, isFramework } = ws;
                        const fallbackDoc = buildLivePreviewDoc();

                        if (isFramework && !doc) {
                          return (
                            <>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-800">framework fallback preview</span>
                                <span>Run your dev server for full app rendering.</span>
                              </div>
                              <iframe
                                key={previewRefreshSignal}
                                title="Live Workspace Preview"
                                srcDoc={fallbackDoc}
                                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                                className="min-h-0 flex-1 w-full rounded-md border-2 border-black bg-white"
                              />
                            </>
                          );
                        }

                        if (!entryFile) {
                          return (
                            <>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="rounded bg-muted px-1.5 py-0.5">no html entry</span>
                                <span>Showing file-level preview fallback.</span>
                              </div>
                              <iframe
                                key={previewRefreshSignal}
                                title="Live Workspace Preview"
                                srcDoc={fallbackDoc}
                                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                                className="min-h-0 flex-1 w-full rounded-md border-2 border-black bg-white"
                              />
                            </>
                          );
                        }

                        return (
                          <>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{entryFile}</span>
                              <span>{fileCount} file{fileCount !== 1 ? "s" : ""} in workspace</span>
                              {isFramework && <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-800">framework — static preview only</span>}
                            </div>
                            <iframe
                              key={previewRefreshSignal}
                              title="Live Workspace Preview"
                              srcDoc={doc}
                              sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                              className="min-h-0 flex-1 w-full rounded-md border-2 border-black bg-white"
                            />
                          </>
                        );
                      })()}

                      {/* Dev Server mode */}
                      {previewMode === "editor" && (
                        <>
                          <div className="flex items-center gap-2">
                            <Input
                              value={previewUrl}
                              onChange={(e) => setPreviewUrl(e.target.value)}
                              placeholder="http://localhost:3000"
                            />
                            <Button type="button" variant="outline" onClick={() => setPreviewUrl((prev) => prev.trim() || "http://localhost:3000")}>
                              Open
                            </Button>
                          </div>
                          {safePreviewUrl ? (
                            <iframe
                              key={safePreviewUrl}
                              title="Dev Server Preview"
                              src={safePreviewUrl}
                              className="min-h-0 flex-1 w-full rounded-md border-2 border-black bg-white"
                            />
                          ) : (
                            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border-2 border-black bg-muted text-sm text-muted-foreground">
                              <p>Enter your dev server URL above and press Open.</p>
                              <p className="text-xs">Run <code className="rounded bg-black/10 px-1">npm run dev</code> in the Terminal first.</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="output" className="m-0 min-h-0 flex-1 p-2">
                <div className="flex h-full flex-col gap-2 rounded-lg border-4 border-black bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SquareTerminal className="h-4 w-4" />
                      <p className="text-sm font-bold">Output</p>
                      {selectedFile && <span className="text-xs text-muted-foreground">{selectedFile}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {(runOutput || runError) && (
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded border border-black/20 hover:bg-muted"
                          title="Clear output"
                          onClick={() => { setRunOutput(""); setRunError(""); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={runCurrentFilePreview}
                        disabled={!isRunnableCodeFile() || isRunningPreviewCode}
                      >
                        {isRunningPreviewCode ? (
                          <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Running...</>
                        ) : (
                          <><Play className="mr-1 h-3.5 w-3.5" />Run File</>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto rounded-md border-2 border-black bg-black p-3 font-mono text-xs">
                    {!runOutput && !runError && !isRunningPreviewCode && (
                      <p className="text-white/40">{isRunnableCodeFile() ? "Press Run File to execute the current file." : "Select a runnable file (.py, .js, .cpp, .c, .java, .rs) to run it."}</p>
                    )}
                    {isRunningPreviewCode && (
                      <p className="text-yellow-400">Running...</p>
                    )}
                    {runError && (
                      <pre className="whitespace-pre-wrap text-red-400">{runError}</pre>
                    )}
                    {runOutput && (
                      <pre className="whitespace-pre-wrap text-green-300">{runOutput}</pre>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="debug" className="m-0 min-h-0 flex-1 p-2">
                <div className="flex h-full flex-col gap-2 rounded-lg border-4 border-black bg-white p-3">
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    <p className="text-sm font-bold">Debug</p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto rounded-md border-2 border-black bg-black p-3 font-mono text-xs">
                    {terminalOutput.length === 0 ? (
                      <p className="text-white/40">No debug output yet. Terminal errors and stderr will appear here.</p>
                    ) : (
                      terminalOutput
                        .filter((line) => {
                          const l = line.toLowerCase();
                          return l.startsWith("[error]") || l.startsWith("[stderr]") || l.startsWith("[exit") || l.startsWith("[ai") || l.startsWith("[review") || l.startsWith("[commit") || l.startsWith("[share");
                        })
                        .map((line, i) => {
                          const l = line.toLowerCase();
                          const colour = l.startsWith("[error]") || l.startsWith("[stderr]") ? "text-red-400" :
                            l.startsWith("[exit") ? "text-yellow-400" :
                            "text-blue-300";
                          return (
                            <p key={i} className={`whitespace-pre-wrap ${colour}`}>{line}</p>
                          );
                        })
                    )}
                    {terminalOutput.filter((line) => {
                      const l = line.toLowerCase();
                      return l.startsWith("[error]") || l.startsWith("[stderr]") || l.startsWith("[exit") || l.startsWith("[ai") || l.startsWith("[review") || l.startsWith("[commit") || l.startsWith("[share");
                    }).length === 0 && terminalOutput.length > 0 && (
                      <p className="text-white/40">No errors or warnings in the current session.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="review" className="m-0 min-h-0 flex-1 p-2">
                <div className="flex h-full flex-col gap-3 rounded-lg border-4 border-black bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">Code Review</p>
                      <p className="text-xs text-muted-foreground">CodeRabbit-style findings for the active file.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={runCodeReview}
                      disabled={!selectedFile || isReviewingCode}
                    >
                      {isReviewingCode ? "Reviewing..." : "Run Review"}
                    </Button>
                  </div>

                  <div className="rounded-md border-2 border-black bg-muted p-3">
                    <p className="text-xs font-bold">Summary</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {reviewSummary || (selectedFile ? "Run review to generate findings." : "Select a file to review.")}
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                    {reviewFindings.length === 0 ? (
                      <div className="rounded-md border-2 border-dashed border-black p-3 text-sm text-muted-foreground">
                        No structured findings yet.
                      </div>
                    ) : (
                      reviewFindings.map((finding, idx) => (
                        <button
                          key={`${finding.title}-${idx}`}
                          type="button"
                          className="w-full rounded-md border-2 border-black p-3 text-left hover:bg-muted"
                          onClick={() => jumpToReviewLine(finding.line)}
                          disabled={typeof finding.line !== "number"}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-sm font-bold">{finding.title}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{finding.severity.toUpperCase()}</Badge>
                              {typeof finding.line === "number" && <Badge variant="default">Line {finding.line}</Badge>}
                            </div>
                          </div>
                          <p className="text-xs whitespace-pre-wrap">{finding.explanation}</p>
                          {finding.suggestion && (
                            <p className="mt-2 rounded bg-muted px-2 py-1 text-xs whitespace-pre-wrap">
                              Suggestion: {finding.suggestion}
                            </p>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {reviewRawResponse && reviewFindings.length === 0 && (
                    <div className="rounded-md border-2 border-black bg-muted p-3">
                      <p className="text-xs font-bold">Raw Review Output</p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{reviewRawResponse}</pre>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {showRightPanel && (
          <>
            <div
              className="w-1.5 cursor-col-resize border-l-2 border-black bg-muted/60 hover:bg-primary"
              onMouseDown={(e) => {
                e.preventDefault();
                isResizingRight.current = true;
                setResizeCursor("col-resize");
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
              }}
            />
            <aside 
              className="shrink-0 border-l-4 border-black bg-white"
              style={{ width: rightPanelWidth }}
            >
              <div className="h-full p-2">
                <AIChat
                  onSendMessage={handleAIChat}
                  onApplyCode={handleAIApplyCode}
                  onApplyMultiFile={handleAIAutoApplyMultiFile}
                  onApplyWorkspacePlan={handleAIAutoApplyWorkspacePlan}
                  onPushAndDeploy={handlePushWorkspaceToGitHub}
                  onGetEditorErrors={getEditorErrors}
                  onRevertLastApply={handleRevertLastAIApply}
                  canRevertLastApply={canRevertLastApply}
                  onPreviewDiff={openDiffPreview}
                  onPreviewMultiFile={openMultiFilePreview}
                  compact
                  initialContext={selectedFile ? [{ type: "file", data: { filePath: selectedFile, content: fileContent } }] : []}
                  className="h-full rounded-md border-2 border-black"
                />
              </div>
            </aside>
          </>
        )}
      </div>

      {resizeCursor && (
        <div
          className="fixed inset-0 z-[9999] bg-transparent"
          style={{ cursor: resizeCursor }}
          aria-hidden="true"
        />
      )}

      <Dialog open={showDiffPreview} onOpenChange={setShowDiffPreview}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden border-4 border-black">
          <DialogHeader>
            <DialogTitle>Diff Preview {diffTargetFilePath ? `- ${diffTargetFilePath}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-auto pr-1">
            {diffHunks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No code changes detected.</p>
            ) : (
              diffHunks.map((hunk) => (
                <div key={hunk.id} className="rounded-md border-2 border-black p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold">
                      Hunk {hunk.id + 1} at old line {hunk.oldStart}, new line {hunk.newStart}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant={hunk.accepted ? "primary" : "outline"}
                      onClick={() => toggleHunkAcceptance(hunk.id)}
                    >
                      {hunk.accepted ? "Accepted" : "Rejected"}
                    </Button>
                  </div>
                  <div className="space-y-1 rounded border-2 border-black bg-muted p-2">
                    {hunk.oldLines.map((line, idx) => (
                      <p key={`old-${hunk.id}-${idx}`} className="font-mono text-xs text-destructive">
                        - {line || " "}
                      </p>
                    ))}
                    {hunk.newLines.map((line, idx) => (
                      <p key={`new-${hunk.id}-${idx}`} className="font-mono text-xs text-success">
                        + {line || " "}
                      </p>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowDiffPreview(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyDiffPreview} disabled={!diffTargetFilePath}>
              Apply Selected Hunks
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMultiFilePreview} onOpenChange={setShowMultiFilePreview}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden border-4 border-black">
          <DialogHeader>
            <DialogTitle>Multi-file AI Edits</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-auto pr-1">
            {multiFileDrafts.map((draft) => (
              <div key={draft.filePath} className="rounded-md border-2 border-black p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">{draft.filePath}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant={draft.selected ? "primary" : "outline"}
                    onClick={() => toggleMultiFileSelection(draft.filePath)}
                  >
                    {draft.selected ? "Will Apply" : "Skip"}
                  </Button>
                </div>
                <pre className="max-h-48 overflow-auto rounded border-2 border-black bg-muted p-2 text-xs">
                  <code>{draft.content}</code>
                </pre>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowMultiFilePreview(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applySelectedMultiFileEdits}>
              Apply Selected Files
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCmdK} onOpenChange={setShowCmdK}>
        <DialogContent className="border-4 border-black">
          <DialogHeader>
            <DialogTitle>Quick Edit (⌘K)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Describe the change you want to make..."
              value={cmdKInstruction}
              onChange={(e) => setCmdKInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCmdKExecute();
                }
              }}
              disabled={cmdKLoading}
            />
            {cmdKLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating edit...</span>
              </div>
            )}
            {cmdKResult && (
              <div className="rounded-lg border-2 border-black bg-muted p-3 max-h-60 overflow-auto">
                <pre className="text-sm whitespace-pre-wrap">{cmdKResult}</pre>
              </div>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowCmdK(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCmdKExecute}
                disabled={!cmdKInstruction.trim() || cmdKLoading}
                className="flex-1"
              >
                Generate
              </Button>
              {cmdKResult && (
                <Button 
                  onClick={handleCmdKApply}
                  className="flex-1"
                >
                  Apply
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}