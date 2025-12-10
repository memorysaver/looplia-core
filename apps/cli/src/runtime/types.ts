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
 * Re-export AgenticQueryResult from provider for type compatibility
 *
 * Type chain:
 * - ProviderResult<T> = { success: true; data: T } | { success: false; error: ProviderError }
 * - ProviderResultWithUsage<T> = ProviderResult<T> & { usage?: ProviderUsage }
 * - AgenticQueryResult<T> = ProviderResultWithUsage<T> & { sessionId?: string }
 */
export type {
  AgenticQueryResult,
  StreamingEvent,
} from "@looplia-core/provider/claude-agent-sdk";
