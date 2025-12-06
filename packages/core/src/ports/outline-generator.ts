import type { ProviderResult } from "../domain/errors";
import type { WritingIdeas } from "../domain/ideas";
import type { ContentSummary } from "../domain/summary";
import type { UserProfile } from "../domain/user-profile";
import type { OutlineSection } from "../domain/writing-kit";

/**
 * Provider interface for generating article outlines
 *
 * Implementations should:
 * - Create logical section structure
 * - Provide writing notes for each section
 * - Consider user's target word count
 * - Incorporate selected angles and hooks
 */
export type OutlineProvider = {
  /**
   * Generate article outline
   *
   * @param summary - The content summary
   * @param ideas - The generated writing ideas
   * @param user - User profile for personalization
   * @returns Outline sections or error
   */
  generateOutline(
    summary: ContentSummary,
    ideas: WritingIdeas,
    user: UserProfile
  ): Promise<ProviderResult<OutlineSection[]>>;
};
