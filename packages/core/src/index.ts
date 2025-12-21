// Domain Types

// Command Framework
export type {
  AgentExecutor,
  CommandDefinition,
  CommandResult,
  ExecutorOptions,
  PromptContext,
  StreamingEvent,
  WorkflowResult,
} from "./commands";
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
export type { SessionManifest } from "./domain/session";
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
// Validation
export {
  ContentItemSchema,
  SessionManifestSchema,
  // Workflow Validation (v0.6.0)
  StepValidationStateSchema,
  UserProfileSchema,
  ValidationCheckSchema,
  ValidationCriteriaSchema,
  ValidationManifestSchema,
  ValidationResultSchema,
  validateContentItem,
  validateUserProfile,
  validateValidationManifest,
  validateValidationResult,
  validateWorkflowDefinition,
  WorkflowDefinitionSchema,
  WorkflowStepSchema,
} from "./validation/schemas";
