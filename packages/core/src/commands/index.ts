/**
 * Command Framework Exports
 *
 * Clean Architecture: Commands are defined in core, used by CLI and Provider.
 */

// Command Definitions
export { kitCommand } from "./kit";

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
} from "./types";

// Auto-register commands on import
import { kitCommand } from "./kit";
import { registerCommand } from "./registry";

registerCommand(kitCommand);
