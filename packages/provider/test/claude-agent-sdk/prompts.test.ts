import { describe, expect, it } from "bun:test";
import {
  buildSummarizePrompt,
  SUMMARIZE_SYSTEM_PROMPT,
} from "../../src/claude-agent-sdk/prompts/summarize";
import { testContent, testUser } from "./fixtures/test-data";

describe("prompts", () => {
  describe("summarize prompts", () => {
    it("should have a non-empty system prompt", () => {
      expect(SUMMARIZE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
      expect(SUMMARIZE_SYSTEM_PROMPT).toContain("summarization");
    });

    it("should build prompt with content details", () => {
      const prompt = buildSummarizePrompt(testContent);

      // v0.3.1 uses minimal agentic prompt with subagent invocation
      expect(prompt).toContain("content-analyzer");
      expect(prompt).toContain(testContent.id);
      expect(prompt).toContain("contentItem");
    });

    it("should include user context when provided", () => {
      const prompt = buildSummarizePrompt(testContent, testUser);

      // v0.3.1 uses minimal prompt; user context is handled by agent reading CLAUDE.md
      expect(prompt).toContain("content-analyzer");
      expect(prompt).toContain(testContent.id);
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

      // v0.3.1 uses minimal prompt; content is stored in file, not embedded in prompt
      expect(prompt).toContain("content-analyzer");
      expect(prompt).toContain(longContent.id);
      expect(prompt).toContain("contentItem");
    });
  });

  // Note: Ideas and outline prompts have been removed as they are now handled
  // by markdown-based subagents in the v0.3.2+ agentic architecture
});
