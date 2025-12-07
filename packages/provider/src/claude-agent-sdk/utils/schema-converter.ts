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
 * JSON Schema for complete WritingKit output (v0.3.1 single-call approach)
 *
 * Combines summary, ideas, and outline into a single schema for the
 * agentic writing kit builder.
 */
export const WRITING_KIT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    contentId: {
      type: "string",
      description: "Reference to source content",
    },
    source: {
      type: "object",
      properties: {
        id: { type: "string" },
        label: { type: "string" },
        url: { type: "string" },
      },
      required: ["id", "label", "url"],
      additionalProperties: false,
    },
    summary: {
      type: "object",
      properties: {
        contentId: { type: "string" },
        headline: { type: "string", minLength: 10, maxLength: 200 },
        tldr: { type: "string", minLength: 20, maxLength: 500 },
        bullets: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 10,
        },
        tags: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 20,
        },
        sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
        category: { type: "string" },
        score: {
          type: "object",
          properties: {
            relevanceToUser: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["relevanceToUser"],
          additionalProperties: false,
        },
        overview: { type: "string", minLength: 50 },
        keyThemes: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 7,
        },
        detailedAnalysis: { type: "string", minLength: 100 },
        narrativeFlow: { type: "string", minLength: 50 },
        coreIdeas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              concept: { type: "string" },
              explanation: { type: "string", minLength: 10 },
              examples: { type: "array", items: { type: "string" } },
            },
            required: ["concept", "explanation"],
            additionalProperties: false,
          },
          minItems: 1,
          maxItems: 10,
        },
        importantQuotes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              timestamp: { type: "string" },
              context: { type: "string" },
            },
            required: ["text"],
            additionalProperties: false,
          },
          minItems: 0,
          maxItems: 20,
        },
        context: { type: "string", minLength: 20 },
        relatedConcepts: {
          type: "array",
          items: { type: "string" },
          minItems: 0,
          maxItems: 15,
        },
      },
      required: [
        "contentId",
        "headline",
        "tldr",
        "bullets",
        "tags",
        "sentiment",
        "category",
        "score",
        "overview",
        "keyThemes",
        "detailedAnalysis",
        "narrativeFlow",
        "coreIdeas",
        "importantQuotes",
        "context",
        "relatedConcepts",
      ],
      additionalProperties: false,
    },
    ideas: {
      type: "object",
      properties: {
        contentId: { type: "string" },
        hooks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string", minLength: 5 },
              type: {
                type: "string",
                enum: ["emotional", "curiosity", "controversy", "statistic", "story"],
              },
            },
            required: ["text", "type"],
            additionalProperties: false,
          },
          minItems: 1,
          maxItems: 5,
        },
        angles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 3, maxLength: 100 },
              description: { type: "string", minLength: 10 },
              relevanceScore: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["title", "description", "relevanceScore"],
            additionalProperties: false,
          },
          minItems: 1,
          maxItems: 5,
        },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string", minLength: 10 },
              type: {
                type: "string",
                enum: ["analytical", "practical", "philosophical", "comparative"],
              },
            },
            required: ["question", "type"],
            additionalProperties: false,
          },
          minItems: 1,
          maxItems: 5,
        },
      },
      required: ["contentId", "hooks", "angles", "questions"],
      additionalProperties: false,
    },
    suggestedOutline: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          notes: { type: "string" },
          estimatedWords: { type: "number" },
        },
        required: ["heading", "notes"],
        additionalProperties: false,
      },
    },
    meta: {
      type: "object",
      properties: {
        relevanceToUser: { type: "number", minimum: 0, maximum: 1 },
        estimatedReadingTimeMinutes: { type: "number", minimum: 1 },
      },
      required: ["relevanceToUser", "estimatedReadingTimeMinutes"],
      additionalProperties: false,
    },
  },
  required: ["contentId", "source", "summary", "ideas", "suggestedOutline", "meta"],
  additionalProperties: false,
} as const;
