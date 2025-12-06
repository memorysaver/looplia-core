import type { OutlineProvider } from "../../ports/outline-generator";
import type { ContentSummary } from "../../domain/summary";
import type { WritingIdeas } from "../../domain/ideas";
import type { UserProfile } from "../../domain/user-profile";
import type { OutlineSection } from "../../domain/writing-kit";
import type { ProviderResult } from "../../domain/errors";

/**
 * Create a mock outline generator for testing
 */
export function createMockOutlineGenerator(): OutlineProvider {
  return {
    async generateOutline(
      summary: ContentSummary,
      ideas: WritingIdeas,
      user: UserProfile
    ): Promise<ProviderResult<OutlineSection[]>> {
      const totalWords = user.style.targetWordCount;
      const sections = Math.max(3, Math.ceil(totalWords / 300));
      const wordsPerSection = Math.floor(totalWords / sections);

      const outline: OutlineSection[] = [
        {
          heading: "Introduction",
          notes: `Open with hook: "${ideas.hooks[0]?.text ?? "Start with an engaging hook"}". Set up the context for ${summary.headline}.`,
          estimatedWords: wordsPerSection,
        },
        {
          heading: "Main Point",
          notes: `Develop the angle: ${ideas.angles[0]?.title ?? "Main perspective"}. Use bullets: ${summary.bullets.slice(0, 2).join(", ")}.`,
          estimatedWords: wordsPerSection * 2,
        },
        {
          heading: "Analysis",
          notes: `Address: ${ideas.questions[0]?.question ?? "Key question"}. Provide insights based on ${summary.tldr.slice(0, 100)}...`,
          estimatedWords: wordsPerSection,
        },
        {
          heading: "Conclusion",
          notes: `Summarize key takeaways. Call to action based on ${ideas.angles[0]?.description ?? "main angle"}.`,
          estimatedWords: wordsPerSection,
        },
      ];

      return { success: true, data: outline };
    },
  };
}
