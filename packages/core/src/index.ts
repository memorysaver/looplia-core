// Domain Types

// Mock Adapters
export { createMockSummarizer } from "./adapters/mock";
export type {
  AgentExecutor,
  CommandDefinition,
  CommandResult,
  ExecutorOptions,
  PromptContext,
  StreamingEvent,
  WorkflowResult,
} from "./commands";
// Command Framework
export {
  // Workflow Command (v0.6.0)
  buildWorkflowPrompt,
  // Registry
  clearCommands,
  getCommand,
  getCommandNames,
  hasCommand,
  // Command Definitions
  registerCommand,
  workflowCommand,
} from "./commands";
// Agent Utilities (v0.6.0)
export {
  extractAgentName,
  isValidRunFormat,
  RUN_FORMAT_PATTERN,
} from "./domain/agent-utils";
export type {
  ContentItem,
  ContentMetadata,
  Source,
  SourceType,
} from "./domain/content";
export type { ProviderError, ProviderResult } from "./domain/errors";
export { err, ok } from "./domain/errors";
export type {
  WritingAngle,
  WritingHook,
  WritingIdeas,
  WritingQuestion,
} from "./domain/ideas";
export type { SessionManifest } from "./domain/session";
export type { ContentSummary, SummaryScore } from "./domain/summary";
export type {
  UserProfile,
  UserTopic,
  WritingStyle,
} from "./domain/user-profile";
// Workflow Types (v0.6.0)
export type {
  ParsedWorkflow,
  StepValidationState,
  ValidationCheck,
  ValidationCriteria,
  ValidationManifest,
  ValidationResult,
  WorkflowDefinition,
  WorkflowStep,
} from "./domain/workflow";
// Workflow Parser (v0.6.0)
export {
  generateValidationManifest,
  getExecutionOrder,
  getFinalStep,
  parseFrontmatter,
  parseWorkflow,
} from "./domain/workflow-parser";
export type {
  OutlineSection,
  WritingKit,
  WritingKitMeta,
  WritingKitSource,
} from "./domain/writing-kit";
export type { ScoringPolicy } from "./ports/scoring";
export { defaultScoringPolicy } from "./ports/scoring";
// Provider Interfaces
export type { SummarizerProvider } from "./ports/summarizer";
export { rankKits } from "./services/ranking-engine";
// Services
export { summarizeContent } from "./services/summarization-engine";
// Validation
export {
  ContentItemSchema,
  ContentSummarySchema,
  SessionManifestSchema,
  // Workflow Validation (v0.6.0)
  StepValidationStateSchema,
  UserProfileSchema,
  ValidationCheckSchema,
  ValidationCriteriaSchema,
  ValidationManifestSchema,
  ValidationResultSchema,
  validateContentItem,
  validateContentSummary,
  validateUserProfile,
  validateValidationManifest,
  validateValidationResult,
  validateWorkflowDefinition,
  validateWritingIdeas,
  WorkflowDefinitionSchema,
  WorkflowStepSchema,
  WritingIdeasSchema,
  WritingKitSchema,
} from "./validation/schemas";
