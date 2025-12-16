import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Content Schemas
// ─────────────────────────────────────────────────────────────

export const SourceTypeSchema = z.enum([
  "rss",
  "youtube",
  "podcast",
  "twitter",
  "custom",
]);

export const SourceSchema = z.object({
  id: z.string().min(1),
  type: SourceTypeSchema,
  label: z.string().optional(),
  url: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const ContentMetadataSchema = z
  .object({
    language: z.string().length(2).optional(),
    durationSeconds: z.number().positive().optional(),
    author: z.string().optional(),
    wordCount: z.number().positive().optional(),
  })
  .passthrough();

export const ContentItemSchema = z.object({
  id: z.string().min(1),
  source: SourceSchema,
  title: z.string().min(1),
  url: z.string(),
  publishedAt: z.string().optional(),
  rawText: z.string().min(1),
  metadata: ContentMetadataSchema,
});

// ─────────────────────────────────────────────────────────────
// Summary Schemas
// ─────────────────────────────────────────────────────────────

export const CoreIdeaSchema = z.object({
  concept: z.string().min(1),
  explanation: z.string().min(10),
  examples: z.array(z.string()).optional(),
});

export const QuoteSchema = z.object({
  text: z.string().min(1),
  // Optional but must be HH:MM:SS or MM:SS when present (no normalization applied)
  timestamp: z
    .string()
    .regex(/^(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})$/, {
      message: "Use HH:MM:SS or MM:SS",
    })
    .optional(),
  context: z.string().optional(),
});

export const SummaryScoreSchema = z.object({
  relevanceToUser: z.number().min(0).max(1),
});

export const ContentSummarySchema = z.object({
  contentId: z.string().min(1),

  // Core fields
  headline: z.string().min(10).max(200),
  tldr: z.string().min(20).max(500),
  bullets: z.array(z.string()).min(1).max(10),
  tags: z.array(z.string()).min(1).max(20),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  category: z.string(),
  score: SummaryScoreSchema,

  // Enhanced fields (v0.3)
  overview: z.string().min(50),
  keyThemes: z.array(z.string()).min(3).max(7),
  detailedAnalysis: z.string().min(100),
  narrativeFlow: z.string().min(50),
  coreIdeas: z.array(CoreIdeaSchema).min(1).max(10),
  importantQuotes: z.array(QuoteSchema).min(0).max(20),
  context: z.string().min(20),
  relatedConcepts: z.array(z.string()).min(0).max(15),

  // Detection fields (source type detection)
  detectedSource: z
    .enum([
      "podcast",
      "transcript",
      "article",
      "youtube",
      "twitter",
      "text",
      "other",
    ])
    .optional(),
});

// ─────────────────────────────────────────────────────────────
// Ideas Schemas
// ─────────────────────────────────────────────────────────────

export const WritingHookSchema = z.object({
  text: z.string().min(5),
  type: z.enum(["emotional", "curiosity", "controversy", "statistic", "story"]),
});

export const WritingAngleSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  relevanceScore: z.number().min(0).max(1),
});

export const WritingQuestionSchema = z.object({
  question: z.string().min(10),
  type: z.enum(["analytical", "practical", "philosophical", "comparative"]),
});

export const WritingIdeasSchema = z.object({
  contentId: z.string().min(1),
  hooks: z.array(WritingHookSchema).min(1).max(5),
  angles: z.array(WritingAngleSchema).min(1).max(5),
  questions: z.array(WritingQuestionSchema).min(1).max(5),
});

// ─────────────────────────────────────────────────────────────
// Writing Kit Schemas
// ─────────────────────────────────────────────────────────────

export const WritingKitSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  url: z.string(),
});

export const OutlineSectionSchema = z.object({
  heading: z.string().min(1),
  notes: z.string(),
  estimatedWords: z.number().positive().optional(),
});

export const WritingKitMetaSchema = z.object({
  relevanceToUser: z.number().min(0).max(1),
  estimatedReadingTimeMinutes: z.number().positive(),
});

export const WritingKitSchema = z.object({
  contentId: z.string().min(1),
  source: WritingKitSourceSchema,
  summary: ContentSummarySchema,
  ideas: WritingIdeasSchema,
  suggestedOutline: z.array(OutlineSectionSchema).min(1),
  meta: WritingKitMetaSchema,
});

// ─────────────────────────────────────────────────────────────
// Pipeline Schemas
// ─────────────────────────────────────────────────────────────

export const PipelineOutputSchema = z.object({
  artifact: z.string().min(1),
  agent: z.string().min(1),
  requires: z.array(z.string()).optional(),
  final: z.boolean().optional(),
});

export const PipelineDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  outputs: z.record(z.string(), PipelineOutputSchema),
});

// ─────────────────────────────────────────────────────────────
// Session Manifest Schemas
// ─────────────────────────────────────────────────────────────

export const SessionManifestSchema = z.object({
  version: z.literal(1),
  contentId: z.string().min(1),
  pipeline: z.string().min(1),
  desiredOutput: z.string().min(1),
  updatedAt: z.string(),
  steps: z.record(z.string(), z.literal("done")),
});

// ─────────────────────────────────────────────────────────────
// User Profile Schemas
// ─────────────────────────────────────────────────────────────

export const UserTopicSchema = z.object({
  topic: z.string().min(1),
  interestLevel: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

export const WritingStyleSchema = z.object({
  tone: z.enum(["beginner", "intermediate", "expert", "mixed"]),
  targetWordCount: z.number().min(100).max(10_000),
  voice: z.enum(["first-person", "third-person", "instructional"]),
});

export const UserProfileSchema = z.object({
  userId: z.string().min(1),
  topics: z.array(UserTopicSchema),
  style: WritingStyleSchema,
  writingSamples: z.array(z.string()).optional(),
});

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

export function validateContentItem(
  data: unknown
): ValidationResult<z.infer<typeof ContentItemSchema>> {
  const result = ContentItemSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validateContentSummary(
  data: unknown
): ValidationResult<z.infer<typeof ContentSummarySchema>> {
  const result = ContentSummarySchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validateWritingIdeas(
  data: unknown
): ValidationResult<z.infer<typeof WritingIdeasSchema>> {
  const result = WritingIdeasSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validateUserProfile(
  data: unknown
): ValidationResult<z.infer<typeof UserProfileSchema>> {
  const result = UserProfileSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validateSessionManifest(
  data: unknown
): ValidationResult<z.infer<typeof SessionManifestSchema>> {
  const result = SessionManifestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validatePipelineDefinition(
  data: unknown
): ValidationResult<z.infer<typeof PipelineDefinitionSchema>> {
  const result = PipelineDefinitionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validatePipelineOutput(
  data: unknown
): ValidationResult<z.infer<typeof PipelineOutputSchema>> {
  const result = PipelineOutputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}
