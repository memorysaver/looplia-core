import { ContentSummarySchema, WritingIdeasSchema } from "@looplia-core/core";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * JSON Schema for ContentSummary output
 * Uses openApi3 target to get inline schema without $ref (required by Claude API)
 */
export const SUMMARY_OUTPUT_SCHEMA = zodToJsonSchema(ContentSummarySchema, {
  target: "openApi3",
  $refStrategy: "none",
});

/**
 * JSON Schema for WritingIdeas output
 * Uses openApi3 target to get inline schema without $ref (required by Claude API)
 */
export const IDEAS_OUTPUT_SCHEMA = zodToJsonSchema(WritingIdeasSchema, {
  target: "openApi3",
  $refStrategy: "none",
});

/**
 * JSON Schema for OutlineSection[] output
 * Wrapped in object because Claude API requires top-level type: "object"
 */
export const OUTLINE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: {
            type: "string",
            description: "Clear, descriptive section title",
          },
          notes: {
            type: "string",
            description: "Key points to cover in this section",
          },
          estimatedWords: {
            type: "number",
            description: "Approximate word count for this section",
          },
        },
        required: ["heading", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
} as const;

/**
 * JSON Schema for complete WritingKit response (v0.3.1 agentic architecture)
 *
 * This schema is for the SDK response containing summary, ideas, and outline.
 * The contentId, source, and meta fields are added by the kit-builder after the call.
 */
export const WRITING_KIT_SCHEMA = {
  type: "object",
  properties: {
    summary: SUMMARY_OUTPUT_SCHEMA,
    ideas: IDEAS_OUTPUT_SCHEMA,
    suggestedOutline: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: {
            type: "string",
            description: "Clear, descriptive section title",
          },
          notes: {
            type: "string",
            description: "Key points to cover in this section",
          },
          estimatedWords: {
            type: "number",
            description: "Approximate word count for this section",
          },
        },
        required: ["heading", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "ideas", "suggestedOutline"],
  additionalProperties: false,
} as const;
