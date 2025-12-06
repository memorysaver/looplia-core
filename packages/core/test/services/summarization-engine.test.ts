import { describe, expect, it, vi } from "vitest";
import type { ContentItem } from "../../src/domain/content";
import type { SummarizerProvider } from "../../src/ports/summarizer";
import { summarizeContent } from "../../src/services/summarization-engine";

describe("summarizeContent", () => {
  const mockContent: ContentItem = {
    id: "test-1",
    title: "Test Article",
    url: "https://example.com",
    rawText: "This is a test article with enough content to summarize.",
    source: { id: "test", type: "custom", url: "" },
    metadata: {},
  };

  it("should return summary from provider", async () => {
    const mockProvider: SummarizerProvider = {
      summarize: vi.fn().mockResolvedValue({
        success: true,
        data: {
          contentId: "test-1",
          headline: "Test headline here",
          tldr: "This is a test TLDR summary",
          bullets: ["Point 1"],
          tags: ["test"],
          sentiment: "neutral",
          category: "test",
          score: { relevanceToUser: 0.5 },
        },
      }),
    };

    const result = await summarizeContent(mockContent, undefined, mockProvider);

    expect(result.success).toBe(true);
    expect(mockProvider.summarize).toHaveBeenCalledWith(mockContent, undefined);
  });

  it("should propagate provider errors", async () => {
    const mockProvider: SummarizerProvider = {
      summarize: vi.fn().mockResolvedValue({
        success: false,
        error: {
          type: "rate_limit",
          retryAfterMs: 1000,
          message: "Rate limited",
        },
      }),
    };

    const result = await summarizeContent(mockContent, undefined, mockProvider);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("rate_limit");
    }
  });
});
