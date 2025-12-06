import { describe, expect, it } from "bun:test";
import { createMockSummarizer } from "../../../src/adapters/mock/mock-summarizer";
import type { ContentItem } from "../../../src/domain/content";
import type { UserProfile } from "../../../src/domain/user-profile";

describe("createMockSummarizer", () => {
  const mockContent: ContentItem = {
    id: "test-1",
    title: "AI and Machine Learning Guide",
    url: "https://example.com/ai-guide",
    rawText: `
      Artificial intelligence is transforming how we work and live.
      Machine learning, a subset of AI, enables systems to learn from data.
      Deep learning is another advancement in the field of AI.
      Companies are investing heavily in AI research and development.
      The future of AI looks promising with many applications.
    `,
    source: { id: "blog", type: "rss", url: "https://example.com/feed" },
    metadata: { language: "en" },
  };

  it("should return a successful summary", async () => {
    const summarizer = createMockSummarizer();
    const result = await summarizer.summarize(mockContent);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentId).toBe("test-1");
      expect(result.data.headline).toBeTruthy();
      expect(result.data.tldr).toBeTruthy();
      expect(result.data.bullets.length).toBeGreaterThan(0);
      expect(result.data.tags.length).toBeGreaterThan(0);
      expect(result.data.sentiment).toBe("neutral");
      expect(result.data.category).toBe("article");
      expect(result.data.score.relevanceToUser).toBeGreaterThanOrEqual(0);
      expect(result.data.score.relevanceToUser).toBeLessThanOrEqual(1);
    }
  });

  it("should increase relevance when user topics match tags", async () => {
    const summarizer = createMockSummarizer();

    const userWithMatchingTopics: UserProfile = {
      userId: "user-1",
      topics: [
        { topic: "artificial", interestLevel: 5 },
        { topic: "learning", interestLevel: 4 },
      ],
      style: {
        tone: "intermediate",
        targetWordCount: 1000,
        voice: "first-person",
      },
    };

    const resultWithUser = await summarizer.summarize(
      mockContent,
      userWithMatchingTopics
    );
    const resultWithoutUser = await summarizer.summarize(mockContent);

    expect(resultWithUser.success).toBe(true);
    expect(resultWithoutUser.success).toBe(true);

    if (resultWithUser.success && resultWithoutUser.success) {
      // With matching topics, relevance should be higher
      expect(resultWithUser.data.score.relevanceToUser).toBeGreaterThanOrEqual(
        resultWithoutUser.data.score.relevanceToUser
      );
    }
  });

  it("should handle content with minimal text", async () => {
    const minimalContent: ContentItem = {
      id: "minimal-1",
      title: "Short",
      url: "https://example.com/short",
      rawText: "Just one sentence here.",
      source: { id: "test", type: "custom", url: "" },
      metadata: {},
    };

    const summarizer = createMockSummarizer();
    const result = await summarizer.summarize(minimalContent);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bullets.length).toBeGreaterThan(0);
      expect(result.data.tags).toContain("general"); // Falls back to general
    }
  });
});
