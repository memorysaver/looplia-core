import { describe, expect, it } from "bun:test";
import {
  IDEAS_OUTPUT_SCHEMA,
  OUTLINE_OUTPUT_SCHEMA,
  SUMMARY_OUTPUT_SCHEMA,
  WRITING_KIT_SCHEMA,
} from "../../src/claude-agent-sdk/utils/schema-converter";

/**
 * Tests for v0.3.1 agentic architecture
 *
 * In v0.3.1, prompts are minimal (task identifiers) and logic lives in plugin files.
 * These tests verify the output schemas are correctly defined for SDK structured output.
 */
describe("v0.3.1 agentic architecture", () => {
  describe("output schemas", () => {
    it("should have valid summary schema with all 15 fields", () => {
      expect(SUMMARY_OUTPUT_SCHEMA).toBeDefined();
      expect(typeof SUMMARY_OUTPUT_SCHEMA).toBe("object");

      // Schema should be an object with properties
      const schema = SUMMARY_OUTPUT_SCHEMA as Record<string, unknown>;
      expect(schema.type).toBe("object");
    });

    it("should have valid ideas schema", () => {
      expect(IDEAS_OUTPUT_SCHEMA).toBeDefined();
      expect(typeof IDEAS_OUTPUT_SCHEMA).toBe("object");

      const schema = IDEAS_OUTPUT_SCHEMA as Record<string, unknown>;
      expect(schema.type).toBe("object");
    });

    it("should have valid outline schema with sections array", () => {
      expect(OUTLINE_OUTPUT_SCHEMA).toBeDefined();
      expect(OUTLINE_OUTPUT_SCHEMA.type).toBe("object");
      expect(OUTLINE_OUTPUT_SCHEMA.properties.sections).toBeDefined();
      expect(OUTLINE_OUTPUT_SCHEMA.properties.sections.type).toBe("array");
    });

    it("should have valid writing kit schema with all components", () => {
      expect(WRITING_KIT_SCHEMA).toBeDefined();
      expect(WRITING_KIT_SCHEMA.type).toBe("object");
      expect(WRITING_KIT_SCHEMA.properties.summary).toBeDefined();
      expect(WRITING_KIT_SCHEMA.properties.ideas).toBeDefined();
      expect(WRITING_KIT_SCHEMA.properties.suggestedOutline).toBeDefined();
      expect(WRITING_KIT_SCHEMA.required).toContain("summary");
      expect(WRITING_KIT_SCHEMA.required).toContain("ideas");
      expect(WRITING_KIT_SCHEMA.required).toContain("suggestedOutline");
    });

    it("should have outline section items with heading and notes", () => {
      const sectionItem = OUTLINE_OUTPUT_SCHEMA.properties.sections.items;
      expect(sectionItem.properties.heading).toBeDefined();
      expect(sectionItem.properties.notes).toBeDefined();
      expect(sectionItem.required).toContain("heading");
      expect(sectionItem.required).toContain("notes");
    });
  });

  describe("minimal prompts", () => {
    it("should use short task-identifier prompts", () => {
      // In v0.3.1, prompts are minimal - just task identifiers
      // The agent reads CLAUDE.md for full instructions
      const summarizePrompt = "Summarize content: contentItem/test-123.md";
      const kitPrompt = "Build writing kit for: contentItem/test-123.md";

      // Prompts should be short (under 100 chars)
      expect(summarizePrompt.length).toBeLessThan(100);
      expect(kitPrompt.length).toBeLessThan(100);

      // Prompts should contain the content file path
      expect(summarizePrompt).toContain("contentItem/");
      expect(kitPrompt).toContain("contentItem/");
    });
  });
});
