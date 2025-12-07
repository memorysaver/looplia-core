import type {
  ContentSummary,
  OutlineProvider,
  OutlineSection,
  UserProfile,
  WritingIdeas,
} from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderResultWithUsage } from "./config";
import { buildOutlinePrompt, OUTLINE_SYSTEM_PROMPT } from "./prompts/outline";
import { executeQueryWithRetry } from "./utils/query-wrapper";
import { OUTLINE_OUTPUT_SCHEMA } from "./utils/schema-converter";

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
      const prompt = config?.promptBuilder
        ? config.promptBuilder({ summary, ideas, user })
        : buildOutlinePrompt(summary, ideas, user);

      const systemPrompt = config?.systemPrompt ?? OUTLINE_SYSTEM_PROMPT;

      // Execute query expecting wrapped response
      const result = await executeQueryWithRetry<OutlineResponse>(
        prompt,
        systemPrompt,
        OUTLINE_OUTPUT_SCHEMA,
        config
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
