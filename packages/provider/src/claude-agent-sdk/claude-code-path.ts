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
 * 5. which claude (PATH lookup)
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
 * Find Claude Code executable path
 *
 * @returns Path to Claude Code executable
 * @throws Error if Claude Code is not found
 */
export function findClaudeCodePath(): string {
  // 1. Check environment variable override
  const envPath = process.env.CLAUDE_CODE_PATH;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  // 2. Check common installation paths
  for (const path of CLAUDE_CODE_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }

  // 3. Try which command (PATH lookup)
  try {
    const whichResult = execSync("which claude", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (whichResult && existsSync(whichResult)) {
      return whichResult;
    }
  } catch {
    // which command failed, continue
  }

  // 4. Not found - throw helpful error
  throw new Error(
    `Claude Code not found. Looplia requires Claude Code to be installed.

Install Claude Code:
  npm install -g @anthropic-ai/claude-code

Or set CLAUDE_CODE_PATH environment variable to your Claude installation.

More info: https://docs.anthropic.com/claude-code`
  );
}

/**
 * Check if Claude Code is installed
 */
export function isClaudeCodeInstalled(): boolean {
  try {
    findClaudeCodePath();
    return true;
  } catch {
    return false;
  }
}
