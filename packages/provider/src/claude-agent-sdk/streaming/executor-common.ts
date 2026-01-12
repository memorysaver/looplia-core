/**
 * Shared Executor Utilities
 *
 * Common initialization and helper functions for both query executors.
 * Ensures consistent model/endpoint configuration across all commands.
 *
 * v0.7.1: Extracted from query-executor.ts and interactive-query-executor.ts
 * to guarantee identical initialization logic for CLI and SDK usage.
 */

import type { ClaudeAgentConfig, ProviderUsage } from "../config";
import {
  DEFAULT_SETTINGS,
  injectLoopliaSettingsEnv,
  readLoopliaSettings,
} from "../model-provider";
import type { AgenticQueryResult } from "../utils/shared";
import type { ProgressTracker } from "./progress-tracker";
import type { TransformContext } from "./transformer";
import type { CompleteEvent, StreamingEvent } from "./types";

/**
 * Get API key from config or environment
 * ZenMux and other providers use ANTHROPIC_API_KEY (same as Anthropic SDK)
 */
export function getApiKey(config?: ClaudeAgentConfig): string | undefined {
  return (
    config?.apiKey ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.CLAUDE_CODE_OAUTH_TOKEN
  );
}

/**
 * Initialize settings and validate API key
 * Loads settings from ~/.looplia/looplia.setting.json and injects env vars
 *
 * This is the single source of truth for executor initialization.
 * Both query-executor and interactive-query-executor use this function.
 */
export async function initializeAndValidateApiKey(
  config?: ClaudeAgentConfig
): Promise<string> {
  // Load and inject looplia settings BEFORE API key check
  const settings = await readLoopliaSettings();
  if (settings) {
    injectLoopliaSettingsEnv(settings);
  }

  // Check API key AFTER settings injection
  const apiKey = getApiKey(config);
  if (!apiKey) {
    throw new Error(
      "API key is required. Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable"
    );
  }

  return apiKey;
}

/**
 * Get configured main agent model from environment
 */
export function getMainModel(): string {
  return process.env.LOOPLIA_AGENT_MODEL_MAIN ?? DEFAULT_SETTINGS.agents.main;
}

/**
 * Build final result from complete event
 */
export function buildFinalResult<T>(
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
 * Process a single streaming event - handle progress and capture result
 */
export function* processEvent<T>(
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
