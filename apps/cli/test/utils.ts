import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Execute the CLI binary and capture output
 */
export function execCLI(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    // Path to the compiled CLI entry point
    const cliPath = join(process.cwd(), "dist", "index.js");

    const child = spawn("node", [cliPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Create a temporary directory for test files
 * Returns path and cleanup function
 */
export function createTempDir(): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), "looplia-test-"));

  const cleanup = () => {
    try {
      rmSync(path, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  };

  return { path, cleanup };
}

/**
 * Create a test content file
 */
export function createTestFile(
  dir: string,
  filename: string,
  content: string
): string {
  const filepath = join(dir, filename);
  writeFileSync(filepath, content, "utf-8");
  return filepath;
}

/**
 * Read a file safely
 */
export function readTestFile(filepath: string): string {
  return readFileSync(filepath, "utf-8");
}
