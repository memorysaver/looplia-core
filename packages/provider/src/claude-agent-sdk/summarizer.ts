import type {
  ContentItem,
  ContentSummary,
  SummarizerProvider,
  UserProfile,
} from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderResultWithUsage } from "./config";
import { writeContentItem } from "./content-io";
import { executeQueryWithRetry } from "./utils/query-wrapper";
import { SUMMARY_OUTPUT_SCHEMA } from "./utils/schema-converter";
import { ensureWorkspace, writeUserProfile } from "./workspace";

/**
 * Build minimal prompt for summarization (v0.3.1 agentic architecture)
 *
 * The agent reads CLAUDE.md for full instructions and uses skills autonomously.
 */
function buildMinimalSummarizePrompt(contentId: string): string {
  return `Summarize content: contentItem/${contentId}.md`;
}

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
    summarize(content, user) {
      return this.summarizeWithUsage(content, user);
    },

    async summarizeWithUsage(content, user) {
      // Ensure workspace exists and write content
      const workspace = await ensureWorkspace({
        baseDir: config?.workspace,
      });
      await writeContentItem(content, workspace);
      if (user) {
        await writeUserProfile(workspace, user);
      }

      // Use minimal prompt - agent reads CLAUDE.md for full instructions
      const prompt = config?.promptBuilder
        ? config.promptBuilder(content)
        : buildMinimalSummarizePrompt(content.id);

      return executeQueryWithRetry<ContentSummary>(
        prompt,
        undefined, // No system prompt - agent uses CLAUDE.md
        SUMMARY_OUTPUT_SCHEMA,
        {
          ...config,
          workspace,
        }
      );
    },
  };
}
