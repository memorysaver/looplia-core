import type { ContentSummary } from "../domain/summary";
import type { UserProfile } from "../domain/user-profile";

/**
 * Policy interface for scoring and ranking content
 *
 * Note: Scoring should be stateless. Complex scoring
 * requiring historical data (like novelty detection)
 * should be handled at the application layer.
 */
export interface ScoringPolicy {
  /**
   * Calculate relevance score for content
   *
   * @param summary - The content summary
   * @param user - User profile
   * @returns Relevance score (0-1)
   */
  relevance(summary: ContentSummary, user: UserProfile): number;
}

/**
 * Default scoring policy based on topic matching
 */
export const defaultScoringPolicy: ScoringPolicy = {
  relevance(summary, user) {
    if (user.topics.length === 0) return 0.5;

    const summaryTags = new Set(summary.tags.map((t) => t.toLowerCase()));

    let totalWeight = 0;
    let matchedWeight = 0;

    for (const topic of user.topics) {
      const weight = topic.interestLevel / 5;
      totalWeight += weight;

      if (summaryTags.has(topic.topic.toLowerCase())) {
        matchedWeight += weight;
      }
    }

    return totalWeight > 0 ? matchedWeight / totalWeight : 0.5;
  },
};
