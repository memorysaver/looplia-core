import type { ProviderResult } from "../../domain/errors";
import type { WritingIdeas } from "../../domain/ideas";
import type { ContentSummary } from "../../domain/summary";
import type { UserProfile } from "../../domain/user-profile";
import type { IdeaProvider } from "../../ports/idea-generator";

/**
 * Create a mock idea generator for testing
 */
export function createMockIdeaGenerator(): IdeaProvider {
  return {
    generateIdeas(
      summary: ContentSummary,
      user: UserProfile
    ): Promise<ProviderResult<WritingIdeas>> {
      const ideas: WritingIdeas = {
        contentId: summary.contentId,
        hooks: [
          {
            text: `What if ${summary.headline.toLowerCase()}?`,
            type: "curiosity",
          },
          {
            text: `The surprising truth about ${summary.tags[0] ?? "this topic"}`,
            type: "controversy",
          },
        ],
        angles: [
          {
            title: "Beginner's Guide",
            description: `Explain ${summary.tags[0] ?? "this concept"} for newcomers`,
            relevanceScore: user.style.tone === "beginner" ? 0.9 : 0.5,
          },
          {
            title: "Deep Dive",
            description: `Technical analysis of ${summary.headline}`,
            relevanceScore: user.style.tone === "expert" ? 0.9 : 0.5,
          },
        ],
        questions: [
          {
            question: `How does ${summary.tags[0] ?? "this"} affect your daily workflow?`,
            type: "practical",
          },
          {
            question: `What are the long-term implications of ${summary.headline}?`,
            type: "analytical",
          },
        ],
      };

      return Promise.resolve({ success: true, data: ideas });
    },
  };
}
