import { describe, expect, it } from "bun:test";
import {
  validateContentItem,
  validateContentSummary,
  validateUserProfile,
  validateWritingIdeas,
} from "../../src/validation/schemas";

describe("ContentSummary validation", () => {
  it("should accept valid summary", () => {
    const valid = {
      contentId: "test-1",
      headline: "This is a valid headline",
      tldr: "This is a valid TLDR that is long enough",
      bullets: ["Point 1", "Point 2"],
      tags: ["tag1", "tag2"],
      sentiment: "neutral",
      category: "article",
      score: { relevanceToUser: 0.75 },
      // v0.3 enhanced fields
      overview:
        "This is a comprehensive overview of the content that spans multiple paragraphs and provides rich context.",
      keyThemes: ["theme1", "theme2", "theme3"],
      detailedAnalysis:
        "This is a detailed documentary-style analysis of the content that breaks down the key points and structure.",
      narrativeFlow:
        "The content progresses from introduction to key points to conclusion in a logical manner.",
      coreIdeas: [
        {
          concept: "Main Concept",
          explanation: "This is the primary focus of the content.",
          examples: ["Example 1", "Example 2"],
        },
      ],
      importantQuotes: [
        {
          text: "This is an important verbatim quote from the content.",
          context: "Said during the introduction",
        },
      ],
      context:
        "This content requires understanding of the background topic and related concepts.",
      relatedConcepts: ["related1", "related2"],
    };

    const result = validateContentSummary(valid);
    expect(result.success).toBe(true);
  });

  it("should reject invalid score", () => {
    const invalid = {
      contentId: "test-1",
      headline: "This is a valid headline",
      tldr: "This is a valid TLDR that is long enough",
      bullets: ["Point 1"],
      tags: ["tag1"],
      sentiment: "neutral",
      category: "article",
      score: { relevanceToUser: 1.5 }, // Invalid: > 1
      // v0.3 enhanced fields
      overview: "This is a comprehensive overview of the content.",
      keyThemes: ["theme1", "theme2", "theme3"],
      detailedAnalysis:
        "This is a detailed documentary-style analysis of the content.",
      narrativeFlow: "The content progresses logically from start to finish.",
      coreIdeas: [
        { concept: "Main Concept", explanation: "The primary focus." },
      ],
      importantQuotes: [],
      context: "Background context for the content.",
      relatedConcepts: [],
    };

    const result = validateContentSummary(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject empty bullets array", () => {
    const invalid = {
      contentId: "test-1",
      headline: "This is a valid headline",
      tldr: "This is a valid TLDR that is long enough",
      bullets: [],
      tags: ["tag1"],
      sentiment: "neutral",
      category: "article",
      score: { relevanceToUser: 0.5 },
      // v0.3 enhanced fields
      overview: "This is a comprehensive overview of the content.",
      keyThemes: ["theme1", "theme2", "theme3"],
      detailedAnalysis:
        "This is a detailed documentary-style analysis of the content.",
      narrativeFlow: "The content progresses logically from start to finish.",
      coreIdeas: [
        { concept: "Main Concept", explanation: "The primary focus." },
      ],
      importantQuotes: [],
      context: "Background context for the content.",
      relatedConcepts: [],
    };

    const result = validateContentSummary(invalid);
    expect(result.success).toBe(false);
  });
});

describe("ContentItem validation", () => {
  it("should accept valid content item", () => {
    const valid = {
      id: "item-1",
      source: {
        id: "source-1",
        type: "rss",
        url: "https://example.com/feed",
      },
      title: "Test Article",
      url: "https://example.com/article",
      rawText: "This is the content of the article.",
      metadata: {},
    };

    const result = validateContentItem(valid);
    expect(result.success).toBe(true);
  });

  it("should reject empty rawText", () => {
    const invalid = {
      id: "item-1",
      source: {
        id: "source-1",
        type: "rss",
        url: "https://example.com/feed",
      },
      title: "Test Article",
      url: "https://example.com/article",
      rawText: "",
      metadata: {},
    };

    const result = validateContentItem(invalid);
    expect(result.success).toBe(false);
  });
});

describe("UserProfile validation", () => {
  it("should accept valid user profile", () => {
    const valid = {
      userId: "user-1",
      topics: [{ topic: "ai", interestLevel: 5 }],
      style: {
        tone: "intermediate",
        targetWordCount: 1000,
        voice: "first-person",
      },
    };

    const result = validateUserProfile(valid);
    expect(result.success).toBe(true);
  });

  it("should reject invalid interest level", () => {
    const invalid = {
      userId: "user-1",
      topics: [{ topic: "ai", interestLevel: 10 }], // Invalid: > 5
      style: {
        tone: "intermediate",
        targetWordCount: 1000,
        voice: "first-person",
      },
    };

    const result = validateUserProfile(invalid);
    expect(result.success).toBe(false);
  });
});

describe("WritingIdeas validation", () => {
  it("should accept valid writing ideas", () => {
    const valid = {
      contentId: "content-1",
      hooks: [{ text: "What if this happened?", type: "curiosity" }],
      angles: [
        {
          title: "Beginner Guide",
          description: "A guide for newcomers to the topic",
          relevanceScore: 0.8,
        },
      ],
      questions: [
        {
          question: "How does this affect your workflow?",
          type: "practical",
        },
      ],
    };

    const result = validateWritingIdeas(valid);
    expect(result.success).toBe(true);
  });

  it("should reject empty hooks array", () => {
    const invalid = {
      contentId: "content-1",
      hooks: [],
      angles: [
        {
          title: "Beginner Guide",
          description: "A guide for newcomers to the topic",
          relevanceScore: 0.8,
        },
      ],
      questions: [
        {
          question: "How does this affect your workflow?",
          type: "practical",
        },
      ],
    };

    const result = validateWritingIdeas(invalid);
    expect(result.success).toBe(false);
  });
});
