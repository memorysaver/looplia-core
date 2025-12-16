/**
 * Runtime Types for CLI Commands
 *
 * These types define the configuration and context for command execution.
 * We re-export AgenticQueryResult from provider for type compatibility.
 */

/**
 * Base configuration shared by all commands
 */
export type BaseConfig = {
  format: "json" | "markdown";
  outputPath?: string;
  noStreaming: boolean;
  mock: boolean;
};

/**
 * Kit command configuration
 */
export type KitConfig = BaseConfig & {
  help: boolean;
  file?: string;
  sessionId?: string;
  topics?: string[];
  tone?: string;
  wordCount?: number;
};

/**
 * Summarize command configuration
 */
export type SummarizeConfig = BaseConfig & {
  help: boolean;
  file: string;
};

/**
 * Execution context built during runtime initialization
 */
export type ExecutionContext = {
  workspace: string;
  mode: "streaming" | "batch";
  mock: boolean;
};

/**
 * TUI display configuration for streaming commands
 */
export type CommandDisplayConfig = {
  /** Title shown in the main TUI box header */
  title: string;
  /** Command name for logging/debugging */
  commandName: string;
};

/**
 * Post-completion configuration for renderers
 */
export type PostCompletionConfig = {
  /** Success message to display */
  successMessage: string;
  /** Session info display format (placeholder: {contentId}) */
  sessionInfoFormat?: string;
  /** Optional next step hint (null = no next step) */
  nextStep?: {
    /** Description label */
    description: string;
    /** Command template (placeholder: {contentId}) */
    commandTemplate: string;
  } | null;
};

/**
 * Complete command configuration combining display and completion
 */
export type CommandConfig = {
  display: CommandDisplayConfig;
  postCompletion: PostCompletionConfig;
};

/**
 * Re-export types from core for Clean Architecture
 */
/**
 * Backward compatibility alias
 * @deprecated Use CommandResult from @looplia-core/core instead
 */
export type {
  CommandResult,
  CommandResult as AgenticQueryResult,
  StreamingEvent,
} from "@looplia-core/core";

// DisplayConfig is now in CLI layer
export type { DisplayConfig } from "../config/display-config";
