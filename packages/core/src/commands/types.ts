/**
 * Command Framework Types
 *
 * Clean Architecture: These types define the contract between
 * CLI (outer layer) and Provider (outer layer) through the Core (inner layer).
 */

import type { z } from "zod";

/**
 * Streaming event types for UI consumption
 * Provider implements these, CLI consumes them
 */
export type StreamingEvent =
  | PromptEvent
  | SessionStartEvent
  | TextEvent
  | TextDeltaEvent
  | ThinkingEvent
  | ThinkingDeltaEvent
  | ToolStartEvent
  | ToolEndEvent
  | ProgressEvent
  | UsageEvent
  | ErrorEvent
  | CompleteEvent;

export type PromptEvent = {
  type: "prompt";
  content: string;
  timestamp: number;
};

export type UsageEvent = {
  type: "usage";
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
};

export type SessionStartEvent = {
  type: "session_start";
  sessionId: string;
  model: string;
  availableTools: string[];
  timestamp: number;
};

export type TextEvent = {
  type: "text";
  content: string;
  timestamp: number;
};

export type TextDeltaEvent = {
  type: "text_delta";
  text: string;
  timestamp: number;
};

export type ThinkingEvent = {
  type: "thinking";
  content: string;
  timestamp: number;
};

export type ThinkingDeltaEvent = {
  type: "thinking_delta";
  thinking: string;
  timestamp: number;
};

export type ToolStartEvent = {
  type: "tool_start";
  toolUseId: string;
  tool: string;
  input: {
    path?: string;
    skill?: string;
    pattern?: string;
    raw?: unknown;
  };
  timestamp: number;
};

export type ToolEndEvent = {
  type: "tool_end";
  toolUseId: string;
  tool: string;
  success: boolean;
  summary?: string;
  durationMs: number;
  timestamp: number;
};

export type ProgressEvent = {
  type: "progress";
  step:
    | "initializing"
    | "analyzing"
    | "generating_ideas"
    | "building_outline"
    | "assembling_kit";
  percent: number;
  message: string;
  timestamp: number;
};

export type ErrorEvent = {
  type: "error";
  code: string;
  message: string;
  recoverable: boolean;
  timestamp: number;
};

export type CompleteEvent<T = unknown> = {
  type: "complete";
  subtype: "success" | "error_max_turns" | "error_during_execution";
  result: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
  metrics: {
    durationMs: number;
    durationApiMs?: number;
    numTurns: number;
  };
  sessionId: string;
  timestamp: number;
};

/**
 * Result type for command execution
 */
export type CommandResult<T> = {
  success: boolean;
  data?: T;
  error?: { type: string; message: string };
  sessionId: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
};

/**
 * Context passed to prompt template function
 */
export type PromptContext = {
  /** Content ID / Session ID */
  contentId: string;
  /** Path to content file relative to workspace */
  contentPath: string;
  /** Workspace root path */
  workspace: string;
};

/**
 * Command Definition - the core abstraction
 *
 * Defines everything needed to execute a command:
 * - What prompt to send (promptTemplate)
 * - What output to expect (outputSchema)
 *
 * Note: Display configuration moved to CLI layer (Clean Architecture)
 */
export type CommandDefinition<TOutput = unknown> = {
  /** Unique command name */
  name: string;
  /** Function that generates the prompt from context */
  promptTemplate: (context: PromptContext) => string;
  /** Zod schema for output validation */
  outputSchema: z.ZodType<TOutput>;
};

/**
 * Agent Executor Interface
 *
 * Provider layer implements this interface.
 * This is the dependency inversion - core defines the interface,
 * provider implements it.
 */
export type AgentExecutor = {
  /**
   * Execute a command with streaming output
   */
  executeStreaming<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: ExecutorOptions
  ): AsyncGenerator<StreamingEvent, CommandResult<T>>;

  /**
   * Execute a command in batch mode (no streaming)
   */
  execute<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: ExecutorOptions
  ): Promise<CommandResult<T>>;
};

/**
 * Options for executor
 */
export type ExecutorOptions = {
  /** Workspace path for file operations */
  workspace: string;
  /** Content ID for session tracking */
  contentId: string;
};
