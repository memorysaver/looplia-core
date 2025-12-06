import type { UserProfile } from "../domain/user-profile";
import type { WritingKit } from "../domain/writing-kit";
import type { ScoringPolicy } from "../ports/scoring";
import { defaultScoringPolicy } from "../ports/scoring";

/**
 * Rank writing kits by relevance to user
 *
 * @param kits - Kits to rank
 * @param user - User profile
 * @param policy - Scoring policy (optional)
 * @returns Sorted kits (most relevant first)
 */
export function rankKits(
  kits: WritingKit[],
  user: UserProfile,
  policy: ScoringPolicy = defaultScoringPolicy
): WritingKit[] {
  return [...kits]
    .map((kit) => ({
      kit,
      score: policy.relevance(kit.summary, user),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ kit }) => kit);
}
