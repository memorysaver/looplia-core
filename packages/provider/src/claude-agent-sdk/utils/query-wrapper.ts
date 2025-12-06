import { query } from "@anthropic-ai/claude-agent-sdk";

import type {
  ClaudeAgentConfig,
  ProviderResultWithUsage,
  ProviderUsage,
} from "../config";
import { resolveConfig } from "../config";
import { ensureWorkspace } from "../workspace";
import { mapException, mapSdkError } from "./error-mapper";

/** Base delay for exponential backoff (ms) */
const RETRY_BASE_DELAY_MS = 1000;

/** Maximum delay between retries (ms) */
const RETRY_MAX_DELAY_MS = 30_000;

/** Cached workspace paths to avoid repeated filesystem checks */
const workspaceCache = new Map<string, string>();

/**
 * Get or initialize workspace with caching
 */
async function getOrInitWorkspace(
  baseDir: string,
  installDefaults: boolean
): Promise<string> {
  const cacheKey = `${baseDir}:${installDefaults}`;

  const cached = workspaceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const workspace = await ensureWorkspace({ baseDir, installDefaults });
  workspaceCache.set(cacheKey, workspace);
  return workspace;
}

/**
 * Execute a query against the Claude Agent SDK with structured output
 *
 * @param prompt - User prompt to send
 * @param systemPrompt - System prompt for context
 * @param jsonSchema - JSON Schema for structured output
 * @param config - Provider configuration
 * @returns Provider result with usage metrics
 */
export async function executeQuery<T>(
  prompt: string,
  systemPrompt: string,
  jsonSchema: Record<string, unknown>,
  config?: ClaudeAgentConfig
): Promise<ProviderResultWithUsage<T>> {
  try {
    const resolvedConfig = resolveConfig(config);

    // Validate API key before making request
    const apiKey = config?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: {
          type: "validation_error",
          field: "apiKey",
          message:
            "API key is required. Set ANTHROPIC_API_KEY environment variable or provide apiKey in config",
        },
      };
    }

    // Get workspace (cached after first init)
    const workspace = await getOrInitWorkspace(
      resolvedConfig.workspace,
      resolvedConfig.useFilesystemExtensions
    );

    // Execute SDK query
    const result = query({
      prompt,
      options: {
        model: resolvedConfig.model,
        cwd: workspace,
        systemPrompt: config?.systemPrompt ?? systemPrompt,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        allowedTools: resolvedConfig.useFilesystemExtensions ? ["Skill"] : [],
        outputFormat: {
          type: "json_schema",
          schema: jsonSchema,
        },
      },
    });

    // Process async generator - query() returns AsyncGenerator<SDKMessage, void>
    for await (const message of result) {
      // Use type guard to check for result message
      if (message.type === "result") {
        // TypeScript now knows message is SDKResultMessage
        const resultMessage = message;

        // Extract usage from the result message
        const usage: ProviderUsage = {
          inputTokens: resultMessage.usage.input_tokens ?? 0,
          outputTokens: resultMessage.usage.output_tokens ?? 0,
          totalCostUsd: resultMessage.total_cost_usd ?? 0,
        };

        // Check for success using the subtype discriminant
        if (resultMessage.subtype === "success") {
          return {
            success: true,
            // structured_output is typed as `unknown` in the SDK
            // We trust that it matches our schema T since we provided the schema
            data: resultMessage.structured_output as T,
            usage,
          };
        }

        // Handle error results - the SDK guarantees these have the errors array
        return {
          ...mapSdkError(resultMessage),
          usage,
        };
      }
    }

    // No result received
    return {
      success: false,
      error: {
        type: "unknown",
        message: "No result received from SDK",
      },
    };
  } catch (error) {
    return mapException(error);
  }
}

/**
 * Execute a query with retry logic for transient errors
 *
 * @param prompt - User prompt to send
 * @param systemPrompt - System prompt for context
 * @param jsonSchema - JSON Schema for structured output
 * @param config - Provider configuration
 * @returns Provider result with usage metrics
 */
export async function executeQueryWithRetry<T>(
  prompt: string,
  systemPrompt: string,
  jsonSchema: Record<string, unknown>,
  config?: ClaudeAgentConfig
): Promise<ProviderResultWithUsage<T>> {
  const resolvedConfig = resolveConfig(config);
  const maxRetries = resolvedConfig.maxRetries;

  let lastResult: ProviderResultWithUsage<T> | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await executeQuery<T>(
      prompt,
      systemPrompt,
      jsonSchema,
      config
    );

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
