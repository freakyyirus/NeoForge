"use client";

import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw, Terminal as TerminalIcon, X, Plus } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

interface TerminalComponentProps {
  onCommand?: (command: string) => void | Promise<void>;
  output?: string[];
  className?: string;
  isExecuting?: boolean;
}

export function TerminalComponent({
  onCommand,
  output = [],
  className,
  isExecuting = false,
}: TerminalComponentProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOutputIndexRef = useRef(0);
  const [history, setHistory] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);

  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14,
      theme: {
        background: "#FFFFFF",
        foreground: "#000000",
        cursor: "#000000",
        cursorAccent: "#FFFFFF",
        selectionBackground: "#0066FF",
        black: "#000000",
        red: "#FF3333",
        green: "#00FF66",
        yellow: "#FFE600",
        blue: "#0066FF",
        magenta: "#FF00FF",
        cyan: "#00FFFF",
        white: "#FFFFFF",
        brightBlack: "#666666",
        brightRed: "#FF6666",
        brightGreen: "#66FF99",
        brightYellow: "#FFFF66",
        brightBlue: "#6699FF",
        brightMagenta: "#FF66FF",
        brightCyan: "#66FFFF",
        brightWhite: "#FFFFFF",
      },
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminal.writeln("\x1b[1;34m╔════════════════════════════════════════════════╗\x1b[0m");
    terminal.writeln("\x1b[1;34m║\x1b[0m  \x1b[1;33mNeoForge Terminal\x1b[0m                          \x1b[1;34m║\x1b[0m");
    terminal.writeln("\x1b[1;34m║\x1b[0m  Type commands below to execute              \x1b[1;34m║\x1b[0m");
    terminal.writeln("\x1b[1;34m╚════════════════════════════════════════════════╝\x1b[0m");
    terminal.writeln("");

    const prompt = () => {
      terminal.write("\x1b[1;32m$\x1b[0m ");
    };

    prompt();

    let currentLine = "";

    terminal.onData((data) => {
      const code = data.charCodeAt(0);

      if (code === 13) {
        terminal.writeln("");
        if (currentLine.trim()) {
          setHistory((prev) => [...prev, currentLine]);
          onCommand?.(currentLine);
        }
        currentLine = "";
        prompt();
      } else if (code === 127) {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write("\b \b");
        }
      } else if (code < 32) {
        return;
      } else {
        currentLine += data;
        terminal.write(data);
      }
    });

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, []);

  useEffect(() => {
    if (!xtermRef.current) return;
    if (output.length < lastOutputIndexRef.current) {
      lastOutputIndexRef.current = 0;
    }

    const nextLines = output.slice(lastOutputIndexRef.current);
    nextLines.forEach((line) => {
      xtermRef.current?.writeln(line);
    });
    lastOutputIndexRef.current = output.length;
  }, [output]);

  useEffect(() => {
    if (isExecuting && xtermRef.current) {
      xtermRef.current.write("\r\n\x1b[33mExecuting...\x1b[0m\r\n");
    }
  }, [isExecuting]);

  const clearTerminal = () => {
    xtermRef.current?.clear();
    xtermRef.current?.writeln("\x1b[1;32mTerminal cleared\x1b[0m");
    xtermRef.current?.write("$ ");
  };

  return (
    <div className={cn("flex h-full flex-col rounded-lg border-4 border-black bg-white", className)}>
      <div className="flex items-center justify-between border-b-4 border-black bg-muted px-4 py-2">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4" />
          <span className="font-bold">TERMINAL</span>
          {isExecuting && (
            <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-black">
              Running
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={clearTerminal}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 bg-white p-2" />
    </div>
  );
}
