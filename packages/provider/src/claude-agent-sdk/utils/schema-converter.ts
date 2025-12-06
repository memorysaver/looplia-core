import { ContentSummarySchema, WritingIdeasSchema } from "@looplia-core/core";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * JSON Schema for ContentSummary output
 */
export const SUMMARY_OUTPUT_SCHEMA = zodToJsonSchema(ContentSummarySchema, {
  name: "ContentSummary",
  $refStrategy: "none",
});

/**
 * JSON Schema for WritingIdeas output
 */
export const IDEAS_OUTPUT_SCHEMA = zodToJsonSchema(WritingIdeasSchema, {
  name: "WritingIdeas",
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
