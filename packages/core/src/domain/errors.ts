/**
 * Standardized error types across all providers
 */
export type ProviderError =
  | { type: "rate_limit"; retryAfterMs: number; message: string }
  | { type: "unsupported_language"; language: string; message: string }
  | { type: "content_moderation"; reason: string; message: string }
  | { type: "malformed_output"; expected: string; got: string; message: string }
  | { type: "network_error"; cause?: Error; message: string }
  | { type: "validation_error"; field: string; message: string }
  | { type: "unknown"; cause?: Error; message: string };

/**
 * Result type for all provider operations
 */
export type ProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: ProviderError };

/**
 * Helper to create success result
 */
export function ok<T>(data: T): ProviderResult<T> {
  return { success: true, data };
}

/**
 * Helper to create error result
 */
export function err<T>(error: ProviderError): ProviderResult<T> {
  return { success: false, error };
}
