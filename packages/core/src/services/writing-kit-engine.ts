import type { ContentItem } from "../domain/content";
import type { ProviderResult } from "../domain/errors";
import { err } from "../domain/errors";
import type { UserProfile } from "../domain/user-profile";
import type { WritingKit } from "../domain/writing-kit";
import type { IdeaProvider } from "../ports/idea-generator";
import type { OutlineProvider } from "../ports/outline-generator";
import type { SummarizerProvider } from "../ports/summarizer";

/**
 * Provider bundle for building a complete writing kit
 */
export type WritingKitProviders = {
  summarizer: SummarizerProvider;
  idea: IdeaProvider;
  outline: OutlineProvider;
};

const WORD_SPLIT_REGEX = /\s+/;

/**
 * Estimate reading time based on word count
 */
function estimateReadingTime(text: string): number {
  const words = text.split(WORD_SPLIT_REGEX).length;
  const wordsPerMinute = 250;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

/**
 * Build a complete writing kit from content
 *
 * @param content - Source content
 * @param user - User profile
 * @param providers - Provider implementations
 * @returns Writing kit or error
 */
export async function buildWritingKit(
  content: ContentItem,
  user: UserProfile,
  providers: WritingKitProviders
): Promise<ProviderResult<WritingKit>> {
  // Step 1: Summarize
  const summaryResult = await providers.summarizer.summarize(content, user);
  if (!summaryResult.success) {
    return err(summaryResult.error);
  }
  const summary = summaryResult.data;

  // Step 2: Generate ideas
  const ideasResult = await providers.idea.generateIdeas(summary, user);
  if (!ideasResult.success) {
    return err(ideasResult.error);
  }
  const ideas = ideasResult.data;

  // Step 3: Generate outline
  const outlineResult = await providers.outline.generateOutline(
    summary,
    ideas,
    user
  );
  if (!outlineResult.success) {
    return err(outlineResult.error);
  }
  const outline = outlineResult.data;

  // Assemble kit
  const kit: WritingKit = {
    contentId: content.id,
    source: {
      id: content.source.id,
      label: content.source.label ?? content.source.url,
      url: content.url,
    },
    summary,
    ideas,
    suggestedOutline: outline,
    meta: {
      relevanceToUser: summary.score.relevanceToUser,
      estimatedReadingTimeMinutes: estimateReadingTime(content.rawText),
    },
  };

  return { success: true, data: kit };
}
