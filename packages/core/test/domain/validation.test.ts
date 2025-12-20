import { describe, expect, it } from "bun:test";
import {
  validateContentItem,
  validateSessionManifest,
  validateUserProfile,
} from "../../src/validation/schemas";

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

describe("SessionManifest validation", () => {
  it("should accept valid session manifest", () => {
    const valid = {
      version: 1,
      contentId: "article-2025-12-12-a1b2c3",
      pipeline: "writing-kit",
      desiredOutput: "writing-kit.json",
      updatedAt: "2025-12-12T10:35:42.000Z",
      steps: {},
    };

    const result = validateSessionManifest(valid);
    expect(result.success).toBe(true);
  });

  it("should accept manifest with done steps", () => {
    const valid = {
      version: 1,
      contentId: "article-2025-12-12-a1b2c3",
      pipeline: "writing-kit",
      desiredOutput: "writing-kit.json",
      updatedAt: "2025-12-12T10:35:42.000Z",
      steps: {
        analyzing: "done",
        generating_ideas: "done",
      },
    };

    const result = validateSessionManifest(valid);
    expect(result.success).toBe(true);
  });

  it("should reject invalid version (not 1)", () => {
    const invalid = {
      version: 2,
      contentId: "article-2025-12-12-a1b2c3",
      pipeline: "writing-kit",
      desiredOutput: "writing-kit.json",
      updatedAt: "2025-12-12T10:35:42.000Z",
      steps: {},
    };

    const result = validateSessionManifest(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject missing contentId", () => {
    const invalid = {
      version: 1,
      pipeline: "writing-kit",
      desiredOutput: "writing-kit.json",
      updatedAt: "2025-12-12T10:35:42.000Z",
      steps: {},
    };

    const result = validateSessionManifest(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject missing pipeline", () => {
    const invalid = {
      version: 1,
      contentId: "article-2025-12-12-a1b2c3",
      desiredOutput: "writing-kit.json",
      updatedAt: "2025-12-12T10:35:42.000Z",
      steps: {},
    };

    const result = validateSessionManifest(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject missing desiredOutput", () => {
    const invalid = {
      version: 1,
      contentId: "article-2025-12-12-a1b2c3",
      pipeline: "writing-kit",
      updatedAt: "2025-12-12T10:35:42.000Z",
      steps: {},
    };

    const result = validateSessionManifest(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject invalid step values (not 'done')", () => {
    const invalid = {
      version: 1,
      contentId: "article-2025-12-12-a1b2c3",
      pipeline: "writing-kit",
      desiredOutput: "writing-kit.json",
      updatedAt: "2025-12-12T10:35:42.000Z",
      steps: {
        analyzing: "in_progress",
      },
    };

    const result = validateSessionManifest(invalid);
    expect(result.success).toBe(false);
  });
});
