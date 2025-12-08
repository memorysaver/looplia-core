import { writeFileSync } from "node:fs";
import { join } from "node:path";
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
 * Build sequential delegation prompt for writing kit (v0.3.1 agentic approach)
 *
 * Coordinates sequential subagent workflow:
 * 1. `content-analyzer` - for deep content analysis → summary.json
 * 2. `idea-generator` - reads summary, generates ideas → ideas.json
 * 3. Outline generation - reads summary & ideas → outline.json
 * 4. Assembly - combines all outputs into WritingKit
 *
 * Content structure (flat folder):
 * contentItem/{id}/content.md - original content
 * contentItem/{id}/summary.json - analyzer output
 * contentItem/{id}/ideas.json - generator output
 * contentItem/{id}/outline.json - outline output
 * contentItem/{id}/writing-kit.json - final assembled output
 */
function buildMinimalKitPrompt(contentId: string): string {
  return `Task: Build complete WritingKit with full workflow.

Execute these sequential steps:

1. Invoke content-analyzer subagent for: contentItem/${contentId}/content.md
   - Output saved to: contentItem/${contentId}/summary.json

2. Invoke idea-generator subagent with content analysis
   - Input: contentItem/${contentId}/summary.json
   - Output saved to: contentItem/${contentId}/ideas.json

3. Generate article outline
   - Input: contentItem/${contentId}/summary.json and ideas.json
   - Output saved to: contentItem/${contentId}/outline.json

4. Assemble WritingKit
   - Read all outputs: summary.json, ideas.json, outline.json
   - Combine into complete WritingKit structure
   - Save to: contentItem/${contentId}/writing-kit.json
   - Return the assembled WritingKit JSON as structured output`;
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
      const result = await executeAgenticQuery<WritingKit>(
        prompt,
        WRITING_KIT_OUTPUT_SCHEMA,
        {
          ...config,
          workspace,
        }
      );

      // Persist WritingKit to flat folder structure if successful
      if (result.success) {
        const contentDir = join(workspace, "contentItem", content.id);
        const kitPath = join(contentDir, "writing-kit.json");

        // Persist complete WritingKit (subagents write individual files, we persist the assembled kit)
        writeFileSync(kitPath, JSON.stringify(result.data, null, 2), "utf-8");
      }

      return result;
    },
  };
}
