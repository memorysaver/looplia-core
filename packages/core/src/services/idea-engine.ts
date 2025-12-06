import type { ContentSummary } from "../domain/summary";
import type { WritingIdeas } from "../domain/ideas";
import type { UserProfile } from "../domain/user-profile";
import type { ProviderResult } from "../domain/errors";
import type { IdeaProvider } from "../ports/idea-generator";

/**
 * Generate writing ideas from summary
 *
 * @param summary - Content summary
 * @param user - User profile
 * @param provider - Idea generator implementation
 * @returns Writing ideas or error
 */
export async function generateIdeas(
  summary: ContentSummary,
  user: UserProfile,
  provider: IdeaProvider
): Promise<ProviderResult<WritingIdeas>> {
  return provider.generateIdeas(summary, user);
}
