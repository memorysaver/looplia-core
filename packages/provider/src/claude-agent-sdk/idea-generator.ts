import type {
  ContentSummary,
  IdeaProvider,
  UserProfile,
  WritingIdeas,
} from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderResultWithUsage } from "./config";
import { executeQueryWithRetry } from "./utils/query-wrapper";
import { IDEAS_OUTPUT_SCHEMA } from "./utils/schema-converter";
import { ensureWorkspace, writeUserProfile } from "./workspace";

/**
 * Build minimal prompt for idea generation (v0.3.1 agentic architecture)
 *
 * The agent reads CLAUDE.md for full instructions.
 */
function buildMinimalIdeasPrompt(contentId: string): string {
  return `Generate writing ideas for content: ${contentId}`;
}

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
    generateIdeas(summary, user) {
      return this.generateIdeasWithUsage(summary, user);
    },

    async generateIdeasWithUsage(summary, user) {
      // Ensure workspace exists
      const workspace = await ensureWorkspace({
        baseDir: config?.workspace,
      });
      await writeUserProfile(workspace, user);

      // Use minimal prompt - agent reads CLAUDE.md for full instructions
      const prompt = config?.promptBuilder
        ? config.promptBuilder({ summary, user })
        : buildMinimalIdeasPrompt(summary.contentId);

      return executeQueryWithRetry<WritingIdeas>(
        prompt,
        undefined, // No system prompt - agent uses CLAUDE.md
        IDEAS_OUTPUT_SCHEMA,
        {
          ...config,
          workspace,
        }
      );
    },
  };
}
