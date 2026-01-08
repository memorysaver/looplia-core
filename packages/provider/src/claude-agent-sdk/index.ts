// Re-export types and utilities

// Re-export WorkflowResult from core for convenience
export type { WorkflowResult } from "@looplia-core/core";
// Re-export Claude Code path utilities (v0.6.8)
export {
  clearClaudeCodePathCache,
  findClaudeCodePath,
  isClaudeCodeInstalled,
} from "./claude-code-path";
// Re-export command initialization (v0.6.10)
export type { CommandInitOptions, CommandInitResult } from "./command-init";
export { initializeCommandEnvironment } from "./command-init";
export type {
  ClaudeAgentConfig,
  ConfigValidationResult,
  ProviderResultWithUsage,
  ProviderUsage,
} from "./config";
export { validateConfig } from "./config";
// Re-export executor (Clean Architecture)
export { createClaudeAgentExecutor } from "./executor";
// Re-export logger
export type { QueryLogger } from "./logger";
export { createQueryLogger } from "./logger";
// Re-export model provider utilities (v0.6.6)
export type {
  ApiProviderType,
  LoopliaSettings,
  PresetDefinition,
  SettingsDisplayInfo,
} from "./model-provider";
export {
  applyPreset,
  DEFAULT_SETTINGS,
  getConfigPath,
  getLoopliaHome,
  getSettingsDisplayInfo,
  injectLoopliaSettingsEnv,
  maskAuthToken,
  PRESETS,
  readLoopliaSettings,
  removeLoopliaSettings,
  writeLoopliaSettings,
} from "./model-provider";
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
  type AskUserQuestion,
  executeAgenticQueryStreaming,
  // Interactive executor for build command (v0.7.1)
  executeInteractiveQueryStreaming,
  extractContentIdFromPrompt,
  type QuestionCallback,
} from "./streaming";
// Re-export schemas for reference (v0.6.2: inline schemas, not TypeScript types)
export { WRITING_KIT_OUTPUT_SCHEMA } from "./utils/schema-converter";
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
