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

// Regex for validating git URLs (GitHub, GitLab, Bitbucket)
// Allows: https://github.com/user/repo or https://github.com/user/repo.git
const VALID_GIT_URL_PATTERN =
  /^https:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[\w.-]+\/[\w.-]+(\.git)?$/;

// Dangerous shell characters that could enable command injection
const SHELL_INJECTION_PATTERN = /[;&|`$(){}[\]<>\\'"!\n\r]/;

/**
 * Validate a git URL to prevent command injection attacks.
 *
 * Only allows HTTPS URLs from trusted git hosts (GitHub, GitLab, Bitbucket).
 * Rejects URLs with shell metacharacters that could be used for injection.
 *
 * @param url - The URL to validate
 * @returns true if the URL is safe to use in shell commands
 */
export function isValidGitUrl(url: string): boolean {
  // Must be a string
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }

  // Check for shell injection characters
  if (SHELL_INJECTION_PATTERN.test(url)) {
    return false;
  }

  // Must match valid git URL pattern
  return VALID_GIT_URL_PATTERN.test(url);
}

/**
 * Validate a path to prevent path traversal attacks.
 *
 * Rejects paths containing:
 * - ".." (parent directory traversal)
 * - Absolute paths starting with "/" (when relative expected)
 * - Null bytes or other dangerous characters
 *
 * @param pathSegment - The path segment to validate
 * @returns true if the path is safe
 */
export function isValidPathSegment(pathSegment: string): boolean {
  // Must be a string
  if (typeof pathSegment !== "string" || pathSegment.length === 0) {
    return false;
  }

  // Check for path traversal patterns
  if (pathSegment.includes("..")) {
    return false;
  }

  // Check for absolute paths (could escape intended directory)
  if (pathSegment.startsWith("/")) {
    return false;
  }

  // Check for null bytes (can truncate paths in some systems)
  if (pathSegment.includes("\0")) {
    return false;
  }

  return true;
}
