import { describe, it, expect, vi } from "vitest";
import { buildWritingKit } from "../../src/services/writing-kit-engine";
import type { ContentItem } from "../../src/domain/content";
import type { UserProfile } from "../../src/domain/user-profile";
import type { SummarizerProvider } from "../../src/ports/summarizer";
import type { IdeaProvider } from "../../src/ports/idea-generator";
import type { OutlineProvider } from "../../src/ports/outline-generator";

describe("buildWritingKit", () => {
  const mockContent: ContentItem = {
    id: "test-1",
    title: "Test Article",
    url: "https://example.com",
    rawText: "This is a test article. It has multiple sentences. And some more content here.",
    source: { id: "test", type: "custom", url: "https://source.com", label: "Test Source" },
    metadata: {},
  };

  const mockUser: UserProfile = {
    userId: "user-1",
    topics: [{ topic: "testing", interestLevel: 5 }],
    style: {
      tone: "intermediate",
      targetWordCount: 1000,
      voice: "first-person",
    },
  };

  it("should build complete writing kit", async () => {
    const mockSummary = {
      contentId: "test-1",
      headline: "Test headline",
      tldr: "Test TLDR content",
      bullets: ["Point 1", "Point 2"],
      tags: ["test", "article"],
      sentiment: "neutral" as const,
      category: "article",
      score: { relevanceToUser: 0.8 },
    };

    const mockIdeas = {
      contentId: "test-1",
      hooks: [{ text: "What if testing was easy?", type: "curiosity" as const }],
      angles: [{ title: "Beginner Guide", description: "Guide for newbies", relevanceScore: 0.9 }],
      questions: [{ question: "How does testing improve quality?", type: "practical" as const }],
    };

    const mockOutline = [
      { heading: "Introduction", notes: "Start here", estimatedWords: 200 },
      { heading: "Main Content", notes: "Develop ideas", estimatedWords: 600 },
      { heading: "Conclusion", notes: "Wrap up", estimatedWords: 200 },
    ];

    const summarizer: SummarizerProvider = {
      summarize: vi.fn().mockResolvedValue({ success: true, data: mockSummary }),
    };

    const idea: IdeaProvider = {
      generateIdeas: vi.fn().mockResolvedValue({ success: true, data: mockIdeas }),
    };

    const outline: OutlineProvider = {
      generateOutline: vi.fn().mockResolvedValue({ success: true, data: mockOutline }),
    };

    const result = await buildWritingKit(mockContent, mockUser, { summarizer, idea, outline });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentId).toBe("test-1");
      expect(result.data.summary).toEqual(mockSummary);
      expect(result.data.ideas).toEqual(mockIdeas);
      expect(result.data.suggestedOutline).toEqual(mockOutline);
      expect(result.data.source.id).toBe("test");
      expect(result.data.source.label).toBe("Test Source");
      expect(result.data.meta.relevanceToUser).toBe(0.8);
    }
  });

  it("should propagate summarizer errors", async () => {
    const summarizer: SummarizerProvider = {
      summarize: vi.fn().mockResolvedValue({
        success: false,
        error: { type: "rate_limit", retryAfterMs: 1000, message: "Rate limited" },
      }),
    };

    const idea: IdeaProvider = {
      generateIdeas: vi.fn(),
    };

    const outline: OutlineProvider = {
      generateOutline: vi.fn(),
    };

    const result = await buildWritingKit(mockContent, mockUser, { summarizer, idea, outline });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("rate_limit");
    }
    expect(idea.generateIdeas).not.toHaveBeenCalled();
    expect(outline.generateOutline).not.toHaveBeenCalled();
  });

  it("should propagate idea generator errors", async () => {
    const mockSummary = {
      contentId: "test-1",
      headline: "Test headline",
      tldr: "Test TLDR content",
      bullets: ["Point 1"],
      tags: ["test"],
      sentiment: "neutral" as const,
      category: "article",
      score: { relevanceToUser: 0.5 },
    };

    const summarizer: SummarizerProvider = {
      summarize: vi.fn().mockResolvedValue({ success: true, data: mockSummary }),
    };

    const idea: IdeaProvider = {
      generateIdeas: vi.fn().mockResolvedValue({
        success: false,
        error: { type: "network_error", message: "Connection failed" },
      }),
    };

    const outline: OutlineProvider = {
      generateOutline: vi.fn(),
    };

    const result = await buildWritingKit(mockContent, mockUser, { summarizer, idea, outline });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("network_error");
    }
    expect(outline.generateOutline).not.toHaveBeenCalled();
  });
});
