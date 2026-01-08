/**
 * Streaming module for CLI UI
 *
 * Provides event types and utilities for transforming SDK messages
 * into UI-friendly streaming events.
 *
 * Architecture:
 * - sdk-types.ts: Input types (from Claude Agent SDK)
 * - types.ts: Output types (for UI consumption)
 * - transformer.ts: SDK message → StreamingEvent conversion
 * - query-executor.ts: Orchestrates streaming queries
 */

// Interactive executor for build command (v0.7.1)
export {
  type AskUserQuestion,
  executeInteractiveQueryStreaming,
  type QuestionCallback,
} from "./interactive-query-executor";
export { ProgressTracker } from "./progress-tracker";
export {
  type AgenticQueryResult,
  executeAgenticQueryStreaming,
  extractContentIdFromPrompt,
} from "./query-executor";
export * from "./sdk-types";
export * from "./transformer";
export * from "./types";
