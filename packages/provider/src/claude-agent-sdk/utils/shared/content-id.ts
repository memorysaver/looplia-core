/**
 * Sandbox ID Extraction Utilities
 *
 * Security-critical functions for extracting and validating sandbox IDs from prompts.
 * Single source of truth for path traversal protection.
 */

/** Regex to extract sandbox ID from prompt (path format) */
export const SANDBOX_ID_REGEX = /sandbox\/([^\s/]+)/;

/** Legacy regex for backward compatibility */
export const CONTENT_ID_REGEX = /contentItem\/([^\s/]+)/;

/** Regex for CLI argument format: --sandbox-id {id} */
export const SANDBOX_ARG_REGEX = /--sandbox-id\s+([^\s]+)/;

/** Regex for CLI resume format: --sandbox {id} */
export const SANDBOX_RESUME_REGEX = /--sandbox\s+([^\s]+)/;

/** Whitelist pattern for valid sandbox IDs */
export const VALID_SANDBOX_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Extract sandbox ID from agentic prompt with path traversal protection
 *
 * Security measures:
 * - URL decoding with error handling
 * - Null byte injection prevention
 * - Path traversal prevention (.., /, \)
 * - Whitelist validation (alphanumeric, dash, underscore only)
 *
 * @param prompt - The prompt to extract sandbox ID from
 * @returns Sandbox ID or null if not found/invalid
 */
export function extractSandboxIdFromPrompt(prompt: string): string | null {
  // Try sandbox/ path pattern first
  let match = prompt.match(SANDBOX_ID_REGEX);

  // Try --sandbox-id argument pattern (CLI new sandbox format)
  if (!match) {
    match = prompt.match(SANDBOX_ARG_REGEX);
  }

  // Try --sandbox argument pattern (CLI resume format)
  if (!match) {
    match = prompt.match(SANDBOX_RESUME_REGEX);
  }

  // Fall back to contentItem/ for legacy prompts
  if (!match) {
    match = prompt.match(CONTENT_ID_REGEX);
  }

  const rawId = match?.[1];

  if (!rawId) {
    return null;
  }

  let decodedId: string;
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {
    return null;
  }

  if (decodedId.includes("\0")) {
    return null;
  }
  if (
    decodedId.includes("..") ||
    decodedId.includes("/") ||
    decodedId.includes("\\")
  ) {
    return null;
  }

  if (!VALID_SANDBOX_ID_PATTERN.test(decodedId)) {
    return null;
  }

  return decodedId;
}

/**
 * @deprecated Use extractSandboxIdFromPrompt instead
 */
export const extractContentIdFromPrompt = extractSandboxIdFromPrompt;

/**
 * @deprecated Use VALID_SANDBOX_ID_PATTERN instead
 */
export const VALID_CONTENT_ID_PATTERN = VALID_SANDBOX_ID_PATTERN;
