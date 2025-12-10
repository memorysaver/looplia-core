// Re-export types and utilities
export type {
  ClaudeAgentConfig,
  ConfigValidationResult,
  ProviderResultWithUsage,
  ProviderUsage,
} from "./config";
export { validateConfig } from "./config";
// Re-export content I/O utilities
export { writeContentItem } from "./content-io";
// Re-export logger
export type { QueryLogger } from "./logger";
export { createQueryLogger } from "./logger";
// Re-export prompt builders for customization
export {
  buildSummarizePrompt,
  SUMMARIZE_SYSTEM_PROMPT,
} from "./prompts/summarize";
// Re-export streaming types and utilities (v0.3.4)
export type {
  CompleteEvent,
  ErrorEvent,
  ProgressEvent,
  SessionStartEvent,
  StreamingEvent,
  TextDeltaEvent,
  TextEvent,
  ThinkingDeltaEvent,
  ThinkingEvent,
  ToolEndEvent,
  ToolStartEvent,
} from "./streaming";
export {
  type AgenticQueryResult,
  executeAgenticQueryStreaming,
  extractContentIdFromPrompt,
} from "./streaming";
export type { ClaudeSummarizerProvider } from "./summarizer";
// Re-export factory functions
export { createClaudeSummarizer } from "./summarizer";
// Re-export schemas for reference
export {
  SUMMARY_OUTPUT_SCHEMA,
  WRITING_KIT_OUTPUT_SCHEMA,
} from "./utils/schema-converter";
export type { WorkspaceOptions } from "./workspace";
// Re-export workspace utilities
export {
  ensureWorkspace,
  expandPath,
  getPluginPath,
  getWorkspacePath,
  readUserProfile,
  writeUserProfile,
} from "./workspace";
// Re-export v0.3.1 writing kit provider
export type { WritingKitProvider } from "./writing-kit-provider";
export { createClaudeWritingKitProvider } from "./writing-kit-provider";
