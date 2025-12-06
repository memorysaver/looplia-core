import { describe, expect, it } from "bun:test";
import type { UserProfile } from "../../src/domain/user-profile";
import type { WritingKit } from "../../src/domain/writing-kit";
import { rankKits } from "../../src/services/ranking-engine";

describe("rankKits", () => {
  const createMockKit = (
    id: string,
    tags: string[],
    relevance: number
  ): WritingKit => ({
    contentId: id,
    source: { id: "src", label: "Source", url: "https://example.com" },
    summary: {
      contentId: id,
      headline: `Headline for ${id}`,
      tldr: `TLDR for ${id}`,
      bullets: ["Point 1"],
      tags,
      sentiment: "neutral",
      category: "article",
      score: { relevanceToUser: relevance },
    },
    ideas: {
      contentId: id,
      hooks: [{ text: "Hook", type: "curiosity" }],
      angles: [
        { title: "Angle", description: "Description", relevanceScore: 0.5 },
      ],
      questions: [{ question: "Question?", type: "practical" }],
    },
    suggestedOutline: [{ heading: "Section", notes: "Notes" }],
    meta: { relevanceToUser: relevance, estimatedReadingTimeMinutes: 5 },
  });

  const mockUser: UserProfile = {
    userId: "user-1",
    topics: [
      { topic: "ai", interestLevel: 5 },
      { topic: "typescript", interestLevel: 3 },
    ],
    style: {
      tone: "intermediate",
      targetWordCount: 1000,
      voice: "first-person",
    },
  };

  it("should rank kits by relevance score", () => {
    const kits = [
      createMockKit("kit-1", ["general"], 0.3),
      createMockKit("kit-2", ["ai"], 0.8),
      createMockKit("kit-3", ["typescript"], 0.5),
    ];

    const ranked = rankKits(kits, mockUser);

    expect(ranked[0]?.contentId).toBe("kit-2"); // ai matches, highest
    expect(ranked[1]?.contentId).toBe("kit-3"); // typescript matches
    expect(ranked[2]?.contentId).toBe("kit-1"); // no match
  });

  it("should not mutate original array", () => {
    const kits = [
      createMockKit("kit-1", ["general"], 0.3),
      createMockKit("kit-2", ["ai"], 0.8),
    ];

    const originalOrder = [...kits];
    rankKits(kits, mockUser);

    expect(kits[0]?.contentId).toBe(originalOrder[0]?.contentId);
    expect(kits[1]?.contentId).toBe(originalOrder[1]?.contentId);
  });

  it("should handle empty kits array", () => {
    const ranked = rankKits([], mockUser);
    expect(ranked).toEqual([]);
  });

  it("should use custom scoring policy", () => {
    const kits = [
      createMockKit("kit-1", ["general"], 0.3),
      createMockKit("kit-2", ["ai"], 0.8),
    ];

    // Custom policy that always returns 1 for kit-1
    const customPolicy = {
      relevance: (summary: { contentId: string }) =>
        summary.contentId === "kit-1" ? 1.0 : 0.0,
    };

    const ranked = rankKits(kits, mockUser, customPolicy);

    expect(ranked[0]?.contentId).toBe("kit-1"); // Custom policy prioritizes kit-1
    expect(ranked[1]?.contentId).toBe("kit-2");
  });
});
