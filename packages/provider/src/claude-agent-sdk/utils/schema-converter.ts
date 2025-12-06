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
 */
export const OUTLINE_OUTPUT_SCHEMA = {
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
} as const;
