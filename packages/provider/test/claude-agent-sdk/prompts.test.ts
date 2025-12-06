import { describe, expect, it } from "bun:test";
import {
  buildIdeasPrompt,
  IDEAS_SYSTEM_PROMPT,
} from "../../src/claude-agent-sdk/prompts/ideas";
import {
  buildOutlinePrompt,
  OUTLINE_SYSTEM_PROMPT,
} from "../../src/claude-agent-sdk/prompts/outline";
import {
  buildSummarizePrompt,
  SUMMARIZE_SYSTEM_PROMPT,
} from "../../src/claude-agent-sdk/prompts/summarize";
import {
  testContent,
  testIdeas,
  testSummary,
  testUser,
} from "./fixtures/test-data";

describe("prompts", () => {
  describe("summarize prompts", () => {
    it("should have a non-empty system prompt", () => {
      expect(SUMMARIZE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
      expect(SUMMARIZE_SYSTEM_PROMPT).toContain("summarization");
    });

    it("should build prompt with content details", () => {
      const prompt = buildSummarizePrompt(testContent);

      expect(prompt).toContain(testContent.title);
      expect(prompt).toContain(testContent.url);
      expect(prompt).toContain(testContent.id);
      expect(prompt).toContain("ContentSummary");
    });

    it("should include user context when provided", () => {
      const prompt = buildSummarizePrompt(testContent, testUser);

      expect(prompt).toContain("User Context");
      expect(prompt).toContain("artificial intelligence");
      expect(prompt).toContain(testUser.style.tone);
      expect(prompt).toContain(String(testUser.style.targetWordCount));
    });

    it("should not include user context when not provided", () => {
      const prompt = buildSummarizePrompt(testContent);

      expect(prompt).not.toContain("User Context");
    });

    it("should truncate long content", () => {
      const longContent = {
        ...testContent,
        rawText: "a".repeat(6000),
      };

      const prompt = buildSummarizePrompt(longContent);

      expect(prompt).toContain("[truncated]");
      expect(prompt.length).toBeLessThan(longContent.rawText.length);
    });
  });

  describe("ideas prompts", () => {
    it("should have a non-empty system prompt", () => {
      expect(IDEAS_SYSTEM_PROMPT.length).toBeGreaterThan(100);
      expect(IDEAS_SYSTEM_PROMPT).toContain("ideation");
    });

    it("should build prompt with summary details", () => {
      const prompt = buildIdeasPrompt(testSummary, testUser);

      expect(prompt).toContain(testSummary.headline);
      expect(prompt).toContain(testSummary.tldr);
      expect(prompt).toContain(testSummary.contentId);
      expect(prompt).toContain("WritingIdeas");
    });

    it("should include user profile details", () => {
      const prompt = buildIdeasPrompt(testSummary, testUser);

      expect(prompt).toContain("User Profile");
      expect(prompt).toContain(testUser.style.tone);
      expect(prompt).toContain(testUser.style.voice);
    });

    it("should include user topics with interest levels", () => {
      const prompt = buildIdeasPrompt(testSummary, testUser);

      // Verify interest levels are included (not just topic names)
      expect(prompt).toContain("artificial intelligence (level 5)");
      expect(prompt).toContain("software development (level 4)");
    });

    it("should mention hook types", () => {
      const prompt = buildIdeasPrompt(testSummary, testUser);

      expect(prompt).toContain("emotional");
      expect(prompt).toContain("curiosity");
      expect(prompt).toContain("controversy");
      expect(prompt).toContain("statistic");
      expect(prompt).toContain("story");
    });
  });

  describe("outline prompts", () => {
    it("should have a non-empty system prompt", () => {
      expect(OUTLINE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
      expect(OUTLINE_SYSTEM_PROMPT).toContain("outline");
    });

    it("should build prompt with summary and ideas", () => {
      const prompt = buildOutlinePrompt(testSummary, testIdeas, testUser);

      expect(prompt).toContain(testSummary.headline);
      expect(prompt).toContain("Available Hooks");
      expect(prompt).toContain("Narrative Angles");
      expect(prompt).toContain("Exploratory Questions");
    });

    it("should include hooks from ideas", () => {
      const prompt = buildOutlinePrompt(testSummary, testIdeas, testUser);

      for (const hook of testIdeas.hooks) {
        expect(prompt).toContain(hook.text);
        expect(prompt).toContain(hook.type);
      }
    });

    it("should include angles from ideas", () => {
      const prompt = buildOutlinePrompt(testSummary, testIdeas, testUser);

      for (const angle of testIdeas.angles) {
        expect(prompt).toContain(angle.title);
        expect(prompt).toContain(angle.description);
      }
    });

    it("should include target word count", () => {
      const prompt = buildOutlinePrompt(testSummary, testIdeas, testUser);

      expect(prompt).toContain(String(testUser.style.targetWordCount));
    });
  });
});
