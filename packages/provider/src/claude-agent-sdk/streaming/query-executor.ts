/**
 * Streaming Query Executor
 *
 * Executes agentic queries against the Claude Agent SDK with streaming events.
 * Yields StreamingEvent objects for UI consumption while processing SDK messages.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

import type {
  ClaudeAgentConfig,
  ProviderResultWithUsage,
  ProviderUsage,
} from "../config";
import { resolveConfig } from "../config";
import { createQueryLogger } from "../logger";
import { mapException } from "../utils/error-mapper";
import { ensureWorkspace } from "../workspace";
import { ProgressTracker } from "./progress-tracker";
import {
  createTransformContext,
  transformSdkMessage,
  type TransformContext,
} from "./transformer";
import type { CompleteEvent, StreamingEvent } from "./types";

/** Cached workspace paths to avoid repeated filesystem checks */
const workspaceCache = new Map<string, string>();

/** Regex to extract content ID from prompt */
const CONTENT_ID_REGEX = /contentItem\/([^\s/]+)/;

/** Whitelist pattern for valid content IDs */
const VALID_CONTENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Result type that includes session ID from SDK
 */
export type AgenticQueryResult<T> = ProviderResultWithUsage<T> & {
  sessionId?: string;
};

/**
 * Get or initialize workspace with caching
 */
async function getOrInitWorkspace(
  baseDir: string,
  useFilesystemExtensions: boolean
): Promise<string> {
  const cacheKey = `${baseDir}:${useFilesystemExtensions}`;

  const cached = workspaceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const workspace = await ensureWorkspace({
    baseDir,
    skipPluginBootstrap: !useFilesystemExtensions,
  });
  workspaceCache.set(cacheKey, workspace);
  return workspace;
}

/**
 * Extract content ID from agentic prompt with path traversal protection
 */
export function extractContentIdFromPrompt(prompt: string): string | null {
  const match = prompt.match(CONTENT_ID_REGEX);
  const rawId = match?.[1];

  if (!rawId) return null;

  let decodedId: string;
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {
    return null;
  }

  if (decodedId.includes("\0")) return null;
  if (
    decodedId.includes("..") ||
    decodedId.includes("/") ||
    decodedId.includes("\\")
  ) {
    return null;
  }

  if (!VALID_CONTENT_ID_PATTERN.test(decodedId)) return null;

  return decodedId;
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

  // Validate API key
  const apiKey =
    config?.apiKey ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.CLAUDE_CODE_OAUTH_TOKEN;

  if (!apiKey) {
    return {
      success: false,
      error: {
        type: "validation_error",
        field: "apiKey",
        message:
          "API key is required. Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable",
      },
    };
  }

  try {
    // Get or initialize workspace
    const workspace =
      config?.workspace ??
      (await getOrInitWorkspace(
        resolvedConfig.workspace,
        resolvedConfig.useFilesystemExtensions
      ));

    // Initialize query logger
    const contentId = extractContentIdFromPrompt(prompt);
    const logger = createQueryLogger(workspace);
    if (contentId) {
      logger.init(contentId);
      logger.log({ type: "prompt", content: prompt });
    }

    // Initialize progress tracking
    const progressTracker = new ProgressTracker();

    // Emit initial progress event
    yield {
      type: "progress",
      step: "initializing",
      percent: 5,
      message: "Initializing session...",
      timestamp: Date.now(),
    };

    // Create transform context
    const context: TransformContext = createTransformContext(
      resolvedConfig.model
    );

    // Execute SDK query
    const result = query({
      prompt,
      options: {
        model: resolvedConfig.model,
        cwd: workspace,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        allowedTools: ["Read", "Skill"],
        outputFormat: {
          type: "json_schema",
          schema: jsonSchema,
        },
      },
    });

    let finalResult: AgenticQueryResult<T> | undefined;

    for await (const message of result) {
      // Log all messages for debugging
      if (contentId) {
        logger.log(message as Record<string, unknown>);
      }

      // Transform SDK message to streaming events
      // Note: Generator function can yield multiple events per message
      for (const event of transformSdkMessage(
        message as Record<string, unknown>,
        context
      )) {
        // Check for progress update on skill invocations
        if (event.type === "tool_start" && event.tool === "Skill") {
          const progressEvent = progressTracker.onToolStart(
            event.tool,
            event.input
          );
          if (progressEvent) {
            yield progressEvent;
          }
        }

        // Yield the event to UI
        yield event;

        // Capture final result
        if (event.type === "complete") {
          const completeEvent = event as CompleteEvent<T>;
          const usage: ProviderUsage = {
            inputTokens: completeEvent.usage.inputTokens,
            outputTokens: completeEvent.usage.outputTokens,
            totalCostUsd: completeEvent.usage.totalCostUsd,
          };

          if (completeEvent.subtype === "success") {
            finalResult = {
              success: true,
              data: completeEvent.result,
              usage,
              sessionId: context.sessionId,
            };
          } else {
            finalResult = {
              success: false,
              error: {
                type: "unknown",
                message: `Agent execution ended with: ${completeEvent.subtype}`,
              },
              usage,
              sessionId: context.sessionId,
            };
          }
        }
      }
    }

    logger.close();

    // Yield final progress event
    yield progressTracker.onComplete();

    // Return final result
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
