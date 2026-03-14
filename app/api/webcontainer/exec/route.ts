import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, cwd, stream } = body as { command?: string; cwd?: string; stream?: boolean };

    if (!command) {
      return NextResponse.json({ error: "Command is required" }, { status: 400 });
    }

    const timeoutMs = 10 * 60_000;
    const shell = process.platform === "win32" ? "powershell.exe" : "bash";
    const shellArgs = process.platform === "win32" ? ["-NoLogo", "-NoProfile", "-Command", command] : ["-lc", command];

    const safeCwd = typeof cwd === "string" && cwd.trim() ? cwd : process.cwd();

    if (stream) {
      const encoder = new TextEncoder();
      const webStream = new ReadableStream<Uint8Array>({
        start(controller) {
          const child = spawn(shell, shellArgs, {
            cwd: safeCwd,
            env: process.env,
            windowsHide: true,
          });

          const send = (payload: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };

          const timer = setTimeout(() => {
            send({ type: "stderr", data: `\nCommand timed out after ${timeoutMs / 1000}s.` });
            child.kill();
          }, timeoutMs);

          child.stdout.on("data", (chunk) => {
            send({ type: "stdout", data: chunk.toString() });
          });

          child.stderr.on("data", (chunk) => {
            send({ type: "stderr", data: chunk.toString() });
          });

          child.on("error", (error) => {
            clearTimeout(timer);
            send({ type: "error", data: error.message });
            controller.close();
          });

          child.on("close", (exitCode) => {
            clearTimeout(timer);
            send({ type: "exit", code: exitCode });
            controller.close();
          });
        },
      });

      return new Response(webStream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
        },
      });
    }

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve, reject) => {
      const child = spawn(shell, shellArgs, {
        cwd: safeCwd,
        env: process.env,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let killedByTimeout = false;

      const timer = setTimeout(() => {
        killedByTimeout = true;
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
        if (killedByTimeout) {
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

    return NextResponse.json({ 
      success: true, 
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  } catch (error) {
    console.error("Error executing command:", error);
    const message = error instanceof Error ? error.message : "Failed to execute command";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
