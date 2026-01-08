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
  | CompleteEvent
  | AskUserQuestionEvent;

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
 * AskUserQuestion tool invocation - for interactive mode (v0.7.1)
 * Emitted when the agent needs user input via AskUserQuestion tool
 */
export type AskUserQuestionEvent = {
  type: "ask_user_question";
  toolUseId: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{
      label: string;
      description: string;
    }>;
    multiSelect: boolean;
  }>;
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

  // v0.6.0 Workflow fields
  /** Workflow name (e.g., "writing-kit") */
  workflowName?: string;
  /** Path to workflow file relative to workspace (e.g., "workflows/writing-kit.md") */
  workflowPath?: string;
  /** Workflow definition as YAML string for embedding in prompt */
  workflowDefinition?: string;
  /** Custom instructions from workflow markdown body */
  workflowInstructions?: string;
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
 * v0.6.0: Generic workflow result for prompt-based execution
 */
export type WorkflowResult = {
  status: "success" | "error" | "partial";
  sessionId?: string;
  workflowId?: string;
  artifact?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
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

  /**
   * v0.6.0: Execute a prompt without schema (thin wrapper pattern)
   * Used by CLI to inject /run commands
   */
  executePromptStreaming(
    prompt: string,
    options: ExecutorOptions
  ): AsyncGenerator<StreamingEvent, CommandResult<WorkflowResult>>;

  /**
   * v0.6.0: Execute a prompt without schema (non-streaming)
   */
  executePrompt(
    prompt: string,
    options: ExecutorOptions
  ): Promise<CommandResult<WorkflowResult>>;
};

/**
 * Options for executor
 */
export type ExecutorOptions = {
  /** Workspace path for file operations */
  workspace: string;
  /** Content ID for session tracking */
  contentId: string;
  /** Required skills for selective plugin loading (v0.7.0) */
  requiredSkills?: string[];
};
