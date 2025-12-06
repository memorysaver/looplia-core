import type { ProviderResult } from "../domain/errors";
import type { WritingIdeas } from "../domain/ideas";
import type { ContentSummary } from "../domain/summary";
import type { UserProfile } from "../domain/user-profile";

/**
 * Provider interface for generating writing ideas
 *
 * Implementations should:
 * - Generate attention-grabbing hooks
 * - Suggest narrative angles
 * - Formulate exploratory questions
 * - Consider user's interests and style
 */
export type IdeaProvider = {
  /**
   * Generate writing ideas from summary
   *
   * @param summary - The content summary
   * @param user - User profile for personalization
   * @returns Writing ideas or error
   */
  generateIdeas(
    summary: ContentSummary,
    user: UserProfile
  ): Promise<ProviderResult<WritingIdeas>>;
};
