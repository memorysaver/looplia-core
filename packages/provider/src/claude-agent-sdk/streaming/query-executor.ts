/**
 * Streaming Query Executor
 *
 * Executes agentic queries against the Claude Agent SDK with streaming events.
 * Yields StreamingEvent objects for UI consumption while processing SDK messages.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { getLoopliaPluginPath, getPluginPaths } from "../../bootstrap";
import { findClaudeCodePath } from "../claude-code-path";
import type { ClaudeAgentConfig, ProviderUsage } from "../config";
import { resolveConfig } from "../config";
import { createQueryLogger } from "../logger";
import {
  DEFAULT_SETTINGS,
  injectLoopliaSettingsEnv,
  readLoopliaSettings,
} from "../model-provider";
import { mapException } from "../utils/error-mapper";
import type { AgenticQueryResult } from "../utils/shared";
import {
  extractContentIdFromPrompt,
  getOrInitWorkspace,
} from "../utils/shared";
import { loopliaSystemPrompt } from "./prompts/looplia-system";

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
 * ZenMux and other providers use ANTHROPIC_API_KEY (same as Anthropic SDK)
 */
function getApiKey(config?: ClaudeAgentConfig): string | undefined {
  return (
    config?.apiKey ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.CLAUDE_CODE_OAUTH_TOKEN
  );
}

/**
 * Settings result including provider detection
 */
type InitResult = {
  apiKey: string;
  isProxyProvider: boolean;
};

/**
 * Initialize settings and validate API key
 * Returns the API key and provider type for conditional behavior
 */
async function initializeAndValidateApiKey(
  config?: ClaudeAgentConfig
): Promise<InitResult> {
  // v0.6.6: Load and inject looplia settings BEFORE API key check
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

  // v0.6.6: Only use proxy mode when settings EXPLICITLY specify non-anthropic provider
  // When settings is null (no config), default to Anthropic Direct (subagent mode)
  const isProxyProvider =
    settings !== null && settings.apiProvider.type !== "anthropic";

  return { apiKey, isProxyProvider };
}

/**
 * Get configured agent models from environment
 */
function getAgentModels(): { mainModel: string; executorModel: string } {
  return {
    mainModel:
      process.env.LOOPLIA_AGENT_MODEL_MAIN ?? DEFAULT_SETTINGS.agents.main,
    executorModel:
      process.env.LOOPLIA_AGENT_MODEL_EXECUTOR ??
      DEFAULT_SETTINGS.agents.executor,
  };
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

  // v0.6.6: Initialize settings and validate API key, detect provider type
  const { isProxyProvider } = await initializeAndValidateApiKey(config);

  // v0.6.6: Get configured agent models
  const { mainModel, executorModel } = getAgentModels();

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

    // v0.6.5: Get plugin paths based on mode (dev vs prod)
    const pluginPaths = await getPluginPaths();
    // v0.6.5: Capture user's working directory before SDK starts
    const userCwd = process.cwd();
    const loopliaHome = getLoopliaPluginPath();

    // v0.6.6: Provider-aware workflow execution hint
    // Proxy providers (ZenMux, custom) use inline execution skill
    const workflowExecutionHint = isProxyProvider
      ? `

## Workflow Execution Mode: Inline (Proxy Provider)

When executing looplia workflows (/run commands), use the "workflow-executor-inline" skill.
Execute all workflow steps INLINE without spawning Task subagents.
This ensures compatibility with your current API provider.`
      : "";

    // v0.6.6: Conditional agents - only register skill-executor for Anthropic Direct
    // Proxy providers don't support SDK subagents (model name incompatibility)
    const agents = isProxyProvider
      ? undefined
      : {
          "skill-executor": {
            description:
              "Universal skill orchestrator for looplia workflow steps. Executes a single workflow step by invoking skills.",
            prompt: `You are the looplia skill-executor. Execute ONE workflow step by invoking the specified skill.

## Execution Protocol
1. Read input files (if provided)
2. Invoke the skill using the Skill tool
3. Execute the mission with skill context
4. Write JSON output to the specified path using Write tool

## CRITICAL: Output Writing is MANDATORY
YOU MUST CALL THE WRITE TOOL before completing. If you don't write the file, the workflow fails.

## Rules
- ALWAYS invoke the specified skill using Skill tool
- ALWAYS write output to the exact path using Write tool
- NEVER return results as text - always write JSON to output file
- NEVER spawn Task subagents - execute skills directly
- ALWAYS include contentId in JSON outputs`,
            tools: [
              "Read",
              "Write",
              "Skill",
              "Glob",
              "Grep",
              "WebSearch",
              "WebFetch",
            ],
            model: executorModel as "haiku" | "sonnet" | "opus",
          },
        };

    // v0.6.8: Resolve Claude Code executable path
    const claudeCodePath = findClaudeCodePath();

    const result = query({
      prompt,
      options: {
        // v0.6.8: Use system-installed Claude Code
        pathToClaudeCodeExecutable: claudeCodePath,
        // v0.6.6: Use configured main model
        model: mainModel,
        // v0.6.5: SDK works relative to ~/.looplia (sandbox, workflows, etc.)
        cwd: loopliaHome,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        // v0.6.5: Load plugins from local paths instead of project settings
        plugins: pluginPaths,
        // v0.6.5: Append looplia system prompt + user context to claude_code preset
        // v0.6.6: Add provider-aware workflow hint for proxy providers
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `${loopliaSystemPrompt}\n\n## User Context\n\nUser Working Directory: ${userCwd}\n\nWhen processing --file arguments or user file paths, resolve them against the User Working Directory above.${workflowExecutionHint}`,
        },
        // v0.6.0: Enable Task for subagent spawning, Write/Glob for file operations
        // v0.6.3: Added WebSearch/WebFetch for input-less search skill
        allowedTools: [
          "Read",
          "Write",
          "Glob",
          "Task",
          "Skill",
          "WebSearch",
          "WebFetch",
        ],
        outputFormat: { type: "json_schema", schema: jsonSchema },
        // v0.6.6: Conditional agents - only for Anthropic Direct API
        agents,
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
