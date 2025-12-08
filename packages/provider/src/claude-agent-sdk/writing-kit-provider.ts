import type {
  ContentItem,
  ProviderResult,
  UserProfile,
  WritingKit,
} from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderResultWithUsage } from "./config";
import { writeContentItem } from "./content-io";
import { executeAgenticQuery } from "./utils/query-wrapper";
import { WRITING_KIT_OUTPUT_SCHEMA } from "./utils/schema-converter";
import { ensureWorkspace, writeUserProfile } from "./workspace";

/**
 * Build minimal prompt for writing kit (v0.3.1 agentic approach)
 *
 * The agent reads CLAUDE.md for full instructions and uses skills
 * to perform deep analysis, generate ideas, and create outline.
 *
 * Content is stored in folder structure:
 * contentItem/{id}/content.md - the original content
 * contentItem/{id}/notes/ - agent notes and analysis
 * contentItem/{id}/results/ - generated outputs (summary, ideas, outline)
 */
function buildMinimalKitPrompt(contentId: string): string {
  return `Build writing kit for: contentItem/${contentId}/content.md`;
}

/**
 * WritingKit provider for single-call agentic approach
 *
 * Builds a complete writing kit in a single SDK session:
 * - Summary with all 15 fields
 * - Writing ideas (hooks, angles, questions)
 * - Article outline with word counts
 */
export type WritingKitProvider = {
  /**
   * Build complete writing kit from content
   */
  buildKit(
    content: ContentItem,
    user: UserProfile
  ): Promise<ProviderResult<WritingKit>>;

  /**
   * Build complete writing kit with usage metrics
   */
  buildKitWithUsage(
    content: ContentItem,
    user: UserProfile
  ): Promise<ProviderResultWithUsage<WritingKit>>;
};

/**
 * Create a Claude-powered writing kit provider
 *
 * Uses a single SDK call to build the complete writing kit.
 * The agent reads CLAUDE.md for workflow instructions and uses
 * skills (media-reviewer, content-documenter) autonomously.
 *
 * @param config - Optional configuration overrides
 * @returns WritingKitProvider implementation using Claude Agent SDK
 *
 * @example
 * ```typescript
 * const provider = createClaudeWritingKitProvider({
 *   model: "claude-haiku-4-5-20251001",
 *   workspace: "~/.looplia"
 * });
 *
 * const result = await provider.buildKit(content, user);
 * if (result.success) {
 *   console.log(result.data.summary.headline);
 *   console.log(result.data.ideas.hooks);
 *   console.log(result.data.suggestedOutline);
 * }
 * ```
 */
export function createClaudeWritingKitProvider(
  config?: ClaudeAgentConfig
): WritingKitProvider {
  return {
    buildKit(content, user) {
      return this.buildKitWithUsage(content, user);
    },

    async buildKitWithUsage(content, user) {
      // Ensure workspace exists and get path
      const workspace = await ensureWorkspace({
        baseDir: config?.workspace,
      });

      // Write content item to workspace
      await writeContentItem(content, workspace);

      // Write user profile
      await writeUserProfile(workspace, user);

      // Build minimal prompt - agent reads CLAUDE.md for full instructions
      const prompt = buildMinimalKitPrompt(content.id);

      // Execute single agentic query for entire kit
      return executeAgenticQuery<WritingKit>(
        prompt,
        WRITING_KIT_OUTPUT_SCHEMA,
        {
          ...config,
          workspace,
        }
      );
    },
  };
}
