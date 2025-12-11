/**
 * Claude Agent Executor
 *
 * Implements the AgentExecutor interface from core.
 * This is the Clean Architecture adapter that connects
 * the core command framework to the Claude Agent SDK.
 */

import type {
  AgentExecutor,
  CommandResult,
  ExecutorOptions,
  StreamingEvent,
} from "@looplia-core/core";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { ClaudeAgentConfig } from "./config";
import { resolveConfig } from "./config";
import { executeAgenticQueryStreaming } from "./streaming/query-executor";

/**
 * Create a Claude Agent Executor
 *
 * This executor implements the AgentExecutor interface defined in core,
 * using the Claude Agent SDK for actual execution.
 */
export function createClaudeAgentExecutor(
  config?: Partial<ClaudeAgentConfig>
): AgentExecutor {
  return {
    async *executeStreaming<T>(
      prompt: string,
      schema: z.ZodType<T>,
      options: ExecutorOptions
    ): AsyncGenerator<StreamingEvent, CommandResult<T>> {
      const jsonSchema = zodToJsonSchema(schema, {
        $refStrategy: "none",
        target: "openApi3",
      });

      const resolvedConfig: ClaudeAgentConfig = {
        ...resolveConfig(config),
        workspace: options.workspace,
      };

      const generator = executeAgenticQueryStreaming<T>(
        prompt,
        jsonSchema as Record<string, unknown>,
        resolvedConfig
      );

      // Forward all events and capture final result
      let result = await generator.next();
      while (!result.done) {
        yield result.value as StreamingEvent;
        result = await generator.next();
      }

      // Convert AgenticQueryResult to CommandResult
      const agenticResult = result.value;
      return {
        success: agenticResult.success,
        data: agenticResult.success ? agenticResult.data : undefined,
        error: agenticResult.success
          ? undefined
          : {
              type: agenticResult.error?.type ?? "unknown",
              message: agenticResult.error?.message ?? "Unknown error",
            },
        sessionId: agenticResult.sessionId ?? options.contentId,
        usage: agenticResult.usage
          ? {
              inputTokens: agenticResult.usage.inputTokens,
              outputTokens: agenticResult.usage.outputTokens,
              totalCostUsd: agenticResult.usage.totalCostUsd,
            }
          : undefined,
      };
    },

    async execute<T>(
      prompt: string,
      schema: z.ZodType<T>,
      options: ExecutorOptions
    ): Promise<CommandResult<T>> {
      // Run streaming executor but don't yield events
      const generator = this.executeStreaming(prompt, schema, options);

      let result = await generator.next();
      while (!result.done) {
        result = await generator.next();
      }

      return result.value as CommandResult<T>;
    },
  };
}
