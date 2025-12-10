/**
 * SDK Message to StreamingEvent Transformer
 *
 * Converts Claude Agent SDK messages into simplified streaming events
 * for UI consumption. Uses proper SDK type definitions for type safety.
 *
 * Architecture:
 * - SDK Types (sdk-types.ts): Input message types from the SDK
 * - Streaming Types (types.ts): Output event types for UI
 * - Transformer (this file): Stateful conversion logic
 *
 * @see https://platform.claude.com/docs/en/agent-sdk/typescript#message-types
 */

import type {
  ContentBlock,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKStreamEvent,
  SDKSystemMessage,
  SDKUserMessage,
  TextBlock,
  ThinkingBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "./sdk-types";
import type {
  CompleteEvent,
  StreamingEvent,
  ToolStartEvent,
  UsageEvent,
} from "./types";

// ============================================================================
// Regex patterns (top-level for performance)
// ============================================================================

const TOOL_ERROR_REGEX = /<tool_use_error>(.*?)<\/tool_use_error>/s;
const LINE_NUMBER_REGEX = /^\s*\d+→/;
const DIRECTORY_LISTING_REGEX = /^drwx/;

// ============================================================================
// Transform Context - Maintains state across message transformations
// ============================================================================

/**
 * Pending tool information for correlating tool_use with tool_result
 */
type PendingTool = {
  name: string;
  startTime: number;
};

/**
 * Context maintained across message transformations
 */
export type TransformContext = {
  model: string;
  sessionId: string;
  startTime: number;
  /** Map of tool_use_id -> tool info for correlating results */
  pendingTools: Map<string, PendingTool>;
  /** Accumulated usage from assistant messages */
  cumulativeUsage: { inputTokens: number; outputTokens: number };
};

/**
 * Create a new transform context
 */
export function createTransformContext(model: string): TransformContext {
  return {
    model,
    sessionId: "",
    startTime: Date.now(),
    pendingTools: new Map(),
    cumulativeUsage: { inputTokens: 0, outputTokens: 0 },
  };
}

// ============================================================================
// Main Transform Function
// ============================================================================

/**
 * Transform SDK messages to streaming events
 *
 * This is a generator function that can yield multiple events per message
 * (e.g., assistant message with multiple content blocks).
 */
export function* transformSdkMessage(
  message: Record<string, unknown>,
  context: TransformContext
): Generator<StreamingEvent> {
  const timestamp = Date.now();
  const messageType = message.type as string;

  switch (messageType) {
    case "system":
      yield* handleSystemMessage(
        message as unknown as SDKSystemMessage,
        context,
        timestamp
      );
      break;

    case "assistant":
      yield* handleAssistantMessage(
        message as unknown as SDKAssistantMessage,
        context,
        timestamp
      );
      break;

    case "user":
      yield* handleUserMessage(
        message as unknown as SDKUserMessage,
        context,
        timestamp
      );
      break;

    case "stream_event":
      yield* handleStreamEvent(message as unknown as SDKStreamEvent, timestamp);
      break;

    case "result":
      yield* handleResultMessage(
        message as unknown as SDKResultMessage,
        context,
        timestamp
      );
      break;

    default:
      // Unknown message types are silently ignored
      break;
  }
}

// ============================================================================
// Message Handlers - One per SDK message type
// ============================================================================

/**
 * Handle system messages (init, compact_boundary)
 */
function* handleSystemMessage(
  message: SDKSystemMessage,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  if (message.subtype === "init") {
    context.sessionId = message.session_id ?? "";

    yield {
      type: "session_start",
      sessionId: context.sessionId,
      model: message.model ?? context.model,
      availableTools: message.tools ?? [],
      timestamp,
    };
  }
  // compact_boundary is ignored for now
}

/**
 * Handle assistant messages - extract content blocks and usage
 */
function* handleAssistantMessage(
  message: SDKAssistantMessage,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const apiMessage = message.message;
  if (!apiMessage?.content) {
    return;
  }

  // Emit usage event if available
  if (apiMessage.usage) {
    const usage = apiMessage.usage;
    context.cumulativeUsage.inputTokens += usage.input_tokens ?? 0;
    context.cumulativeUsage.outputTokens += usage.output_tokens ?? 0;

    yield {
      type: "usage",
      inputTokens: context.cumulativeUsage.inputTokens,
      outputTokens: context.cumulativeUsage.outputTokens,
      timestamp,
    } satisfies UsageEvent;
  }

  // Process each content block
  for (const block of apiMessage.content) {
    yield* processContentBlock(block, context, timestamp);
  }
}

/**
 * Handle user messages - extract tool results
 */
function* handleUserMessage(
  message: SDKUserMessage,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const apiMessage = message.message;
  if (!apiMessage?.content) {
    return;
  }

  for (const block of apiMessage.content) {
    if (block.type === "tool_result") {
      yield* processToolResult(block as ToolResultBlock, context, timestamp);
    }
  }
}

/**
 * Handle stream events for real-time deltas
 */
function* handleStreamEvent(
  message: SDKStreamEvent,
  timestamp: number
): Generator<StreamingEvent> {
  const event = message.event;
  if (!event || event.type !== "content_block_delta") {
    return;
  }

  const delta = event.delta as {
    type: string;
    text?: string;
    thinking?: string;
  };

  if (delta.type === "text_delta" && delta.text) {
    yield { type: "text_delta", text: delta.text, timestamp };
  } else if (delta.type === "thinking_delta" && delta.thinking) {
    yield { type: "thinking_delta", thinking: delta.thinking, timestamp };
  }
}

/**
 * Handle result message - final output
 */
function* handleResultMessage(
  message: SDKResultMessage,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const usage = message.usage;

  yield {
    type: "complete",
    subtype:
      message.subtype === "success"
        ? "success"
        : mapErrorSubtype(message.subtype),
    result:
      message.subtype === "success"
        ? (message as { structured_output?: unknown }).structured_output
        : undefined,
    usage: {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      totalCostUsd: message.total_cost_usd ?? 0,
    },
    metrics: {
      durationMs: message.duration_ms ?? 0,
      durationApiMs: message.duration_api_ms,
      numTurns: message.num_turns ?? 0,
    },
    sessionId: context.sessionId,
    timestamp,
  } satisfies CompleteEvent;
}

// ============================================================================
// Content Block Processors
// ============================================================================

/**
 * Process a single content block from assistant message
 */
function* processContentBlock(
  block: ContentBlock,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  switch (block.type) {
    case "text":
      yield processTextBlock(block, timestamp);
      break;

    case "thinking":
      yield processThinkingBlock(block, timestamp);
      break;

    case "tool_use":
      yield processToolUseBlock(block, context, timestamp);
      break;

    default:
      // tool_result blocks are handled in handleUserMessage
      break;
  }
}

/**
 * Process text content block
 */
function processTextBlock(block: TextBlock, timestamp: number): StreamingEvent {
  return {
    type: "text",
    content: truncate(block.text, 200),
    timestamp,
  };
}

/**
 * Process thinking content block
 */
function processThinkingBlock(
  block: ThinkingBlock,
  timestamp: number
): StreamingEvent {
  return {
    type: "thinking",
    content: truncate(block.thinking, 200),
    timestamp,
  };
}

/**
 * Process tool_use content block
 */
function processToolUseBlock(
  block: ToolUseBlock,
  context: TransformContext,
  timestamp: number
): StreamingEvent {
  // Store pending tool for result correlation
  context.pendingTools.set(block.id, {
    name: block.name,
    startTime: timestamp,
  });

  return {
    type: "tool_start",
    toolUseId: block.id,
    tool: block.name,
    input: extractToolInput(block.name, block.input),
    timestamp,
  };
}

/**
 * Process tool_result content block
 */
function* processToolResult(
  block: ToolResultBlock,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const pendingTool = context.pendingTools.get(block.tool_use_id);
  if (!pendingTool) {
    return;
  }

  const durationMs = timestamp - pendingTool.startTime;
  context.pendingTools.delete(block.tool_use_id);

  yield {
    type: "tool_end",
    toolUseId: block.tool_use_id,
    tool: pendingTool.name,
    success: !block.is_error,
    summary: summarizeToolOutput(block.content),
    durationMs,
    timestamp,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Map SDK error subtypes to our simplified error subtypes
 */
function mapErrorSubtype(subtype: string): CompleteEvent["subtype"] {
  if (subtype === "error_max_turns") {
    return "error_max_turns";
  }
  return "error_during_execution";
}

/**
 * Extract relevant input fields based on tool type
 */
function extractToolInput(
  toolName: string,
  input: Record<string, unknown>
): ToolStartEvent["input"] {
  switch (toolName) {
    case "Read":
    case "Write":
      return { path: input.file_path as string | undefined };
    case "Skill":
      return { skill: input.skill as string | undefined };
    case "Glob":
    case "Grep":
      return { pattern: input.pattern as string | undefined };
    default:
      return { raw: input };
  }
}

/**
 * Summarize tool output for display
 *
 * Creates clean, human-readable summaries instead of raw output
 */
function summarizeToolOutput(content: unknown): string {
  if (typeof content === "string") {
    return summarizeStringOutput(content);
  }
  if (Array.isArray(content)) {
    return `${content.length} items`;
  }
  return "completed";
}

/**
 * Summarize string output with smart detection
 */
function summarizeStringOutput(content: string): string {
  // Error messages
  if (content.includes("<tool_use_error>")) {
    const match = TOOL_ERROR_REGEX.exec(content);
    const errorMsg = match?.[1]?.trim();
    return errorMsg ? `Error: ${truncate(errorMsg, 50)}` : "Error";
  }

  // File content with line numbers (format: "     1→")
  if (LINE_NUMBER_REGEX.test(content)) {
    const lines = content.split("\n").filter((l) => l.trim());
    return `${lines.length} lines`;
  }

  // Directory listing (ls output)
  if (content.startsWith("total ") || DIRECTORY_LISTING_REGEX.test(content)) {
    return "directory listed";
  }

  // JSON data
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "JSON data";
  }

  // Generic text - clean and truncate
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > 50 ? `${clean.slice(0, 47)}...` : clean || "completed";
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return `${str.slice(0, maxLen - 3)}...`;
}
