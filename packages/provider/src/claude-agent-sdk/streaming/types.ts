/**
 * Streaming Event Types for CLI UI
 *
 * These are PROVIDER events (not SDK messages). The transformer
 * converts SDK messages into these simplified events for UI consumption.
 */

/**
 * Union type of all streaming events
 */
export type StreamingEvent =
  | SessionStartEvent
  | TextEvent
  | TextDeltaEvent
  | ThinkingEvent
  | ThinkingDeltaEvent
  | ToolStartEvent
  | ToolEndEvent
  | ProgressEvent
  | ErrorEvent
  | CompleteEvent;

/**
 * Session initialized - from SDK system.init message
 */
export type SessionStartEvent = {
  type: "session_start";
  sessionId: string;
  model: string;
  /** Tools available for this session */
  availableTools: string[];
  timestamp: number;
};

/**
 * Text output from agent - from assistant.message.content[].text
 */
export type TextEvent = {
  type: "text";
  content: string;
  timestamp: number;
};

/**
 * Streaming text delta - from stream_event.content_block_delta.text_delta
 * Only emitted when includePartialMessages: true
 */
export type TextDeltaEvent = {
  type: "text_delta";
  text: string;
  timestamp: number;
};

/**
 * Agent thinking/reasoning - from assistant.message.content[].thinking
 */
export type ThinkingEvent = {
  type: "thinking";
  content: string;
  timestamp: number;
};

/**
 * Streaming thinking delta - from stream_event.content_block_delta.thinking_delta
 * Only emitted when includePartialMessages: true
 */
export type ThinkingDeltaEvent = {
  type: "thinking_delta";
  thinking: string;
  timestamp: number;
};

/**
 * Tool invocation started - from assistant.message.content[].tool_use block
 */
export type ToolStartEvent = {
  type: "tool_start";
  /** Unique ID for correlating with tool_end */
  toolUseId: string;
  tool: string;
  input: {
    /** For Read/Write: file path */
    path?: string;
    /** For Skill: skill name */
    skill?: string;
    /** For Glob/Grep: search pattern */
    pattern?: string;
    /** For other tools: raw input */
    raw?: unknown;
  };
  timestamp: number;
};

/**
 * Tool invocation completed - from user.message.content[].tool_result block
 */
export type ToolEndEvent = {
  type: "tool_end";
  /** Correlates with ToolStartEvent.toolUseId */
  toolUseId: string;
  tool: string;
  success: boolean;
  /** Summary of output (truncated for display) */
  summary?: string;
  /** Duration in milliseconds */
  durationMs: number;
  timestamp: number;
};

/**
 * Pipeline progress update - inferred from skill invocations
 */
export type ProgressEvent = {
  type: "progress";
  /** Current pipeline step */
  step:
    | "initializing"
    | "analyzing"
    | "generating_ideas"
    | "building_outline"
    | "assembling_kit";
  /** 0-100 percentage */
  percent: number;
  /** Human-readable message */
  message: string;
  timestamp: number;
};

/**
 * Non-fatal error or warning
 */
export type ErrorEvent = {
  type: "error";
  code: string;
  message: string;
  recoverable: boolean;
  timestamp: number;
};

/**
 * Query completed - from SDK result message
 */
export type CompleteEvent<T = unknown> = {
  type: "complete";
  /** Result subtype from SDK */
  subtype: "success" | "error_max_turns" | "error_during_execution";
  result: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
  /** Execution metrics from SDK */
  metrics: {
    durationMs: number;
    durationApiMs?: number;
    numTurns: number;
  };
  sessionId: string;
  timestamp: number;
};
