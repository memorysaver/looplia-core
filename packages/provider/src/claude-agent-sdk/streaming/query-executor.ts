/**
 * Streaming Query Executor
 *
 * Executes agentic queries against the Claude Agent SDK with streaming events.
 * Yields StreamingEvent objects for UI consumption while processing SDK messages.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

import type { ClaudeAgentConfig, ProviderUsage } from "../config";
import { resolveConfig } from "../config";
import { createQueryLogger } from "../logger";
import { mapException } from "../utils/error-mapper";
import type { AgenticQueryResult } from "../utils/shared";
import {
  extractContentIdFromPrompt,
  getOrInitWorkspace,
} from "../utils/shared";

// Re-export for backward compatibility - intentional to maintain API surface
// biome-ignore lint/performance/noBarrelFile: intentional re-export for backward compatibility
export {
  type AgenticQueryResult,
  extractContentIdFromPrompt,
} from "../utils/shared";

import { ProgressTracker } from "./progress-tracker";
import {
  createTransformContext,
  type TransformContext,
  transformSdkMessage,
} from "./transformer";
import type { CompleteEvent, StreamingEvent } from "./types";

/**
 * Build final result from complete event
 */
function buildFinalResult<T>(
  event: CompleteEvent<T>,
  sessionId: string
): AgenticQueryResult<T> {
  const usage: ProviderUsage = {
    inputTokens: event.usage.inputTokens,
    outputTokens: event.usage.outputTokens,
    totalCostUsd: event.usage.totalCostUsd,
  };

  if (event.subtype === "success") {
    return {
      success: true,
      data: event.result,
      usage,
      sessionId,
    };
  }

  return {
    success: false,
    error: {
      type: "unknown",
      message: `Agent execution ended with: ${event.subtype}`,
    },
    usage,
    sessionId,
  };
}

/**
 * Get API key from config or environment
 */
function getApiKey(config?: ClaudeAgentConfig): string | undefined {
  return (
    config?.apiKey ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.CLAUDE_CODE_OAUTH_TOKEN
  );
}

/**
 * Process a single streaming event - handle progress and capture result
 */
function* processEvent<T>(
  event: StreamingEvent,
  progressTracker: ProgressTracker,
  context: TransformContext
): Generator<StreamingEvent, AgenticQueryResult<T> | undefined> {
  // Check for progress update on skill invocations
  if (event.type === "tool_start" && event.tool === "Skill") {
    const progressEvent = progressTracker.onToolStart(event.tool, event.input);
    if (progressEvent) {
      yield progressEvent;
    }
  }

  yield event;

  // Capture and return final result if complete
  if (event.type === "complete") {
    return buildFinalResult(event as CompleteEvent<T>, context.sessionId);
  }
}

/**
 * Execute agentic query with streaming events
 *
 * Key SDK options:
 * - allowedTools: ["Read", "Skill"] - Tools the agent can use
 * - outputFormat: json_schema - Structured output validation
 *
 * @yields StreamingEvent objects for UI consumption
 * @returns Final AgenticQueryResult on completion
 */
export async function* executeAgenticQueryStreaming<T>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  config?: ClaudeAgentConfig
): AsyncGenerator<StreamingEvent, AgenticQueryResult<T>> {
  const resolvedConfig = resolveConfig(config);
  const apiKey = getApiKey(config);

  if (!apiKey) {
    throw new Error(
      "API key is required. Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable"
    );
  }

  try {
    const workspace =
      config?.workspace ??
      (await getOrInitWorkspace(
        resolvedConfig.workspace,
        resolvedConfig.useFilesystemExtensions
      ));

    const contentId = extractContentIdFromPrompt(prompt);
    const logger = createQueryLogger(workspace);
    if (contentId) {
      logger.init(contentId);
      logger.log({ type: "prompt", content: prompt });
    }

    // Emit prompt event for UI display
    yield {
      type: "prompt",
      content: prompt,
      timestamp: Date.now(),
    };

    const progressTracker = new ProgressTracker();
    yield {
      type: "progress",
      step: "initializing",
      percent: 5,
      message: "Initializing session...",
      timestamp: Date.now(),
    };

    const context: TransformContext = createTransformContext(
      resolvedConfig.model
    );

    const result = query({
      prompt,
      options: {
        model: resolvedConfig.model,
        cwd: workspace,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        allowedTools: ["Read", "Skill"],
        outputFormat: { type: "json_schema", schema: jsonSchema },
      },
    });

    let finalResult: AgenticQueryResult<T> | undefined;

    for await (const message of result) {
      if (contentId) {
        logger.log(message as Record<string, unknown>);
      }

      for (const event of transformSdkMessage(
        message as Record<string, unknown>,
        context
      )) {
        const eventResult = yield* processEvent<T>(
          event,
          progressTracker,
          context
        );
        if (eventResult) {
          finalResult = eventResult;
        }
      }
    }

    logger.close();
    yield progressTracker.onComplete();

    return (
      finalResult ?? {
        success: false,
        error: { type: "unknown", message: "No result received" },
      }
    );
  } catch (error) {
    return mapException(error);
  }
}
