/**
 * Claude Code Path Resolution
 *
 * Finds the Claude Code executable for the Agent SDK.
 * The SDK requires Claude Code to be installed separately.
 *
 * Search order:
 * 1. CLAUDE_CODE_PATH environment variable
 * 2. SDK bundled cli.js (required for bundled deployments)
 * 3. ~/.local/bin/claude (npm global install)
 * 4. /usr/local/bin/claude
 * 5. /opt/homebrew/bin/claude (macOS Homebrew)
 * 6. which/where claude (PATH lookup)
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Regex for splitting lines (handles Windows CRLF and Unix LF)
 */
const LINE_SPLIT_REGEX = /\r?\n/;

/**
 * Find the SDK's bundled Claude Code CLI path
 *
 * v0.6.10: Critical fix for bundled deployments (Docker, etc.)
 * When our CLI is bundled, the SDK's internal path resolution fails
 * because __dirname resolves to our bundle's directory, not the SDK's.
 *
 * This function uses require.resolve to find the SDK package and
 * then locates the bundled cli.js relative to it.
 */
function findSdkBundledCliPath(): string | undefined {
  try {
    // Use createRequire to get a require function that works in ESM
    const require = createRequire(import.meta.url);

    // Resolve the SDK's package.json to find its directory
    const sdkPackagePath = require.resolve(
      "@anthropic-ai/claude-agent-sdk/package.json"
    );
    const sdkDir = dirname(sdkPackagePath);

    // The bundled CLI is at the root of the SDK package
    const cliPath = join(sdkDir, "cli.js");

    if (existsSync(cliPath)) {
      return cliPath;
    }
  } catch {
    // SDK not found or path resolution failed
  }
  return;
}

/**
 * Common Claude Code installation paths
 */
const CLAUDE_CODE_PATHS = [
  // User's local bin (npm global install location)
  join(homedir(), ".local", "bin", "claude"),
  // System-wide installations
  "/usr/local/bin/claude",
  // macOS Homebrew
  "/opt/homebrew/bin/claude",
  // Windows (if applicable)
  join(homedir(), "AppData", "Local", "Programs", "claude", "claude.exe"),
];

/**
 * Cached Claude Code path (resolved once per process)
 * - undefined: not yet searched
 * - null: searched but not found
 * - string: found path
 */
let cachedClaudeCodePath: string | null | undefined;

/**
 * Find Claude Code executable path (optional)
 *
 * Results are cached at module level to avoid redundant filesystem
 * checks and subprocess spawns on subsequent calls.
 *
 * Returns undefined if Claude Code is not found, allowing the SDK
 * to use its built-in executable as a fallback.
 *
 * @returns Path to Claude Code executable, or undefined if not found
 */
export function findClaudeCodePath(): string | undefined {
  // Return cached result if available (null means "not found")
  if (cachedClaudeCodePath !== undefined) {
    return cachedClaudeCodePath ?? undefined;
  }

  // 1. Check environment variable override
  const envPath = process.env.CLAUDE_CODE_PATH;
  if (envPath && existsSync(envPath)) {
    cachedClaudeCodePath = envPath;
    return cachedClaudeCodePath;
  }

  // 2. Check common installation paths
  for (const path of CLAUDE_CODE_PATHS) {
    if (existsSync(path)) {
      cachedClaudeCodePath = path;
      return cachedClaudeCodePath;
    }
  }

  // 3. Try PATH lookup (which on Unix, where on Windows)
  try {
    const pathLookupCommand =
      process.platform === "win32" ? "where claude" : "which claude";
    const rawResult = execSync(pathLookupCommand, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    // Handle multiple lines from 'where' command on Windows
    const firstResult =
      rawResult
        .split(LINE_SPLIT_REGEX)
        .find((line) => line.trim().length > 0) ?? "";
    if (firstResult && existsSync(firstResult)) {
      cachedClaudeCodePath = firstResult;
      return cachedClaudeCodePath;
    }
  } catch {
    // PATH lookup command failed, continue
  }

  // 4. Try SDK's bundled CLI (critical for Docker and bundled deployments)
  // v0.6.10: When bundled, the SDK's internal path resolution fails because
  // it looks for cli.js relative to __dirname which points to our bundle
  const sdkCliPath = findSdkBundledCliPath();
  if (sdkCliPath) {
    cachedClaudeCodePath = sdkCliPath;
    return cachedClaudeCodePath;
  }

  // 5. Not found - cache null and return undefined to let SDK use built-in executable
  cachedClaudeCodePath = null;
  return;
}

/**
 * Check if Claude Code is installed
 */
export function isClaudeCodeInstalled(): boolean {
  return findClaudeCodePath() !== undefined;
}

/**
 * Clear the cached Claude Code path (useful for testing)
 */
export function clearClaudeCodePathCache(): void {
  cachedClaudeCodePath = undefined;
}
