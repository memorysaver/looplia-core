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
export { summarizeCommand } from "./summarize";
// Types
export type {
  AgentExecutor,
  CommandDefinition,
  CommandResult,
  CompleteEvent,
  DisplayConfig,
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

import { kitCommand } from "./kit";
// Auto-register commands on import
import { registerCommand } from "./registry";
import { summarizeCommand } from "./summarize";

registerCommand(summarizeCommand);
registerCommand(kitCommand);
