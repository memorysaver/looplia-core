/**
 * SDK Message to StreamingEvent Transformer
 *
 * Converts Claude Agent SDK messages into simplified streaming events
 * for UI consumption. Handles the nested content block structure where
 * tool_use and tool_result are inside assistant/user messages.
 */

import type {
  CompleteEvent,
  StreamingEvent,
  ToolEndEvent,
  ToolStartEvent,
} from "./types";

/**
 * Context maintained across message transformations
 */
export type TransformContext = {
  model: string;
  sessionId: string;
  startTime: number;
  /** Map of tool_use_id -> tool info for correlating results */
  pendingTools: Map<string, { name: string; startTime: number }>;
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

/**
 * Transform SDK messages to streaming events
 *
 * IMPORTANT: Tool calls and results are NESTED inside assistant/user messages
 * as content blocks, NOT separate top-level message types.
 *
 * This is a generator function that can yield multiple events per message
 * (e.g., assistant message with multiple content blocks).
 */
export function* transformSdkMessage(
  message: Record<string, unknown>,
  context: TransformContext
): Generator<StreamingEvent> {
  const timestamp = Date.now();

  switch (message.type) {
    case "system":
      yield* handleSystemMessage(message, context, timestamp);
      break;

    case "assistant":
      yield* handleAssistantMessage(message, context, timestamp);
      break;

    case "user":
      yield* handleUserMessage(message, context, timestamp);
      break;

    case "stream_event":
      yield* handleStreamEvent(message, timestamp);
      break;

    case "result":
      yield* handleResultMessage(message, context, timestamp);
      break;
  }
}

/**
 * Handle system messages (init, compact_boundary)
 */
function* handleSystemMessage(
  message: Record<string, unknown>,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  if (message.subtype === "init") {
    context.sessionId = (message.session_id as string) ?? "";
    yield {
      type: "session_start",
      sessionId: context.sessionId,
      model: (message.model as string) ?? context.model,
      availableTools: (message.tools as string[]) ?? [],
      timestamp,
    };
  }
  // compact_boundary is ignored for now
}

/**
 * Handle assistant messages - extract content blocks
 */
function* handleAssistantMessage(
  message: Record<string, unknown>,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const assistantMessage = message.message as {
    content?: Array<Record<string, unknown>>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  if (!assistantMessage?.content) return;

  // Update cumulative usage
  if (assistantMessage.usage) {
    context.cumulativeUsage.inputTokens +=
      assistantMessage.usage.input_tokens ?? 0;
    context.cumulativeUsage.outputTokens +=
      assistantMessage.usage.output_tokens ?? 0;
  }

  // Process each content block
  for (const block of assistantMessage.content) {
    switch (block.type) {
      case "text":
        yield {
          type: "text",
          content: truncate(block.text as string, 200),
          timestamp,
        };
        break;

      case "thinking":
        yield {
          type: "thinking",
          content: truncate(block.thinking as string, 200),
          timestamp,
        };
        break;

      case "tool_use": {
        // Store pending tool for result correlation
        const toolUseId = block.id as string;
        const toolName = block.name as string;
        context.pendingTools.set(toolUseId, {
          name: toolName,
          startTime: timestamp,
        });

        yield {
          type: "tool_start",
          toolUseId,
          tool: toolName,
          input: extractToolInput(
            toolName,
            block.input as Record<string, unknown>
          ),
          timestamp,
        };
        break;
      }
    }
  }
}

/**
 * Handle user messages - extract tool results
 */
function* handleUserMessage(
  message: Record<string, unknown>,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const userMessage = message.message as {
    content?: Array<Record<string, unknown>>;
  };

  if (!userMessage?.content) return;

  for (const block of userMessage.content) {
    if (block.type === "tool_result") {
      const toolUseId = block.tool_use_id as string;
      const pendingTool = context.pendingTools.get(toolUseId);

      if (pendingTool) {
        const durationMs = timestamp - pendingTool.startTime;
        context.pendingTools.delete(toolUseId);

        yield {
          type: "tool_end",
          toolUseId,
          tool: pendingTool.name,
          success: !block.is_error,
          summary: summarizeToolOutput(block.content),
          durationMs,
          timestamp,
        };
      }
    }
  }
}

/**
 * Handle stream events for real-time updates
 */
function* handleStreamEvent(
  message: Record<string, unknown>,
  timestamp: number
): Generator<StreamingEvent> {
  const event = message.event as Record<string, unknown>;
  if (!event) return;

  if (event.type === "content_block_delta") {
    const delta = event.delta as Record<string, unknown>;
    if (delta?.type === "text_delta") {
      yield {
        type: "text_delta",
        text: delta.text as string,
        timestamp,
      };
    } else if (delta?.type === "thinking_delta") {
      yield {
        type: "thinking_delta",
        thinking: delta.thinking as string,
        timestamp,
      };
    }
  }
}

/**
 * Handle result message - final output
 */
function* handleResultMessage(
  message: Record<string, unknown>,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const usage = message.usage as Record<string, number> | undefined;

  yield {
    type: "complete",
    subtype: message.subtype as CompleteEvent["subtype"],
    result: message.structured_output,
    usage: {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      totalCostUsd: (message.total_cost_usd as number) ?? 0,
    },
    metrics: {
      durationMs: (message.duration_ms as number) ?? 0,
      durationApiMs: message.duration_api_ms as number | undefined,
      numTurns: (message.num_turns as number) ?? 0,
    },
    sessionId: context.sessionId,
    timestamp,
  };
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
      return { path: input.file_path as string };
    case "Skill":
      return { skill: input.skill as string };
    case "Write":
      return { path: input.file_path as string };
    case "Glob":
      return { pattern: input.pattern as string };
    case "Grep":
      return { pattern: input.pattern as string };
    default:
      return { raw: input };
  }
}

/**
 * Summarize tool output for display
 */
function summarizeToolOutput(content: unknown): string {
  if (typeof content === "string") {
    return truncate(content, 100);
  }
  if (Array.isArray(content)) {
    return `${content.length} items`;
  }
  return "completed";
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 3)}...`;
}
