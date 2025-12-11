/**
 * SDK Message Types
 *
 * Type definitions matching the Claude Agent SDK message structure.
 * These are the INPUT types from the SDK that we transform into StreamingEvents.
 *
 * @see https://platform.claude.com/docs/en/agent-sdk/typescript#message-types
 */

/**
 * Content block inside an assistant message
 */
export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock;

export type TextBlock = {
  type: "text";
  text: string;
};

export type ThinkingBlock = {
  type: "thinking";
  thinking: string;
};

export type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
};

/**
 * Usage statistics from the API
 */
export type ApiUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

/**
 * API message structure (nested inside SDK messages)
 */
export type ApiAssistantMessage = {
  content?: ContentBlock[];
  usage?: ApiUsage;
};

export type ApiUserMessage = {
  content?: ContentBlock[];
};

/**
 * SDK System Message - session initialization
 */
export type SDKSystemMessage = {
  type: "system";
  subtype: "init" | "compact_boundary";
  uuid: string;
  session_id: string;
  tools?: string[];
  model?: string;
  cwd?: string;
};

/**
 * SDK Assistant Message - model response
 */
export type SDKAssistantMessage = {
  type: "assistant";
  uuid: string;
  session_id: string;
  message: ApiAssistantMessage;
  parent_tool_use_id: string | null;
};

/**
 * SDK User Message - tool results
 */
export type SDKUserMessage = {
  type: "user";
  uuid?: string;
  session_id: string;
  message: ApiUserMessage;
  parent_tool_use_id: string | null;
};

/**
 * Stream event delta types
 */
export type ContentBlockDelta = {
  type: "content_block_delta";
  index: number;
  delta:
    | { type: "text_delta"; text: string }
    | { type: "thinking_delta"; thinking: string };
};

/**
 * SDK Partial Assistant Message - streaming deltas
 */
export type SDKStreamEvent = {
  type: "stream_event";
  event: ContentBlockDelta | Record<string, unknown>;
  parent_tool_use_id: string | null;
  uuid: string;
  session_id: string;
};

/**
 * Model usage statistics per model
 */
export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
};

/**
 * SDK Result Message - query completion
 */
export type SDKResultMessage = SDKSuccessResult | SDKErrorResult;

export type SDKSuccessResult = {
  type: "result";
  subtype: "success";
  uuid: string;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelUsage?: Record<string, ModelUsage>;
  structured_output?: unknown;
};

export type SDKErrorResult = {
  type: "result";
  subtype:
    | "error_max_turns"
    | "error_during_execution"
    | "error_max_budget_usd"
    | "error_max_structured_output_retries";
  uuid: string;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelUsage?: Record<string, ModelUsage>;
  errors: string[];
};

/**
 * Union of all SDK message types
 */
export type SDKMessage =
  | SDKSystemMessage
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKStreamEvent
  | SDKResultMessage;

/**
 * Type guard for SDK messages
 */
export function isSDKMessage(msg: unknown): msg is SDKMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    typeof (msg as { type: unknown }).type === "string"
  );
}
