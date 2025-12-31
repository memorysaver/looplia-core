/**
 * Claude Code Path Resolution
 *
 * Finds the Claude Code executable for the Agent SDK.
 * The SDK requires Claude Code to be installed separately.
 *
 * Search order:
 * 1. CLAUDE_CODE_PATH environment variable
 * 2. ~/.local/bin/claude (npm global install)
 * 3. /usr/local/bin/claude
 * 4. /opt/homebrew/bin/claude (macOS Homebrew)
 * 5. which/where claude (PATH lookup)
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Regex for splitting lines (handles Windows CRLF and Unix LF)
 */
const LINE_SPLIT_REGEX = /\r?\n/;

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

  // 4. Not found - cache null and return undefined to let SDK use built-in executable
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
