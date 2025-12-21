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
// Workflow Schemas (v0.6.0)
// ─────────────────────────────────────────────────────────────

/**
 * Validation criteria for workflow step outputs
 * Extensible with custom keys via passthrough()
 */
export const ValidationCriteriaSchema = z
  .object({
    required_fields: z.array(z.string()).optional(),
    min_quotes: z.number().int().positive().optional(),
    min_key_points: z.number().int().positive().optional(),
    min_outline_sections: z.number().int().positive().optional(),
    has_hooks: z.boolean().optional(),
  })
  .passthrough();

/**
 * Single step in a workflow definition (v0.6.0)
 * GitHub Actions-inspired format with explicit ordering
 */
export const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  run: z.string().min(1),
  input: z.union([z.string(), z.array(z.string())]),
  output: z.string().min(1),
  needs: z.array(z.string()).optional(),
  final: z.boolean().optional(),
  validate: ValidationCriteriaSchema.optional(),
});

/**
 * Complete workflow definition from YAML frontmatter (v0.6.0)
 */
export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  description: z.string().min(1),
  steps: z.array(WorkflowStepSchema),
});

/**
 * Validation state for a single step (v0.6.0)
 */
export const StepValidationStateSchema = z.object({
  output: z.string().min(1),
  validate: ValidationCriteriaSchema.optional(),
  validated: z.boolean(),
});

/**
 * Validation manifest stored in sandbox/{id}/validation.json (v0.6.0)
 */
export const ValidationManifestSchema = z.object({
  workflow: z.string().min(1),
  version: z.string().optional(),
  sandboxId: z.string().optional(),
  createdAt: z.string().optional(),
  steps: z.record(z.string(), StepValidationStateSchema),
});

/**
 * Single validation check result
 */
export const ValidationCheckSchema = z.object({
  name: z.string().min(1),
  passed: z.boolean(),
  message: z.string(),
});

/**
 * Result from validation script
 */
export const ValidationResultSchema = z.object({
  passed: z.boolean(),
  checks: z.array(ValidationCheckSchema),
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

// ─────────────────────────────────────────────────────────────
// Workflow Validation Helpers (v0.6.0)
// ─────────────────────────────────────────────────────────────

export function validateWorkflowDefinition(
  data: unknown
): ValidationResult<z.infer<typeof WorkflowDefinitionSchema>> {
  const result = WorkflowDefinitionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validateValidationManifest(
  data: unknown
): ValidationResult<z.infer<typeof ValidationManifestSchema>> {
  const result = ValidationManifestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validateValidationResult(
  data: unknown
): ValidationResult<z.infer<typeof ValidationResultSchema>> {
  const result = ValidationResultSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}
