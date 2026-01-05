/**
 * Shared Filesystem Utilities
 *
 * Common filesystem operations used across the provider package.
 */

import { mkdir, stat } from "node:fs/promises";

/**
 * Check if a path exists
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}
