import type {
  ContentItem,
  ProviderResult,
  UserProfile,
  WritingKit,
} from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderResultWithUsage } from "./config";
import { writeContentItem } from "./content-io";
import {
  executeAgenticQueryStreaming,
  type AgenticQueryResult,
  type StreamingEvent,
} from "./streaming";
import { executeAgenticQuery } from "./utils/query-wrapper";
import { WRITING_KIT_OUTPUT_SCHEMA } from "./utils/schema-converter";
import { ensureWorkspace, writeUserProfile } from "./workspace";

/**
 * Build smart continuation prompt for writing kit (v0.3.2 agentic approach)
 *
 * Main agent is a simple orchestrator that:
 * 1. Checks session folder for existing progress
 * 2. Invokes only the subagents needed
 * 3. Returns the final WritingKit
 *
 * 3 Subagents:
 * - `content-analyzer` - deep content analysis → summary.json
 * - `idea-generator` - generate hooks, angles, questions → ideas.json
 * - `writing-kit-builder` - create outline + assemble kit → outline.json, writing-kit.json
 *
 * Smart continuation: Agent decides what work is needed based on existing files.
 * No hardcoded control logic in TypeScript.
 *
 * Content structure (flat folder):
 * contentItem/{id}/content.md - original content
 * contentItem/{id}/summary.json - content-analyzer output
 * contentItem/{id}/ideas.json - idea-generator output
 * contentItem/{id}/outline.json - writing-kit-builder output
 * contentItem/{id}/writing-kit.json - writing-kit-builder final output
 */
function buildMinimalKitPrompt(sessionId: string): string {
  return `Task: Build WritingKit for session: contentItem/${sessionId}

## Check Existing Progress
First, check which files already exist in contentItem/${sessionId}/:
- summary.json → If exists, skip content-analyzer
- ideas.json → If exists, skip idea-generator
- writing-kit.json → If exists, return it directly

## Sequential Workflow (invoke only what's needed)

Step 1: IF summary.json missing:
  → Invoke content-analyzer subagent for contentItem/${sessionId}/content.md
  → Wait for completion → summary.json created

Step 2: IF ideas.json missing:
  → Invoke idea-generator subagent for contentItem/${sessionId}/summary.json
  → Wait for completion → ideas.json created

Step 3: IF writing-kit.json missing:
  → Invoke writing-kit-builder subagent for contentItem/${sessionId}/
  → Wait for completion → outline.json + writing-kit.json created

Step 4: Return
  → Read writing-kit.json from contentItem/${sessionId}/
  → Return as structured output`;
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

  /**
   * Build complete writing kit with streaming events for UI
   *
   * Yields StreamingEvent objects during execution for real-time
   * progress display. Returns final result on completion.
   *
   * @param content - Content item to process
   * @param user - User profile for preferences
   * @returns AsyncGenerator yielding events, returning final result
   */
  buildKitStreaming(
    content: ContentItem,
    user: UserProfile
  ): AsyncGenerator<StreamingEvent, AgenticQueryResult<WritingKit>>;
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

      // Persist WritingKit and handle folder relocation
      if (result.success) {
        const { persistResultToWorkspace } = await import(
          "./utils/persist-result"
        );
        await persistResultToWorkspace(result.data, {
          workspace,
          contentId: content.id,
          sessionId: result.sessionId,
          filename: "writing-kit.json",
        });
      }

      return result;
    },

    async *buildKitStreaming(content, user) {
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

      // Execute streaming agentic query
      const generator = executeAgenticQueryStreaming<WritingKit>(
        prompt,
        WRITING_KIT_OUTPUT_SCHEMA,
        {
          ...config,
          workspace,
        }
      );

      // Yield all events and capture final result
      let finalResult: AgenticQueryResult<WritingKit>;

      // Use for-await to iterate through all yielded events
      let iterResult = await generator.next();
      while (!iterResult.done) {
        yield iterResult.value;
        iterResult = await generator.next();
      }

      // Generator completed, get the return value
      finalResult = iterResult.value;

      // Persist WritingKit and handle folder relocation
      if (finalResult.success) {
        const { persistResultToWorkspace } = await import(
          "./utils/persist-result"
        );
        await persistResultToWorkspace(finalResult.data, {
          workspace,
          contentId: content.id,
          sessionId: finalResult.sessionId,
          filename: "writing-kit.json",
        });
      }

      return finalResult;
    },
  };
}
