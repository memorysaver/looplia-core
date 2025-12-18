/**
 * Claude Agent Executor (v0.5.2)
 *
 * Implements the AgentExecutor interface from core.
 * This is the Clean Architecture adapter that connects
 * the core command framework to the Claude Agent SDK.
 *
 * v0.5.2: Added executePromptStreaming for thin wrapper pattern.
 * This allows CLI to inject /run commands without specifying output schema.
 */

import type {
  AgentExecutor,
  CommandResult,
  ExecutorOptions,
  StreamingEvent,
  WorkflowResult,
} from "@looplia-core/core";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { ClaudeAgentConfig } from "./config";
import { resolveConfig } from "./config";
import { executeAgenticQueryStreaming } from "./streaming/query-executor";

/**
 * Generic workflow result schema for prompt-based execution
 * Accepts any JSON object as the workflow output
 */
const WORKFLOW_RESULT_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["success", "error", "partial"],
      description: "Workflow execution status",
    },
    sessionId: {
      type: "string",
      description: "Session identifier",
    },
    workflowId: {
      type: "string",
      description: "Workflow that was executed",
    },
    artifact: {
      type: "object",
      additionalProperties: true,
      description: "Final workflow artifact (structure depends on workflow)",
    },
    error: {
      type: "string",
      description: "Error message if status is error",
    },
  },
  required: ["status"],
  additionalProperties: true,
} as const;

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

    /**
     * v0.5.2: Execute a prompt without schema (thin wrapper pattern)
     *
     * Used by CLI thin wrapper to inject /run commands.
     * Agent interprets command via workflow-executor skill.
     */
    async *executePromptStreaming(
      prompt: string,
      options: ExecutorOptions
    ): AsyncGenerator<StreamingEvent, CommandResult<WorkflowResult>> {
      const resolvedConfig: ClaudeAgentConfig = {
        ...resolveConfig(config),
        workspace: options.workspace,
      };

      const generator = executeAgenticQueryStreaming<WorkflowResult>(
        prompt,
        WORKFLOW_RESULT_SCHEMA as Record<string, unknown>,
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

    /**
     * v0.5.2: Execute a prompt without schema (non-streaming)
     */
    async executePrompt(
      prompt: string,
      options: ExecutorOptions
    ): Promise<CommandResult<WorkflowResult>> {
      const generator = this.executePromptStreaming(prompt, options);

      let result = await generator.next();
      while (!result.done) {
        result = await generator.next();
      }

      return result.value as CommandResult<WorkflowResult>;
    },
  };
}
