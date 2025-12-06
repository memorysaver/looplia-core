import type { ContentItem } from "../domain/content";
import type { ProviderResult } from "../domain/errors";
import type { ContentSummary } from "../domain/summary";
import type { UserProfile } from "../domain/user-profile";
import type { SummarizerProvider } from "../ports/summarizer";

/**
 * Summarize content using the provided summarizer
 *
 * @param content - Content to summarize
 * @param user - Optional user profile
 * @param provider - Summarizer implementation
 * @returns Summary or error
 */
export function summarizeContent(
  content: ContentItem,
  user: UserProfile | undefined,
  provider: SummarizerProvider
): Promise<ProviderResult<ContentSummary>> {
  return provider.summarize(content, user);
}
