import { query } from "@anthropic-ai/claude-agent-sdk";

import type { ClaudeAgentConfig, ProviderResultWithUsage, ProviderUsage } from "../config";
import { resolveConfig } from "../config";
import { ensureWorkspace } from "../workspace";
import { mapException, mapSdkError, type SdkResultMessage } from "./error-mapper";

/**
 * SDK message types we handle
 */
type SdkMessage = {
  type: string;
  subtype?: string;
  // biome-ignore lint/suspicious/noExplicitAny: SDK returns unknown structured output
  structured_output?: any;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  total_cost_usd?: number;
  errors?: string[];
};

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
  jsonSchema: object,
  config?: ClaudeAgentConfig
): Promise<ProviderResultWithUsage<T>> {
  try {
    const resolvedConfig = resolveConfig(config);

    // Ensure workspace is initialized
    const workspace = await ensureWorkspace({
      baseDir: resolvedConfig.workspace,
      installDefaults: resolvedConfig.useFilesystemExtensions,
    });

    // Execute SDK query
    const result = query({
      prompt,
      options: {
        model: resolvedConfig.model,
        cwd: workspace,
        systemPrompt: config?.systemPrompt ?? systemPrompt,
        permissionMode: "bypassPermissions",
        allowedTools: resolvedConfig.useFilesystemExtensions ? ["Skill"] : [],
        outputFormat: {
          type: "json_schema",
          schema: jsonSchema,
        },
        timeout: resolvedConfig.timeout,
      },
    });

    // Process async generator
    for await (const message of result as AsyncIterable<SdkMessage>) {
      if (message.type === "result") {
        const usage: ProviderUsage = {
          inputTokens: message.usage?.input_tokens ?? 0,
          outputTokens: message.usage?.output_tokens ?? 0,
          totalCostUsd: message.total_cost_usd ?? 0,
        };

        if (message.subtype === "success") {
          return {
            success: true,
            data: message.structured_output as T,
            usage,
          };
        }

        // Handle error results
        return {
          ...mapSdkError(message as SdkResultMessage),
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
  jsonSchema: object,
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
    const delay = Math.min(1000 * 2 ** attempt, 30000);
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
