import type {
  ContentSummary,
  IdeaProvider,
  UserProfile,
  WritingIdeas,
} from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderResultWithUsage } from "./config";
import { buildIdeasPrompt, IDEAS_SYSTEM_PROMPT } from "./prompts/ideas";
import { executeQueryWithRetry } from "./utils/query-wrapper";
import { IDEAS_OUTPUT_SCHEMA } from "./utils/schema-converter";

/**
 * Claude-powered idea generator provider
 *
 * Uses Claude Agent SDK to generate writing ideas including hooks,
 * angles, and exploratory questions from content summaries.
 */
export type ClaudeIdeaProvider = IdeaProvider & {
  /**
   * Generate ideas with usage metrics
   */
  generateIdeasWithUsage(
    summary: ContentSummary,
    user: UserProfile
  ): Promise<ProviderResultWithUsage<WritingIdeas>>;
};

/**
 * Create a Claude-powered idea generator provider
 *
 * @param config - Optional configuration overrides
 * @returns IdeaProvider implementation using Claude Agent SDK
 *
 * @example
 * ```typescript
 * const ideaGenerator = createClaudeIdeaGenerator({
 *   model: "claude-haiku-4-5-20251001"
 * });
 *
 * const result = await ideaGenerator.generateIdeas(summary, user);
 * if (result.success) {
 *   console.log(result.data.hooks);
 * }
 * ```
 */
export function createClaudeIdeaGenerator(
  config?: ClaudeAgentConfig
): ClaudeIdeaProvider {
  return {
    async generateIdeas(summary, user) {
      return this.generateIdeasWithUsage(summary, user);
    },

    async generateIdeasWithUsage(summary, user) {
      const prompt = config?.promptBuilder
        ? config.promptBuilder({ summary, user })
        : buildIdeasPrompt(summary, user);

      const systemPrompt = config?.systemPrompt ?? IDEAS_SYSTEM_PROMPT;

      return executeQueryWithRetry<WritingIdeas>(
        prompt,
        systemPrompt,
        IDEAS_OUTPUT_SCHEMA,
        config
      );
    },
  };
}
