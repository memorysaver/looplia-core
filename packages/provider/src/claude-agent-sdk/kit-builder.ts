import type {
  ContentItem,
  UserProfile,
  WritingKit,
} from "@looplia-core/core";

import type { ClaudeAgentConfig, ProviderResultWithUsage } from "./config";
import { writeContentItem } from "./content-io";
import { executeQueryWithRetry } from "./utils/query-wrapper";
import { WRITING_KIT_SCHEMA } from "./utils/schema-converter";
import { ensureWorkspace, writeUserProfile } from "./workspace";

/**
 * Build minimal prompt for kit generation (v0.3.1 agentic architecture)
 *
 * The agent reads CLAUDE.md for full instructions and uses skills autonomously.
 * Single call generates summary + ideas + outline with shared context.
 */
function buildMinimalKitPrompt(contentId: string): string {
  return `Build writing kit for: contentItem/${contentId}.md`;
}

/**
 * Estimate reading time based on word count
 */
const WORD_SPLIT_REGEX = /\s+/;
const AVERAGE_READING_WORDS_PER_MINUTE = 250;

function estimateReadingTime(text: string): number {
  const words = text.split(WORD_SPLIT_REGEX).length;
  return Math.max(1, Math.round(words / AVERAGE_READING_WORDS_PER_MINUTE));
}

/**
 * Build a complete WritingKit in a single SDK call (v0.3.1 agentic architecture)
 *
 * This function performs all three operations (summarize, ideas, outline) in a
 * single SDK session, allowing the agent to maintain context throughout.
 *
 * @param content - Source content to analyze
 * @param user - User profile for personalization
 * @param config - Optional configuration overrides
 * @returns Complete WritingKit or error
 *
 * @example
 * ```typescript
 * const result = await buildWritingKitAgentic(content, user, {
 *   model: "claude-haiku-4-5-20251001",
 *   workspace: "~/.looplia"
 * });
 *
 * if (result.success) {
 *   console.log(result.data.summary.headline);
 *   console.log(result.data.ideas.hooks);
 *   console.log(result.data.suggestedOutline);
 * }
 * ```
 */
export async function buildWritingKitAgentic(
  content: ContentItem,
  user: UserProfile,
  config?: ClaudeAgentConfig
): Promise<ProviderResultWithUsage<WritingKit>> {
  // Ensure workspace exists and write content
  const workspace = await ensureWorkspace({
    baseDir: config?.workspace,
  });
  await writeContentItem(content, workspace);
  await writeUserProfile(workspace, user);

  // Use minimal prompt - agent reads CLAUDE.md for full instructions
  const prompt = config?.promptBuilder
    ? config.promptBuilder(content)
    : buildMinimalKitPrompt(content.id);

  // Execute single SDK call for complete kit
  const result = await executeQueryWithRetry<WritingKitResponse>(
    prompt,
    undefined, // No system prompt - agent uses CLAUDE.md
    WRITING_KIT_SCHEMA,
    {
      ...config,
      workspace,
    }
  );

  if (!result.success) {
    return result as ProviderResultWithUsage<WritingKit>;
  }

  // Assemble complete WritingKit with source and meta info
  const kit: WritingKit = {
    contentId: content.id,
    source: {
      id: content.source.id,
      label: content.source.label ?? content.source.url,
      url: content.url,
    },
    summary: result.data.summary,
    ideas: result.data.ideas,
    suggestedOutline: result.data.suggestedOutline,
    meta: {
      relevanceToUser: result.data.summary.score.relevanceToUser,
      estimatedReadingTimeMinutes: estimateReadingTime(content.rawText),
    },
  };

  return {
    success: true,
    data: kit,
    usage: result.usage,
  };
}

/**
 * Response type from SDK for WritingKit generation
 * Contains summary, ideas, and outline in a single response
 */
type WritingKitResponse = {
  summary: WritingKit["summary"];
  ideas: WritingKit["ideas"];
  suggestedOutline: WritingKit["suggestedOutline"];
};
