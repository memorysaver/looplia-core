/**
 * Interactive Query Executor (v0.7.1)
 *
 * Executes agentic queries with AskUserQuestion support via canUseTool callback.
 * Used by `build` command for interactive workflow building.
 *
 * For autonomous execution (`run` command), use query-executor.ts instead.
 *
 * Key differences from query-executor.ts:
 * - Uses permissionMode: "default" instead of "bypassPermissions"
 * - Implements canUseTool callback to handle AskUserQuestion
 * - Includes AskUserQuestion in allowedTools
 *
 * @see docs/DESIGN-0.7.1.md section 8
 */

import { join } from "node:path";
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
import { ProgressTracker } from "./progress-tracker";
import { loopliaSystemPrompt } from "./prompts/looplia-system";
import {
  createTransformContext,
  type TransformContext,
  transformSdkMessage,
} from "./transformer";
import type { StreamingEvent } from "./types";

/**
 * Question structure from AskUserQuestion tool
 */
export type AskUserQuestion = {
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
};

/**
 * Callback type for handling user questions
 * Called when the agent invokes AskUserQuestion tool
 *
 * @param questions - Array of questions to ask the user
 * @returns Promise resolving to answers (maps question text to answer string)
 */
export type QuestionCallback = (
  questions: AskUserQuestion[]
) => Promise<Record<string, string>>;

/**
 * Execute interactive query with AskUserQuestion support
 *
 * This executor is designed for interactive use cases (like `looplia build`)
 * where user input may be required during execution.
 *
 * Key differences from executeAgenticQueryStreaming:
 * - Uses permissionMode: "default" with custom canUseTool handler
 * - Supports AskUserQuestion tool via questionCallback
 * - Auto-approves all other tools (equivalent to bypass for non-question tools)
 *
 * @param prompt - The prompt to execute
 * @param jsonSchema - Output schema for structured output
 * @param config - Agent configuration
 * @param questionCallback - Optional callback to handle AskUserQuestion tool calls
 * @yields StreamingEvent objects for UI consumption
 * @returns Final AgenticQueryResult on completion
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SDK integration requires consolidated orchestration logic
export async function* executeInteractiveQueryStreaming<T>(
  prompt: string,
  _jsonSchema: Record<string, unknown>,
  config?: ClaudeAgentConfig,
  questionCallback?: QuestionCallback
): AsyncGenerator<StreamingEvent, AgenticQueryResult<T>> {
  const resolvedConfig = resolveConfig(config);

  // Initialize settings and validate API key
  await initializeAndValidateApiKey(config);

  // Get configured main model
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
      message: "Initializing interactive session...",
      timestamp: Date.now(),
    };

    const context: TransformContext = createTransformContext(
      resolvedConfig.model
    );

    // Use selective loading when requiredSkills is provided
    const pluginPaths = config?.requiredSkills
      ? await getSelectivePluginPaths(config.requiredSkills)
      : await getPluginPaths();

    // Capture user's working directory before SDK starts
    const userCwd = process.cwd();
    const loopliaHome = getLoopliaPluginPath();

    // Resolve Claude Code executable path (optional)
    const claudeCodePath = findClaudeCodePath();

    const result = query({
      prompt,
      options: {
        // Use system-installed Claude Code if available
        ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
        // Use configured main model
        model: mainModel,
        // SDK works relative to ~/.looplia
        cwd: loopliaHome,

        // KEY DIFFERENCE: Use default permission mode with custom handler
        // This allows us to intercept AskUserQuestion while auto-approving others
        permissionMode: "default",
        allowDangerouslySkipPermissions: true,

        // Custom permission handler for AskUserQuestion
        canUseTool: async (toolName, input) => {
          // Handle AskUserQuestion specially
          if (toolName === "AskUserQuestion") {
            const typedInput = input as { questions?: AskUserQuestion[] };
            if (questionCallback && typedInput.questions) {
              try {
                const answers = await questionCallback(typedInput.questions);
                return {
                  behavior: "allow" as const,
                  updatedInput: { ...input, answers },
                };
              } catch {
                return {
                  behavior: "deny" as const,
                  message: "User cancelled question input",
                };
              }
            }
            // No callback registered - deny the tool
            return {
              behavior: "deny" as const,
              message: "Question handler not available in this context",
            };
          }

          // All other tools: auto-approve (equivalent to bypass)
          return { behavior: "allow" as const, updatedInput: input };
        },

        // Load plugins from local paths
        plugins: pluginPaths,
        // Append looplia system prompt + user context
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `${loopliaSystemPrompt}\n\n## User Context\n\nUser Working Directory: ${userCwd}\n\nWhen processing --file arguments or user file paths, resolve them against the User Working Directory above.`,
        },
        // Include AskUserQuestion in allowed tools (interactive mode only)
        allowedTools: [
          "Read",
          "Write",
          "Glob",
          "Task",
          "Skill",
          "WebSearch",
          "WebFetch",
          "AskUserQuestion", // Only in interactive mode
        ],
        // v0.7.2: Removed outputFormat to support non-Anthropic models
        // Final results are now extracted from sandbox output files via extractSandboxResult()
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
      finalResult = await extractSandboxResult<T>({
        sandboxId: process.env.LOOPLIA_SANDBOX_ID,
        sandboxRoot:
          process.env.LOOPLIA_SANDBOX_ROOT ?? join(workspace, "sandbox"),
      });
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
