/**
 * Shared Sandbox Utilities
 *
 * Common sandbox creation and ID generation functions used by both
 * run and build commands. Ensures consistent sandbox handling across CLI.
 *
 * v0.7.1: Extracted from run.ts to enable build command logging.
 */

import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

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
