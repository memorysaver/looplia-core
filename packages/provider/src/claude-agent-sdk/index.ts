import type { WritingKitProviders } from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderUsage } from "./config";
import { createClaudeIdeaGenerator } from "./idea-generator";
import { createClaudeOutlineGenerator } from "./outline-generator";
import { createClaudeSummarizer } from "./summarizer";

// Re-export types
export type {
  ClaudeAgentConfig,
  ProviderResultWithUsage,
  ProviderUsage,
} from "./config";
export type { ClaudeIdeaProvider } from "./idea-generator";
export { createClaudeIdeaGenerator } from "./idea-generator";
export type { ClaudeOutlineProvider } from "./outline-generator";
export { createClaudeOutlineGenerator } from "./outline-generator";
export { buildIdeasPrompt, IDEAS_SYSTEM_PROMPT } from "./prompts/ideas";
export { buildOutlinePrompt, OUTLINE_SYSTEM_PROMPT } from "./prompts/outline";
// Re-export prompt builders for customization
export {
  buildSummarizePrompt,
  SUMMARIZE_SYSTEM_PROMPT,
} from "./prompts/summarize";
export type { ClaudeSummarizerProvider } from "./summarizer";
// Re-export factory functions
export { createClaudeSummarizer } from "./summarizer";
// Re-export schemas for reference
export {
  IDEAS_OUTPUT_SCHEMA,
  OUTLINE_OUTPUT_SCHEMA,
  SUMMARY_OUTPUT_SCHEMA,
} from "./utils/schema-converter";
export type { WorkspaceOptions } from "./workspace";
// Re-export workspace utilities
export { ensureWorkspace, getWorkspacePath } from "./workspace";

/**
 * Claude-powered providers bundle with usage tracking
 */
export type ClaudeProviders = WritingKitProviders & {
  /** Aggregated usage metrics from all provider calls */
  getUsage(): ProviderUsage;
  /** Reset usage metrics */
  resetUsage(): void;
};

/**
 * Create all three Claude providers as a bundle
 *
 * @param config - Optional configuration shared across all providers
 * @returns WritingKitProviders bundle for use with buildWritingKit
 *
 * @example
 * ```typescript
 * import { createClaudeProviders } from "@looplia-core/provider/claude-agent-sdk";
 * import { buildWritingKit } from "@looplia-core/core";
 *
 * const providers = createClaudeProviders({
 *   model: "claude-haiku-4-5-20251001",
 *   workspace: "~/.looplia"
 * });
 *
 * const result = await buildWritingKit(content, user, providers);
 * if (result.success) {
 *   console.log("Kit:", result.data);
 *   console.log("Usage:", providers.getUsage());
 * }
 * ```
 */
export function createClaudeProviders(
  config?: ClaudeAgentConfig
): ClaudeProviders {
  let aggregatedUsage: ProviderUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalCostUsd: 0,
  };

  const summarizer = createClaudeSummarizer(config);
  const idea = createClaudeIdeaGenerator(config);
  const outline = createClaudeOutlineGenerator(config);

  // Wrap providers to track usage
  const wrappedSummarizer = {
    async summarize(
      content: Parameters<typeof summarizer.summarize>[0],
      user?: Parameters<typeof summarizer.summarize>[1]
    ) {
      const result = await summarizer.summarizeWithUsage(content, user);
      if (result.usage) {
        aggregatedUsage.inputTokens += result.usage.inputTokens;
        aggregatedUsage.outputTokens += result.usage.outputTokens;
        aggregatedUsage.totalCostUsd += result.usage.totalCostUsd;
      }
      return result;
    },
  };

  const wrappedIdea = {
    async generateIdeas(
      summary: Parameters<typeof idea.generateIdeas>[0],
      user: Parameters<typeof idea.generateIdeas>[1]
    ) {
      const result = await idea.generateIdeasWithUsage(summary, user);
      if (result.usage) {
        aggregatedUsage.inputTokens += result.usage.inputTokens;
        aggregatedUsage.outputTokens += result.usage.outputTokens;
        aggregatedUsage.totalCostUsd += result.usage.totalCostUsd;
      }
      return result;
    },
  };

  const wrappedOutline = {
    async generateOutline(
      summary: Parameters<typeof outline.generateOutline>[0],
      ideas: Parameters<typeof outline.generateOutline>[1],
      user: Parameters<typeof outline.generateOutline>[2]
    ) {
      const result = await outline.generateOutlineWithUsage(
        summary,
        ideas,
        user
      );
      if (result.usage) {
        aggregatedUsage.inputTokens += result.usage.inputTokens;
        aggregatedUsage.outputTokens += result.usage.outputTokens;
        aggregatedUsage.totalCostUsd += result.usage.totalCostUsd;
      }
      return result;
    },
  };

  return {
    summarizer: wrappedSummarizer,
    idea: wrappedIdea,
    outline: wrappedOutline,
    getUsage() {
      return { ...aggregatedUsage };
    },
    resetUsage() {
      aggregatedUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalCostUsd: 0,
      };
    },
  };
}
