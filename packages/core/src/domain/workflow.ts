/**
 * Workflow Domain Types (v0.6.0)
 *
 * Defines the structure for workflow definitions using the
 * Workflow-as-Markdown pattern: YAML frontmatter + markdown instructions.
 *
 * v0.6.0 Changes:
 * - `steps:` array replaces `outputs:` object
 * - `run: agents/{name}` replaces `agent:`
 * - `needs:` replaces `requires:`
 * - `output:` replaces `artifact:`
 * - `${{ }}` variable substitution syntax
 *
 * @see docs/DESIGN-0.6.0.md
 */

/**
 * Validation criteria for a workflow step output.
 * Used by the workflow-validator skill to verify artifacts.
 *
 * Extensible: custom keys are allowed for workflow-specific validation.
 */
export type ValidationCriteria = {
  /** Required top-level fields in the output JSON */
  required_fields?: string[];
  /** Minimum number of quotes in output */
  min_quotes?: number;
  /** Minimum number of key points */
  min_key_points?: number;
  /** Minimum outline sections */
  min_outline_sections?: number;
  /** Must have hooks array with at least one item */
  has_hooks?: boolean;
  /** Extensible for custom validators */
  [key: string]: unknown;
};

/**
 * A single step in the workflow (v0.6.0)
 *
 * GitHub Actions-inspired format with explicit ordering.
 */
export type WorkflowStep = {
  /** Unique step identifier */
  id: string;
  /** Action to execute: "agents/{name}" format */
  run: string;
  /** Input file path(s) with ${{ }} variable substitution */
  input: string | string[];
  /** Output file path with ${{ }} variable substitution */
  output: string;
  /** Dependencies - other step IDs that must complete first */
  needs?: string[];
  /** Whether this is the final output of the workflow */
  final?: boolean;
  /** Validation criteria for this step's output */
  validate?: ValidationCriteria;
};

/**
 * Workflow Definition - declarative workflow configuration (v0.6.0)
 *
 * Parsed from YAML frontmatter in ~/.looplia/workflows/{name}.md
 */
export type WorkflowDefinition = {
  /** Workflow name (e.g., "writing-kit") */
  name: string;
  /** Semantic version */
  version?: string;
  /** Human-readable description */
  description: string;
  /** Ordered list of steps (v0.6.0 - replaces outputs) */
  steps: WorkflowStep[];
};

/**
 * Parsed workflow from a .md file
 * Contains both the definition (from frontmatter) and instructions (from body)
 */
export type ParsedWorkflow = {
  /** Definition parsed from YAML frontmatter */
  definition: WorkflowDefinition;
  /** Custom instructions from markdown body */
  instructions: string;
};

/**
 * Validation state for a single step in a workflow session (v0.6.0)
 */
export type StepValidationState = {
  /** Output file path */
  output: string;
  /** Validation criteria from workflow definition */
  validate?: ValidationCriteria;
  /** Whether this step's output has passed validation */
  validated: boolean;
};

/**
 * Validation manifest for a workflow session (v0.6.0)
 *
 * Generated from workflow frontmatter when session starts.
 * Stored in sandbox/{id}/validation.json
 */
export type ValidationManifest = {
  /** Workflow name */
  workflow: string;
  /** Workflow version */
  version?: string;
  /** Sandbox ID */
  sandboxId?: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Validation state for each step (v0.6.0 - replaces outputs) */
  steps: Record<string, StepValidationState>;
};

/**
 * Result of running the validation script
 */
export type ValidationResult = {
  /** Whether all checks passed */
  passed: boolean;
  /** Individual check results */
  checks: ValidationCheck[];
};

/**
 * Single validation check result
 */
export type ValidationCheck = {
  /** Check name (e.g., "has_contentId", "min_quotes") */
  name: string;
  /** Whether this check passed */
  passed: boolean;
  /** Human-readable message */
  message: string;
};

// Legacy type aliases for backwards compatibility
/** @deprecated Use WorkflowStep instead */
export type WorkflowOutput = WorkflowStep;
/** @deprecated Use StepValidationState instead */
export type OutputValidationState = StepValidationState;
