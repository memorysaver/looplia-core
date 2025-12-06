import { describe, expect, it } from "bun:test";
import { createMockIdeaGenerator } from "../../src/adapters/mock/mock-idea-generator";
import { createMockOutlineGenerator } from "../../src/adapters/mock/mock-outline-generator";
import { createMockSummarizer } from "../../src/adapters/mock/mock-summarizer";
import type { ContentItem } from "../../src/domain/content";
import type { UserProfile } from "../../src/domain/user-profile";
import { buildWritingKit } from "../../src/services/writing-kit-engine";

describe("Full Pipeline Integration", () => {
  const content: ContentItem = {
    id: "test-content",
    title: "Understanding AI Agents",
    url: "https://example.com/ai-agents",
    rawText: `
      AI agents are autonomous systems that can perceive their environment
      and take actions to achieve specific goals. They represent a significant
      advancement in artificial intelligence, enabling more complex and
      adaptive behaviors than traditional rule-based systems.

      Modern AI agents use machine learning to improve over time.
      They can handle uncertain environments and make decisions based on
      incomplete information. This makes them particularly useful for
      real-world applications where conditions change frequently.

      The development of AI agents requires careful consideration of
      safety and alignment. Researchers are working on ways to ensure
      that AI agents behave in accordance with human values and intentions.
    `,
    source: { id: "blog", type: "rss", url: "https://example.com/feed" },
    metadata: { language: "en" },
  };

  const user: UserProfile = {
    userId: "user-1",
    topics: [
      { topic: "ai", interestLevel: 5 },
      { topic: "agents", interestLevel: 4 },
    ],
    style: {
      tone: "intermediate",
      targetWordCount: 1000,
      voice: "first-person",
    },
  };

  it("should produce complete writing kit", async () => {
    const providers = {
      summarizer: createMockSummarizer(),
      idea: createMockIdeaGenerator(),
      outline: createMockOutlineGenerator(),
    };

    const result = await buildWritingKit(content, user, providers);

    expect(result.success).toBe(true);
    if (result.success) {
      // Check content ID propagates
      expect(result.data.contentId).toBe("test-content");

      // Check summary is generated
      expect(result.data.summary.headline).toBeTruthy();
      expect(result.data.summary.tldr).toBeTruthy();
      expect(result.data.summary.bullets.length).toBeGreaterThan(0);
      expect(result.data.summary.tags.length).toBeGreaterThan(0);

      // Check ideas are generated
      expect(result.data.ideas.hooks.length).toBeGreaterThan(0);
      expect(result.data.ideas.angles.length).toBeGreaterThan(0);
      expect(result.data.ideas.questions.length).toBeGreaterThan(0);

      // Check outline is generated
      expect(result.data.suggestedOutline.length).toBeGreaterThan(0);

      // Check metadata
      expect(result.data.meta.relevanceToUser).toBeGreaterThanOrEqual(0);
      expect(result.data.meta.relevanceToUser).toBeLessThanOrEqual(1);
      expect(result.data.meta.estimatedReadingTimeMinutes).toBeGreaterThan(0);

      // Check source info
      expect(result.data.source.id).toBe("blog");
      expect(result.data.source.url).toBe("https://example.com/ai-agents");
    }
  });

  it("should generate different outlines based on word count", async () => {
    const providers = {
      summarizer: createMockSummarizer(),
      idea: createMockIdeaGenerator(),
      outline: createMockOutlineGenerator(),
    };

    const shortUser: UserProfile = {
      ...user,
      style: { ...user.style, targetWordCount: 300 },
    };

    const longUser: UserProfile = {
      ...user,
      style: { ...user.style, targetWordCount: 3000 },
    };

    const shortResult = await buildWritingKit(content, shortUser, providers);
    const longResult = await buildWritingKit(content, longUser, providers);

    expect(shortResult.success).toBe(true);
    expect(longResult.success).toBe(true);

    if (shortResult.success && longResult.success) {
      // Both should have outlines, but word estimates should differ
      const shortWords = shortResult.data.suggestedOutline.reduce(
        (sum, s) => sum + (s.estimatedWords ?? 0),
        0
      );
      const longWords = longResult.data.suggestedOutline.reduce(
        (sum, s) => sum + (s.estimatedWords ?? 0),
        0
      );

      expect(longWords).toBeGreaterThan(shortWords);
    }
  });
});
