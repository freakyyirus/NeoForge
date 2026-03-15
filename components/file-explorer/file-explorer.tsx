"use client";

import React, { useState, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit3,
  Copy,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
  isExpanded?: boolean;
}

interface FileExplorerProps {
  files: FileItem[];
  onFileSelect: (path: string) => void;
  onFileCreate: (parentPath: string, name: string, isDirectory: boolean) => void;
  onFileRename: (oldPath: string, newPath: string) => void;
  onFileDelete: (path: string) => void;
  selectedFile: string | null;
  className?: string;
}

const getFileIcon = (filename: string, isOpen?: boolean) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  
  if (filename.endsWith("/") || (isOpen !== undefined)) {
    return isOpen ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-primary" />;
  }

  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "py":
    case "rs":
    case "java":
    case "cpp":
    case "c":
    case "go":
      return <FileCode className="h-4 w-4 text-secondary" />;
    case "json":
      return <FileJson className="h-4 w-4 text-warning" />;
    case "md":
    case "txt":
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
      return <FileImage className="h-4 w-4 text-accent" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

interface FileTreeItemProps {
  item: FileItem;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  onStartCreate: (parentPath: string, isDirectory: boolean) => void;
  onCreate: (parentPath: string, name: string, isDirectory: boolean) => void;
  onRename: (oldPath: string, newPath: string) => void;
  onDelete: (path: string) => void;
}

function FileTreeItem({
  item,
  depth,
  selectedFile,
  onSelect,
  onToggle,
  onStartCreate,
  onCreate,
  onRename,
  onDelete,
}: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(item.isExpanded || false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [showContextMenu, setShowContextMenu] = useState(false);

  const handleClick = () => {
    if (item.isDirectory) {
      setIsExpanded(!isExpanded);
      onToggle(item.path);
    } else {
      onSelect(item.path);
    }
  };

  const handleRename = () => {
    if (editName && editName !== item.name) {
      const parentPath = item.path.slice(0, item.path.lastIndexOf("/"));
      const newPath = parentPath ? `${parentPath}/${editName}` : editName;
      onRename(item.path, newPath);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete(item.path);
    setShowContextMenu(false);
  };

  return (
    <div>
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 transition-colors",
          selectedFile === item.path
            ? "bg-primary/20 border-2 border-black"
            : "hover:bg-muted"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowContextMenu(true);
        }}
      >
        {item.isDirectory && (
          <span className="text-black">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
        {getFileIcon(item.name, isExpanded)}
        
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setIsEditing(false);
            }}
            className="h-6 py-0 text-sm"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
        )}
        
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            className="rounded p-0.5 hover:bg-black/10"
            onClick={(e) => {
              e.stopPropagation();
              onStartCreate(item.path, item.isDirectory);
            }}
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            className="rounded p-0.5 hover:bg-black/10"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setEditName(item.name);
            }}
          >
            <Edit3 className="h-3 w-3" />
          </button>
        </div>
      </div>
      
      {showContextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowContextMenu(false)} />
          <div className="absolute z-50 rounded-lg border-4 border-black bg-white p-1 shadow-[4px_4px_0px_0px_#000]">
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              onClick={() => {
                setIsEditing(true);
                setShowContextMenu(false);
              }}
            >
              <Edit3 className="h-4 w-4" />
              Rename
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-muted"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      )}
      
      {item.isDirectory && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem
              key={child.path}
              item={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelect={onSelect}
              onToggle={onToggle}
              onStartCreate={onStartCreate}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorer({
  files,
  onFileSelect,
  onFileCreate,
  onFileRename,
  onFileDelete,
  selectedFile,
  className,
}: FileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["/"]));
  const [createDraft, setCreateDraft] = useState<{
    parentPath: string;
    isDirectory: boolean;
  } | null>(null);
  const [createName, setCreateName] = useState("");

  const startCreate = useCallback((parentPath: string, isDirectory: boolean) => {
    setCreateDraft({ parentPath, isDirectory });
    setCreateName("");
  }, []);

  const commitCreate = useCallback(() => {
    if (!createDraft) return;
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateDraft(null);
      setCreateName("");
      return;
    }
    onFileCreate(createDraft.parentPath, trimmed, createDraft.isDirectory);
    setCreateDraft(null);
    setCreateName("");
  }, [createDraft, createName, onFileCreate]);

  const handleToggle = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandFileTree = (items: FileItem[], path = ""): FileItem[] => {
    return items.map((item) => ({
      ...item,
      isExpanded: expandedDirs.has(item.path),
      children: item.children ? expandFileTree(item.children, item.path) : undefined,
    }));
  };

  return (
    <div className={cn("flex h-full flex-col rounded-lg border-4 border-black bg-white", className)}>
      <div className="flex items-center justify-between border-b-4 border-black px-4 py-3">
        <h3 className="font-bold">EXPLORER</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startCreate("/", true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startCreate("/", false)}
          >
            <FileCode className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {createDraft && (
        <div className="border-b-2 border-black bg-muted/60 px-3 py-2">
          <div className="flex items-center gap-2 rounded border-2 border-black bg-white px-2 py-1">
            <span className="text-xs font-bold text-muted-foreground">
              {createDraft.isDirectory ? "New folder" : "New file"}
            </span>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCreate();
                if (e.key === "Escape") {
                  setCreateDraft(null);
                  setCreateName("");
                }
              }}
              placeholder={createDraft.isDirectory ? "folder-name" : "file-name.tsx"}
              className="h-7 border-0 p-0 text-sm focus-visible:ring-0"
              autoFocus
            />
            <Button variant="ghost" size="sm" onClick={commitCreate}>
              Create
            </Button>
          </div>
        </div>
      )}
      <ScrollArea className="flex-1 p-2">
        {expandFileTree(files).map((item) => (
          <FileTreeItem
            key={item.path}
            item={item}
            depth={0}
            selectedFile={selectedFile}
            onSelect={onFileSelect}
            onToggle={handleToggle}
            onStartCreate={startCreate}
            onCreate={onFileCreate}
            onRename={onFileRename}
            onDelete={onFileDelete}
          />
        ))}
      </ScrollArea>
    </div>
  );
}
