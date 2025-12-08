import type {
  ContentSummary,
  OutlineProvider,
  OutlineSection,
  UserProfile,
  WritingIdeas,
} from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderResultWithUsage } from "./config";
import { executeQueryWithRetry } from "./utils/query-wrapper";
import { OUTLINE_OUTPUT_SCHEMA } from "./utils/schema-converter";
import { ensureWorkspace, writeUserProfile } from "./workspace";

/**
 * Build minimal prompt for outline generation (v0.3.1 agentic architecture)
 *
 * The agent reads CLAUDE.md for full instructions.
 */
function buildMinimalOutlinePrompt(contentId: string): string {
  return `Generate article outline for content: ${contentId}`;
}

/**
 * Claude-powered outline generator provider
 *
 * Uses Claude Agent SDK to generate structured article outlines
 * from content summaries and writing ideas.
 */
export type ClaudeOutlineProvider = OutlineProvider & {
  /**
   * Generate outline with usage metrics
   */
  generateOutlineWithUsage(
    summary: ContentSummary,
    ideas: WritingIdeas,
    user: UserProfile
  ): Promise<ProviderResultWithUsage<OutlineSection[]>>;
};

/**
 * Create a Claude-powered outline generator provider
 *
 * @param config - Optional configuration overrides
 * @returns OutlineProvider implementation using Claude Agent SDK
 *
 * @example
 * ```typescript
 * const outlineGenerator = createClaudeOutlineGenerator({
 *   model: "claude-haiku-4-5-20251001"
 * });
 *
 * const result = await outlineGenerator.generateOutline(summary, ideas, user);
 * if (result.success) {
 *   console.log(result.data.map(s => s.heading));
 * }
 * ```
 */
/** Wrapper type for outline response (Claude requires top-level object) */
type OutlineResponse = { sections: OutlineSection[] };

export function createClaudeOutlineGenerator(
  config?: ClaudeAgentConfig
): ClaudeOutlineProvider {
  return {
    generateOutline(summary, ideas, user) {
      return this.generateOutlineWithUsage(summary, ideas, user);
    },

    async generateOutlineWithUsage(summary, ideas, user) {
      // Ensure workspace exists
      const workspace = await ensureWorkspace({
        baseDir: config?.workspace,
      });
      await writeUserProfile(workspace, user);

      // Use minimal prompt - agent reads CLAUDE.md for full instructions
      const prompt = config?.promptBuilder
        ? config.promptBuilder({ summary, ideas, user })
        : buildMinimalOutlinePrompt(summary.contentId);

      // Execute query expecting wrapped response
      const result = await executeQueryWithRetry<OutlineResponse>(
        prompt,
        undefined, // No system prompt - agent uses CLAUDE.md
        OUTLINE_OUTPUT_SCHEMA,
        {
          ...config,
          workspace,
        }
      );

      // Unwrap the sections array from the response object
      if (result.success) {
        return {
          success: true,
          data: result.data.sections,
          usage: result.usage,
        };
      }

      return result as ProviderResultWithUsage<OutlineSection[]>;
    },
  };
}
