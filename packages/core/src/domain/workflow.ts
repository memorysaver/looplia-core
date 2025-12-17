/**
 * Workflow Domain Types (v0.5.1)
 *
 * Defines the structure for workflow definitions using the
 * Workflow-as-Markdown pattern: YAML frontmatter + markdown instructions.
 *
 * Replaces Pipeline types from v0.5.0.
 *
 * @see docs/DESIGN-0.5.1.md
 */

/**
 * Validation criteria for a workflow output.
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
 * A single output step in the workflow
 */
export type WorkflowOutput = {
  /** Artifact filename (e.g., "summary.json") */
  artifact: string;
  /** Agent to invoke for this step */
  agent: string;
  /** Dependencies - other output names that must complete first */
  requires?: string[];
  /** Whether this is the final output of the workflow */
  final?: boolean;
  /** Validation criteria for this output */
  validate?: ValidationCriteria;
};

/**
 * Workflow Definition - declarative workflow configuration
 *
 * Parsed from YAML frontmatter in ~/.looplia/workflows/{name}.md
 */
export type WorkflowDefinition = {
  /** Workflow name (e.g., "writing-kit") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Output steps keyed by output name */
  outputs: Record<string, WorkflowOutput>;
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
 * Validation state for a single output in a workflow session
 */
export type OutputValidationState = {
  /** Artifact filename */
  artifact: string;
  /** Validation criteria from workflow definition */
  criteria: ValidationCriteria;
  /** Whether this output has passed validation */
  validated: boolean;
};

/**
 * Validation manifest for a workflow session
 *
 * Generated from workflow frontmatter when session starts.
 * Stored in contentItem/{id}/validation.json
 */
export type ValidationManifest = {
  /** Workflow name */
  workflow: string;
  /** Validation state for each output */
  outputs: Record<string, OutputValidationState>;
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
