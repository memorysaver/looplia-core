/**
 * Command Framework Exports
 *
 * Clean Architecture: Commands are defined in core, used by CLI and Provider.
 */

// Registry
export {
  clearCommands,
  getCommand,
  getCommandNames,
  hasCommand,
  registerCommand,
} from "./registry";
// Types
export type {
  AgentExecutor,
  CommandDefinition,
  CommandResult,
  CompleteEvent,
  ErrorEvent,
  ExecutorOptions,
  ProgressEvent,
  PromptContext,
  PromptEvent,
  SessionStartEvent,
  StreamingEvent,
  TextDeltaEvent,
  TextEvent,
  ThinkingDeltaEvent,
  ThinkingEvent,
  ToolEndEvent,
  ToolStartEvent,
  UsageEvent,
  WorkflowResult,
} from "./types";
// Workflow Command (v0.6.0)
export { buildWorkflowPrompt, workflowCommand } from "./workflow";

// Auto-register commands on import
import { registerCommand } from "./registry";
import { workflowCommand } from "./workflow";

registerCommand(workflowCommand);
