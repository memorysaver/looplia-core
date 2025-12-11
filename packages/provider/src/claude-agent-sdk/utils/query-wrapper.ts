import { query } from "@anthropic-ai/claude-agent-sdk";

import type {
  ClaudeAgentConfig,
  ProviderResultWithUsage,
  ProviderUsage,
} from "../config";
import { resolveConfig } from "../config";
import { createQueryLogger } from "../logger";
import { mapException, mapSdkError } from "./error-mapper";
import type { AgenticQueryResult } from "./shared";
import { extractContentIdFromPrompt, getOrInitWorkspace } from "./shared";

// Re-export for backward compatibility - intentional to maintain API surface
// biome-ignore lint/performance/noBarrelFile: intentional re-export for backward compatibility
export {
  type AgenticQueryResult,
  extractContentIdFromPrompt,
} from "./shared";

/** Base delay for exponential backoff (ms) */
const RETRY_BASE_DELAY_MS = 1000;

/** Maximum delay between retries (ms) */
const RETRY_MAX_DELAY_MS = 30_000;

/**
 * Extract usage metrics from SDK result message
 */
function extractUsage(resultMessage: {
  usage: { input_tokens?: number; output_tokens?: number };
  total_cost_usd?: number;
}): ProviderUsage {
  return {
    inputTokens: resultMessage.usage.input_tokens ?? 0,
    outputTokens: resultMessage.usage.output_tokens ?? 0,
    totalCostUsd: resultMessage.total_cost_usd ?? 0,
  };
}

/**
 * Process SDK result message and return appropriate provider result
 */
function processResultMessage<T>(
  resultMessage: {
    subtype: string;
    structured_output?: unknown;
    usage: { input_tokens?: number; output_tokens?: number };
    total_cost_usd?: number;
  },
  usage: ProviderUsage
): ProviderResultWithUsage<T> {
  const sdkResult = resultMessage as Record<string, unknown>;

  // Check for true success: subtype=success, no is_error flag, has structured output
  if (
    resultMessage.subtype === "success" &&
    !sdkResult.is_error &&
    resultMessage.structured_output !== undefined
  ) {
    return {
      success: true,
      data: resultMessage.structured_output as T,
      usage,
    };
  }

  // Handle case where SDK reports success but has error flag
  if (resultMessage.subtype === "success" && sdkResult.is_error) {
    const errorMessage =
      typeof sdkResult.result === "string"
        ? sdkResult.result
        : "SDK returned error despite success subtype";
    return {
      success: false,
      error: { type: "unknown", message: errorMessage },
      usage,
    };
  }

  // Handle case where SDK reports success but structured_output is missing
  if (
    resultMessage.subtype === "success" &&
    resultMessage.structured_output === undefined
  ) {
    const errorMsg = `Success subtype but no structured_output. Result: ${JSON.stringify(resultMessage).substring(0, 200)}`;
    return {
      success: false,
      error: { type: "unknown", message: errorMsg },
      usage,
    };
  }

  // Handle error results - cast to SDK type for error mapper
  return {
    ...mapSdkError(
      sdkResult as import("@anthropic-ai/claude-agent-sdk").SDKResultMessage
    ),
    usage,
  };
}

/**
 * Execute a true agentic query (v0.3.1 architecture)
 *
 * Uses minimal prompt with Read and Skill tools enabled.
 * The agent reads CLAUDE.md for full instructions and uses skills autonomously.
 *
 * Content is organized in folder structure:
 * - contentItem/{id}/content.md - the original content to process
 * - contentItem/{id}/notes/ - agent notes during analysis
 * - contentItem/{id}/results/ - generated outputs and results
 *
 * @param prompt - Minimal prompt (e.g., "Summarize content: contentItem/{id}/content.md")
 * @param jsonSchema - JSON Schema for structured output
 * @param config - Provider configuration (must include workspace)
 * @returns Provider result with usage metrics
 */
export async function executeAgenticQuery<T>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  config?: ClaudeAgentConfig
): Promise<AgenticQueryResult<T>> {
  try {
    const resolvedConfig = resolveConfig(config);

    // Validate API key before making request
    // SDK supports both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN
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
            "API key is required. Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable, or provide apiKey in config",
        },
      };
    }

    // Use provided workspace or get/init one
    const workspace =
      config?.workspace ??
      (await getOrInitWorkspace(
        resolvedConfig.workspace,
        resolvedConfig.useFilesystemExtensions
      ));

    // Initialize query logger for SDK execution
    const contentId = extractContentIdFromPrompt(prompt);
    const logger = createQueryLogger(workspace);
    if (contentId) {
      logger.init(contentId);
      logger.log({ type: "prompt", content: prompt });
    }

    // Execute SDK query with agentic tools (Read + Skill)
    const result = query({
      prompt,
      options: {
        model: resolvedConfig.model,
        cwd: workspace,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        // v0.3.1: Enable Read and Skill tools for true agentic behavior
        allowedTools: ["Read", "Skill"],
        outputFormat: {
          type: "json_schema",
          schema: jsonSchema,
        },
      },
    });

    // Track session ID from init message
    let sessionId: string | undefined;

    // Process async generator - query() returns AsyncGenerator<SDKMessage, void>
    for await (const message of result) {
      // Log all messages for debugging
      if (contentId) {
        logger.log(message as Record<string, unknown>);
      }

      // Capture session ID from init message
      if (
        message.type === "system" &&
        (message as { subtype?: string }).subtype === "init"
      ) {
        sessionId = (message as { session_id?: string }).session_id;
      }

      if (message.type !== "result") {
        continue;
      }

      logger.close();
      const usage = extractUsage(message);
      const providerResult = processResultMessage<T>(message, usage);
      return { ...providerResult, sessionId };
    }

    logger.close();

    // No result received
    return {
      success: false,
      error: {
        type: "unknown",
        message: "No result received from SDK",
      },
      sessionId,
    };
  } catch (error) {
    return mapException(error);
  }
}

/**
 * Execute an agentic query with retry logic for transient errors
 *
 * @param prompt - Minimal prompt for agentic query
 * @param jsonSchema - JSON Schema for structured output
 * @param config - Provider configuration
 * @returns Provider result with usage metrics
 */
export async function executeAgenticQueryWithRetry<T>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  config?: ClaudeAgentConfig
): Promise<AgenticQueryResult<T>> {
  const resolvedConfig = resolveConfig(config);
  const maxRetries = resolvedConfig.maxRetries;

  let lastResult: AgenticQueryResult<T> | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await executeAgenticQuery<T>(prompt, jsonSchema, config);

    // Return immediately on success
    if (result.success) {
      return result;
    }

    lastResult = result;

    // Check if error is retryable
    const isRetryable =
      result.error.type === "network_error" ||
      result.error.type === "rate_limit";

    if (!isRetryable || attempt === maxRetries) {
      return result;
    }

    // Wait before retry (exponential backoff)
    const delay = Math.min(
      RETRY_BASE_DELAY_MS * 2 ** attempt,
      RETRY_MAX_DELAY_MS
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return (
    lastResult ?? {
      success: false,
      error: {
        type: "unknown",
        message: "Max retries exceeded",
      },
    }
  );
}
