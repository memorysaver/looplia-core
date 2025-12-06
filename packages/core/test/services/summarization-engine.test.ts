import { describe, expect, it, mock } from "bun:test";
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
    const mockSummarize = mock(() =>
      Promise.resolve({
        success: true as const,
        data: {
          contentId: "test-1",
          headline: "Test headline here",
          tldr: "This is a test TLDR summary",
          bullets: ["Point 1"],
          tags: ["test"],
          sentiment: "neutral" as const,
          category: "test",
          score: { relevanceToUser: 0.5 },
        },
      })
    );

    const mockProvider: SummarizerProvider = {
      summarize: mockSummarize,
    };

    const result = await summarizeContent(mockContent, undefined, mockProvider);

    expect(result.success).toBe(true);
    expect(mockSummarize).toHaveBeenCalledWith(mockContent, undefined);
  });

  it("should propagate provider errors", async () => {
    const mockSummarize = mock(() =>
      Promise.resolve({
        success: false as const,
        error: {
          type: "rate_limit" as const,
          retryAfterMs: 1000,
          message: "Rate limited",
        },
      })
    );

    const mockProvider: SummarizerProvider = {
      summarize: mockSummarize,
    };

    const result = await summarizeContent(mockContent, undefined, mockProvider);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("rate_limit");
    }
  });
});
