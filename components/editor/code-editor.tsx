"use client";

import React, { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput, foldKeymap, HighlightStyle } from "@codemirror/language";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, completionStatus, CompletionContext } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { tags } from "@lezer/highlight";
import { cn } from "../../lib/utils";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  className?: string;
  onCursorChange?: (position: { line: number; column: number }) => void;
  onSave?: () => void;
  jumpToLine?: number | null;
  jumpToLineSignal?: number;
}

const neoBrutalistTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  ".cm-content": {
    padding: "16px 0",
  },
  ".cm-gutters": {
    backgroundColor: "#F5F5F5",
    borderRight: "2px solid black",
    color: "#666",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#FFE600",
    color: "black",
    fontWeight: "bold",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 230, 0, 0.1)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "#0066FF !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "#0066FF !important",
  },
  ".cm-cursor": {
    borderLeftColor: "black",
    borderLeftWidth: "3px",
  },
  ".cm-foldGutter": {
    width: "16px",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "black",
    color: "white",
    border: "none",
    padding: "0 8px",
    fontWeight: "bold",
  },
});

const neoBrutalistHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#FF00FF", fontWeight: "bold" },
  { tag: tags.operator, color: "#000" },
  { tag: tags.special(tags.variableName), color: "#0066FF" },
  { tag: tags.typeName, color: "#00FF66" },
  { tag: tags.atom, color: "#FF9900" },
  { tag: tags.number, color: "#FF3333" },
  { tag: tags.definition(tags.variableName), color: "#0066FF" },
  { tag: tags.string, color: "#00FF66" },
  { tag: tags.special(tags.string), color: "#00FF66" },
  { tag: tags.comment, color: "#999", fontStyle: "italic" },
  { tag: tags.variableName, color: "#000" },
  { tag: tags.tagName, color: "#FF00FF" },
  { tag: tags.bracket, color: "#666" },
  { tag: tags.meta, color: "#FF9900" },
  { tag: tags.link, color: "#0066FF", textDecoration: "underline" },
  { tag: tags.heading, fontWeight: "bold", color: "#000" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
]);

function getLanguageExtension(lang: string) {
  switch (lang?.toLowerCase()) {
    case "javascript":
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return javascript({ jsx: true, typescript: lang?.startsWith("ts") });
    case "python":
    case "py":
      return python();
    case "html":
      return html();
    case "css":
      return css();
    case "json":
      return json();
    case "markdown":
    case "md":
      return markdown();
    case "rust":
    case "rs":
      return rust();
    case "java":
      return java();
    case "cpp":
    case "c":
    case "cpp":
      return cpp();
    default:
      return [];
  }
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  className,
  onCursorChange,
  onSave,
  jumpToLine = null,
  jumpToLineSignal = 0,
}: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
      if (update.selectionSet && onCursorChange) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        onCursorChange({
          line: line.number,
          column: pos - line.from + 1,
        });
      }
    });

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          onSave?.();
          return true;
        },
      },
    ]);

    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(neoBrutalistHighlight),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),
      neoBrutalistTheme,
      getLanguageExtension(language || ""),
      updateListener,
      saveKeymap,
      EditorView.editable.of(!readOnly),
    ];

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    setIsReady(true);

    return () => {
      view.destroy();
    };
  }, [language]);

  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  useEffect(() => {
    if (!viewRef.current || !jumpToLine || jumpToLine < 1) return;

    const view = viewRef.current;
    const totalLines = view.state.doc.lines;
    const targetLine = Math.min(Math.max(1, jumpToLine), totalLines);
    const line = view.state.doc.line(targetLine);

    view.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: true,
    });

    view.focus();
  }, [jumpToLine, jumpToLineSignal]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-lg border-4 border-black bg-white", className)}>
      <div ref={editorRef} className="h-full w-full" />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-lg font-bold">Loading editor...</div>
        </div>
      )}
    </div>
  );
}
