import { spawn } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory where this test file is located
const __dirname = dirname(fileURLToPath(import.meta.url));
// CLI root is one level up from test/
const CLI_ROOT = join(__dirname, "..");
// Project root is three levels up from test/ (apps/cli/test -> project root)
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

/**
 * Execute the CLI binary and capture output
 */
export function execCLI(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    // Path to the compiled CLI entry point (relative to CLI root, not cwd)
    const cliPath = join(CLI_ROOT, "dist", "index.js");

    // Run from project root so getPluginPath() finds plugins/looplia-writer
    const child = spawn("node", [cliPath, ...args], {
      cwd: PROJECT_ROOT,
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

/**
 * Clean up test-generated content items from ~/.looplia/contentItem/
 * Removes folders matching the cli-{timestamp} pattern created during tests
 */
export function cleanupTestContentItems(): void {
  const contentItemPath = join(homedir(), ".looplia", "contentItem");
  try {
    const entries = readdirSync(contentItemPath);
    for (const entry of entries) {
      if (entry.startsWith("cli-")) {
        rmSync(join(contentItemPath, entry), { recursive: true, force: true });
      }
    }
  } catch {
    // Ignore if directory doesn't exist
  }
}
