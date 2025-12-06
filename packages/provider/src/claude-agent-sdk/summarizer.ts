import type {
  ContentItem,
  ContentSummary,
  SummarizerProvider,
  UserProfile,
} from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderResultWithUsage } from "./config";
import {
  buildSummarizePrompt,
  SUMMARIZE_SYSTEM_PROMPT,
} from "./prompts/summarize";
import { executeQueryWithRetry } from "./utils/query-wrapper";
import { SUMMARY_OUTPUT_SCHEMA } from "./utils/schema-converter";

/**
 * Claude-powered summarizer provider
 *
 * Uses Claude Agent SDK to analyze content and generate structured summaries
 * with headlines, TL;DRs, bullets, tags, and relevance scores.
 */
export type ClaudeSummarizerProvider = SummarizerProvider & {
  /**
   * Summarize content with usage metrics
   */
  summarizeWithUsage(
    content: ContentItem,
    user?: UserProfile
  ): Promise<ProviderResultWithUsage<ContentSummary>>;
};

/**
 * Create a Claude-powered summarizer provider
 *
 * @param config - Optional configuration overrides
 * @returns SummarizerProvider implementation using Claude Agent SDK
 *
 * @example
 * ```typescript
 * const summarizer = createClaudeSummarizer({
 *   model: "claude-haiku-4-5-20251001",
 *   workspace: "~/.looplia"
 * });
 *
 * const result = await summarizer.summarize(content, user);
 * if (result.success) {
 *   console.log(result.data.headline);
 * }
 * ```
 */
export function createClaudeSummarizer(
  config?: ClaudeAgentConfig
): ClaudeSummarizerProvider {
  return {
    async summarize(content, user) {
      return this.summarizeWithUsage(content, user);
    },

    async summarizeWithUsage(content, user) {
      const prompt = config?.promptBuilder
        ? config.promptBuilder(content)
        : buildSummarizePrompt(content, user);

      const systemPrompt = config?.systemPrompt ?? SUMMARIZE_SYSTEM_PROMPT;

      return executeQueryWithRetry<ContentSummary>(
        prompt,
        systemPrompt,
        SUMMARY_OUTPUT_SCHEMA,
        config
      );
    },
  };
}
