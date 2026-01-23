/**
 * Streaming Query Executor
 *
 * Executes agentic queries against the Claude Agent SDK with streaming events.
 * Yields StreamingEvent objects for UI consumption while processing SDK messages.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  getLoopliaPluginPath,
  getPluginPaths,
  getSelectivePluginPaths,
} from "../../bootstrap";
import { findClaudeCodePath } from "../claude-code-path";
import type { ClaudeAgentConfig } from "../config";
import { resolveConfig } from "../config";
import { createQueryLogger } from "../logger";
import { mapException } from "../utils/error-mapper";
import type { AgenticQueryResult } from "../utils/shared";
import {
  extractContentIdFromPrompt,
  extractSandboxResult,
  getOrInitWorkspace,
} from "../utils/shared";
import {
  getMainModel,
  initializeAndValidateApiKey,
  processEvent,
} from "./executor-common";
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
import type { StreamingEvent } from "./types";

/**
 * Execute agentic query with streaming events
 *
 * Key SDK options:
 * - allowedTools: ["Read", "Skill"] - Tools the agent can use
 *
 * Note: outputFormat (json_schema) was removed to support non-Anthropic models.
 * Final results are now extracted from sandbox output files after workflow completion.
 *
 * @see openspec/changes/remove-structuredoutput-enforcement/design.md
 * @yields StreamingEvent objects for UI consumption
 * @returns Final AgenticQueryResult on completion
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SDK integration requires consolidated orchestration logic
export async function* executeAgenticQueryStreaming<T>(
  prompt: string,
  _jsonSchema: Record<string, unknown>,
  config?: ClaudeAgentConfig
): AsyncGenerator<StreamingEvent, AgenticQueryResult<T>> {
  const resolvedConfig = resolveConfig(config);

  // v0.6.9: Initialize settings and validate API key
  await initializeAndValidateApiKey(config);

  // v0.6.9: Get configured main model (executor model removed - using built-in general-purpose)
  const mainModel = getMainModel();

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

    // v0.7.0: Use selective loading when requiredSkills is provided
    // Falls back to loading all plugins if not specified (backward compatible)
    const pluginPaths = config?.requiredSkills
      ? await getSelectivePluginPaths(config.requiredSkills)
      : await getPluginPaths();

    // v0.6.5: Capture user's working directory before SDK starts
    const userCwd = process.cwd();
    const loopliaHome = getLoopliaPluginPath();

    // v0.6.8: Resolve Claude Code executable path (optional)
    // Returns undefined if not found, allowing SDK to use built-in executable
    const claudeCodePath = findClaudeCodePath();

    const result = query({
      prompt,
      options: {
        // v0.6.8: Use system-installed Claude Code if available, otherwise SDK uses built-in
        ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
        // v0.6.6: Use configured main model
        model: mainModel,
        // v0.6.5: SDK works relative to ~/.looplia (sandbox, workflows, etc.)
        cwd: loopliaHome,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        // v0.6.5: Load plugins from local paths instead of project settings
        plugins: pluginPaths,
        // v0.6.5: Append looplia system prompt + user context to claude_code preset
        // v0.6.9: Removed provider-aware hint - unified subagent strategy for all providers
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `${loopliaSystemPrompt}\n\n## User Context\n\nUser Working Directory: ${userCwd}\n\nWhen processing --file arguments or user file paths, resolve them against the User Working Directory above.`,
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
        // v0.7.2: Removed outputFormat to support non-Anthropic models
        // Final results are now extracted from sandbox output files via extractSandboxResult()
        // v0.6.9: No custom agents - using built-in general-purpose for workflow steps

        // v0.7.4: Pass runHooks from config if provided (workflow protection)
        // Only the run command passes hooks - other SDK usage doesn't need them
        ...(config?.runHooks && { hooks: config.runHooks }),
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

    // v0.7.2: If no result from StructuredOutput (e.g., non-Anthropic models),
    // extract the final artifact from sandbox output files
    if (!finalResult) {
      finalResult = await extractSandboxResult<T>();
    }

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
