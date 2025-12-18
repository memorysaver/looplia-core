// Domain Types

// Mock Adapters
export {
  createMockIdeaGenerator,
  createMockOutlineGenerator,
  createMockSummarizer,
  createMockWritingKitProvider,
} from "./adapters/mock";
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
  // Workflow Command (v0.5.1)
  buildWorkflowPrompt,
  // Registry
  clearCommands,
  getCommand,
  getCommandNames,
  hasCommand,
  // Command Definitions
  kitCommand,
  registerCommand,
  workflowCommand,
} from "./commands";
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
export type { PipelineDefinition, PipelineOutput } from "./domain/pipeline";
export type { SessionManifest } from "./domain/session";
export type { ContentSummary, SummaryScore } from "./domain/summary";
export type {
  UserProfile,
  UserTopic,
  WritingStyle,
} from "./domain/user-profile";
// Workflow Types (v0.5.1)
export type {
  OutputValidationState,
  ParsedWorkflow,
  ValidationCheck,
  ValidationCriteria,
  ValidationManifest,
  ValidationResult,
  WorkflowDefinition,
  WorkflowOutput,
} from "./domain/workflow";
// Workflow Parser (v0.5.1)
export {
  generateValidationManifest,
  getExecutionOrder,
  getFinalOutput,
  parseFrontmatter,
  parseWorkflow,
} from "./domain/workflow-parser";
export type {
  OutlineSection,
  WritingKit,
  WritingKitMeta,
  WritingKitSource,
} from "./domain/writing-kit";
export type { IdeaProvider } from "./ports/idea-generator";
export type { OutlineProvider } from "./ports/outline-generator";
export type { ScoringPolicy } from "./ports/scoring";
export { defaultScoringPolicy } from "./ports/scoring";
// Provider Interfaces
export type { SummarizerProvider } from "./ports/summarizer";
export { generateIdeas } from "./services/idea-engine";
export { rankKits } from "./services/ranking-engine";
// Services
export { summarizeContent } from "./services/summarization-engine";
export {
  buildWritingKit,
  type WritingKitProviders,
} from "./services/writing-kit-engine";
// Validation
export {
  ContentItemSchema,
  ContentSummarySchema,
  // Workflow Validation (v0.5.1)
  OutputValidationStateSchema,
  PipelineDefinitionSchema,
  PipelineOutputSchema,
  SessionManifestSchema,
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
  WorkflowOutputSchema,
  WritingIdeasSchema,
  WritingKitSchema,
} from "./validation/schemas";
