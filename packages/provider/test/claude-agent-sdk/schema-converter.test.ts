import { describe, expect, it } from "bun:test";
import {
  IDEAS_OUTPUT_SCHEMA,
  OUTLINE_OUTPUT_SCHEMA,
  SUMMARY_OUTPUT_SCHEMA,
} from "../../src/claude-agent-sdk/utils/schema-converter";

describe("schema-converter", () => {
  describe("SUMMARY_OUTPUT_SCHEMA", () => {
    it("should be a valid JSON schema object", () => {
      expect(typeof SUMMARY_OUTPUT_SCHEMA).toBe("object");
      expect(SUMMARY_OUTPUT_SCHEMA).toBeTruthy();
    });

    it("should have required properties for ContentSummary", () => {
      // openApi3 target generates inline schema with type at root (required by Claude API)
      expect(SUMMARY_OUTPUT_SCHEMA).toHaveProperty("type", "object");
      expect(SUMMARY_OUTPUT_SCHEMA).toHaveProperty("properties");
      expect(SUMMARY_OUTPUT_SCHEMA).toHaveProperty("required");
    });
  });

  describe("IDEAS_OUTPUT_SCHEMA", () => {
    it("should be a valid JSON schema object", () => {
      expect(typeof IDEAS_OUTPUT_SCHEMA).toBe("object");
      expect(IDEAS_OUTPUT_SCHEMA).toBeTruthy();
    });

    it("should have required properties for WritingIdeas", () => {
      // openApi3 target generates inline schema with type at root (required by Claude API)
      expect(IDEAS_OUTPUT_SCHEMA).toHaveProperty("type", "object");
      expect(IDEAS_OUTPUT_SCHEMA).toHaveProperty("properties");
      expect(IDEAS_OUTPUT_SCHEMA).toHaveProperty("required");
    });
  });

  describe("OUTLINE_OUTPUT_SCHEMA", () => {
    it("should be an array schema", () => {
      expect(OUTLINE_OUTPUT_SCHEMA.type).toBe("array");
    });

    it("should have items with required properties", () => {
      expect(OUTLINE_OUTPUT_SCHEMA.items).toBeDefined();
      expect(OUTLINE_OUTPUT_SCHEMA.items.type).toBe("object");
      expect(OUTLINE_OUTPUT_SCHEMA.items.properties).toHaveProperty("heading");
      expect(OUTLINE_OUTPUT_SCHEMA.items.properties).toHaveProperty("notes");
      expect(OUTLINE_OUTPUT_SCHEMA.items.properties).toHaveProperty(
        "estimatedWords"
      );
    });

    it("should require heading and notes", () => {
      expect(OUTLINE_OUTPUT_SCHEMA.items.required).toContain("heading");
      expect(OUTLINE_OUTPUT_SCHEMA.items.required).toContain("notes");
    });

    it("should not require estimatedWords", () => {
      expect(OUTLINE_OUTPUT_SCHEMA.items.required).not.toContain(
        "estimatedWords"
      );
    });
  });
});
