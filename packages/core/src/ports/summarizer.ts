import type { ContentItem } from "../domain/content";
import type { ContentSummary } from "../domain/summary";
import type { UserProfile } from "../domain/user-profile";
import type { ProviderResult } from "../domain/errors";

/**
 * Provider interface for content summarization
 *
 * Implementations should:
 * - Generate a headline, tldr, and bullet points
 * - Extract relevant tags
 * - Determine sentiment
 * - Calculate relevance score based on user profile
 */
export interface SummarizerProvider {
  /**
   * Summarize content item
   *
   * @param content - The content to summarize
   * @param user - Optional user profile for personalization
   * @returns Summary or error
   */
  summarize(
    content: ContentItem,
    user?: UserProfile
  ): Promise<ProviderResult<ContentSummary>>;
}
