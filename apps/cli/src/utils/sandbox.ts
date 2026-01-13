/**
 * Shared Sandbox Utilities
 *
 * Common sandbox creation and ID generation functions used by both
 * run and build commands. Ensures consistent sandbox handling across CLI.
 *
 * v0.7.1: Extracted from run.ts to enable build command logging.
 */

import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Standard sandbox directory names
 */
export const SANDBOX_DIRS = {
  INPUTS: "inputs",
  OUTPUTS: "outputs",
  LOGS: "logs",
} as const;

/**
 * Generate 4-character random hex suffix for sandbox IDs
 * Uses crypto.randomBytes for secure randomness
 */
export function generateRandomSuffix(): string {
  return randomBytes(2).toString("hex");
}

/**
 * Generate URL-safe slug from input string
 * Normalizes to lowercase alphanumeric with hyphens
 */
export function generateSlug(input: string, maxLength = 30): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, maxLength);
}

/**
 * Generate sandbox ID from a slug
 * Format: {slug}-{YYYY-MM-DD}-{random4}
 * Example: "build-2026-01-09-a1b2"
 */
export function generateSandboxId(slug: string): string {
  const normalizedSlug = generateSlug(slug);
  const date = new Date().toISOString().split("T")[0];
  const suffix = generateRandomSuffix();
  return `${normalizedSlug}-${date}-${suffix}`;
}

/**
 * Create sandbox directory structure
 * Creates: sandbox/{sandboxId}/inputs/, outputs/, logs/
 * Returns the full sandbox directory path
 */
export function createSandboxDirectories(
  workspace: string,
  sandboxId: string
): string {
  const sandboxDir = join(workspace, "sandbox", sandboxId);

  mkdirSync(join(sandboxDir, SANDBOX_DIRS.INPUTS), { recursive: true });
  mkdirSync(join(sandboxDir, SANDBOX_DIRS.OUTPUTS), { recursive: true });
  mkdirSync(join(sandboxDir, SANDBOX_DIRS.LOGS), { recursive: true });

  return sandboxDir;
}

/**
 * Copy sandbox outputs to user-specified destination directory.
 * Creates the destination directory if it doesn't exist.
 * Copies all files from sandbox/{sandboxId}/outputs/ to destDir.
 *
 * v0.7.2: Added for --output flag and LOOPLIA_OUTPUT_DIR support.
 *
 * @param workspace - Workspace path (~/.looplia)
 * @param sandboxId - Sandbox identifier
 * @param destDir - User-specified destination directory (absolute or relative)
 * @returns Number of files copied
 */
export function copyOutputsToDestination(
  workspace: string,
  sandboxId: string,
  destDir: string
): number {
  const outputsPath = join(
    workspace,
    "sandbox",
    sandboxId,
    SANDBOX_DIRS.OUTPUTS
  );
  const resolvedDest = resolve(destDir);

  // Create destination directory if needed
  mkdirSync(resolvedDest, { recursive: true });

  // Copy all files from outputs directory
  let copiedCount = 0;
  try {
    const entries = readdirSync(outputsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const srcPath = join(outputsPath, entry.name);
        const destPath = join(resolvedDest, entry.name);
        copyFileSync(srcPath, destPath);
        copiedCount += 1;
      }
    }
  } catch {
    // If outputs directory doesn't exist or is empty, return 0
  }

  return copiedCount;
}
