/**
 * Content ID Extraction Utilities
 *
 * Security-critical functions for extracting and validating content IDs from prompts.
 * Single source of truth for path traversal protection.
 */

/** Regex to extract content ID from prompt */
export const CONTENT_ID_REGEX = /contentItem\/([^\s/]+)/;

/** Whitelist pattern for valid content IDs */
export const VALID_CONTENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Extract content ID from agentic prompt with path traversal protection
 *
 * Security measures:
 * - URL decoding with error handling
 * - Null byte injection prevention
 * - Path traversal prevention (.., /, \)
 * - Whitelist validation (alphanumeric, dash, underscore only)
 */
export function extractContentIdFromPrompt(prompt: string): string | null {
  const match = prompt.match(CONTENT_ID_REGEX);
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

  if (!VALID_CONTENT_ID_PATTERN.test(decodedId)) {
    return null;
  }

  return decodedId;
}
