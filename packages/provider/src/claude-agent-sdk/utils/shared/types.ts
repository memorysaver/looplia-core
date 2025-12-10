/**
 * Shared Types for Claude Agent SDK
 *
 * Canonical source for AgenticQueryResult type.
 */

import type { ProviderResultWithUsage } from "../../config";

/**
 * Result type that includes session ID from SDK
 *
 * Type chain:
 * - ProviderResult<T> = { success: true; data: T } | { success: false; error: ProviderError }
 * - ProviderResultWithUsage<T> = ProviderResult<T> & { usage?: ProviderUsage }
 * - AgenticQueryResult<T> = ProviderResultWithUsage<T> & { sessionId?: string }
 */
export type AgenticQueryResult<T> = ProviderResultWithUsage<T> & {
  sessionId?: string;
};
