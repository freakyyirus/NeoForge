import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

export const runtime = "nodejs";

type RunStep = {
  command: string;
  args: string[];
};

type RunPlan = {
  ext: string;
  fileName: string;
  steps: RunStep[];
};

function getRunPlan(ext: string): RunPlan | null {
  switch (ext) {
    case "cpp":
    case "cc":
    case "cxx":
      return {
        ext,
        fileName: "main.cpp",
        steps: [
          { command: "g++", args: ["main.cpp", "-std=c++17", "-O2", "-o", "program.exe"] },
          { command: "program.exe", args: [] },
        ],
      };
    case "c":
      return {
        ext,
        fileName: "main.c",
        steps: [
          { command: "gcc", args: ["main.c", "-O2", "-o", "program.exe"] },
          { command: "program.exe", args: [] },
        ],
      };
    case "py":
    case "python":
      return {
        ext,
        fileName: "main.py",
        steps: [{ command: "python", args: ["main.py"] }],
      };
    case "js":
      return {
        ext,
        fileName: "main.js",
        steps: [{ command: "node", args: ["main.js"] }],
      };
    case "java":
      return {
        ext,
        fileName: "Main.java",
        steps: [
          { command: "javac", args: ["Main.java"] },
          { command: "java", args: ["Main"] },
        ],
      };
    case "rs":
      return {
        ext,
        fileName: "main.rs",
        steps: [
          { command: "rustc", args: ["main.rs", "-O", "-o", "program.exe"] },
          { command: "program.exe", args: [] },
        ],
      };
    default:
      return null;
  }
}

async function runStep(step: RunStep, cwd: string) {
  const timeoutMs = 60_000;
  return new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      cwd,
      env: process.env,
      windowsHide: true,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          stdout,
          stderr: `${stderr}\nCommand timed out after ${timeoutMs / 1000}s.`,
          exitCode,
        });
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    code?: string;
    filePath?: string;
  };

  const code = body.code || "";
  const filePath = body.filePath || "";

  if (!code.trim()) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const plan = getRunPlan(ext);

  if (!plan) {
    return NextResponse.json({
      error: `No runner configured for .${ext || "unknown"}. Supported: cpp, c, py, js, java, rs`,
    }, { status: 400 });
  }

  const workDir = join(tmpdir(), `neoforge-run-${randomUUID()}`);
  try {
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(join(workDir, plan.fileName), code, "utf8");

    let stdout = "";
    let stderr = "";
    let exitCode: number | null = 0;

    for (const step of plan.steps) {
      const result = await runStep(step, workDir);
      if (result.stdout) stdout += result.stdout;
      if (result.stderr) stderr += result.stderr;
      exitCode = result.exitCode;
      if (result.exitCode !== 0) break;
    }

    return NextResponse.json({ success: true, stdout, stderr, exitCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run file";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
