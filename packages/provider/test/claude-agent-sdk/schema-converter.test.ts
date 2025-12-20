import { describe, expect, it } from "bun:test";
import {
  OUTLINE_OUTPUT_SCHEMA,
  WRITING_KIT_OUTPUT_SCHEMA,
} from "../../src/claude-agent-sdk/utils/schema-converter";

describe("schema-converter", () => {
  describe("OUTLINE_OUTPUT_SCHEMA", () => {
    it("should be an object schema (Claude API requirement)", () => {
      expect(OUTLINE_OUTPUT_SCHEMA.type).toBe("object");
    });

    it("should have sections array property", () => {
      expect(OUTLINE_OUTPUT_SCHEMA.properties).toHaveProperty("sections");
      expect(OUTLINE_OUTPUT_SCHEMA.properties.sections.type).toBe("array");
    });

    it("should have items with required properties", () => {
      const items = OUTLINE_OUTPUT_SCHEMA.properties.sections.items;
      expect(items).toBeDefined();
      expect(items.type).toBe("object");
      expect(items.properties).toHaveProperty("heading");
      expect(items.properties).toHaveProperty("notes");
      expect(items.properties).toHaveProperty("estimatedWords");
    });

    it("should require heading and notes", () => {
      const items = OUTLINE_OUTPUT_SCHEMA.properties.sections.items;
      expect(items.required).toContain("heading");
      expect(items.required).toContain("notes");
    });

    it("should not require estimatedWords", () => {
      const items = OUTLINE_OUTPUT_SCHEMA.properties.sections.items;
      expect(items.required).not.toContain("estimatedWords");
    });
  });

  describe("WRITING_KIT_OUTPUT_SCHEMA", () => {
    it("should be an object schema", () => {
      expect(WRITING_KIT_OUTPUT_SCHEMA.type).toBe("object");
    });

    it("should have required top-level properties", () => {
      expect(WRITING_KIT_OUTPUT_SCHEMA.required).toContain("contentId");
      expect(WRITING_KIT_OUTPUT_SCHEMA.required).toContain("source");
      expect(WRITING_KIT_OUTPUT_SCHEMA.required).toContain("summary");
      expect(WRITING_KIT_OUTPUT_SCHEMA.required).toContain("ideas");
      expect(WRITING_KIT_OUTPUT_SCHEMA.required).toContain("suggestedOutline");
      expect(WRITING_KIT_OUTPUT_SCHEMA.required).toContain("meta");
    });
  });
});
