/**
 * Workflow Domain Types (v0.6.3)
 *
 * Defines the structure for workflow definitions using the
 * Workflow-as-Markdown pattern: YAML frontmatter + markdown instructions.
 *
 * v0.6.3 Changes:
 * - `inputs:` declaration for named workflow inputs (0 to N)
 * - `input` field now optional for input-less capable skills
 * - `${{ inputs.name }}` variable substitution
 *
 * v0.6.1 Changes:
 * - `skill:` + `mission:` replaces `run: agents/{name}` (skills-first)
 * - Universal skill-executor replaces custom subagent types
 *
 * v0.6.0 Changes:
 * - `steps:` array replaces `outputs:` object
 * - `run: agents/{name}` replaces `agent:`
 * - `needs:` replaces `requires:`
 * - `output:` replaces `artifact:`
 * - `${{ }}` variable substitution syntax
 *
 * @see docs/DESIGN-0.6.3.md
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
 * Declares an expected input for the workflow (v0.6.3)
 *
 * Enables workflows to accept 0, 1, or N named inputs.
 * Referenced in steps using `${{ inputs.name }}` syntax.
 */
export type WorkflowInput = {
  /** Unique identifier (kebab-case, e.g., "video-transcript") */
  name: string;
  /** Is this input mandatory? */
  required: boolean;
  /** Human-readable description */
  description?: string;
  /** Type hint: 'file' for file paths, 'json' for inline JSON */
  type?: "file" | "json";
};

/**
 * A single step in the workflow (v0.6.3)
 *
 * GitHub Actions-inspired format with explicit ordering.
 *
 * v0.6.3: `input` now optional for input-less capable skills (e.g., search)
 * v0.6.1: Uses `skill` + `mission` (skills-first architecture)
 * v0.6.0: Uses `run: agents/{name}` (legacy, deprecated)
 *
 * One of `skill` or `run` must be provided (mutually exclusive).
 */
export type WorkflowStep = {
  /** Unique step identifier */
  id: string;
  /** v0.6.1: Skill to invoke (e.g., "media-reviewer", "idea-synthesis") */
  skill?: string;
  /** v0.6.1: Mission description - what this step should accomplish */
  mission?: string;
  /** v0.6.0 (deprecated): Action to execute in "agents/{name}" format */
  run?: string;
  /**
   * Input file path(s) with ${{ }} variable substitution.
   * v0.6.3: Optional for input-less capable skills (e.g., search).
   * Can reference named inputs via ${{ inputs.name }}
   */
  input?: string | string[];
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
 * Workflow Definition - declarative workflow configuration (v0.7.0)
 *
 * Parsed from YAML frontmatter in ~/.looplia/workflows/{name}.md
 *
 * v0.7.0: Added `skills` for explicit skill requirements (selective loading)
 * v0.6.3: Added `inputs` for named workflow inputs (0 to N)
 */
export type WorkflowDefinition = {
  /** Workflow name (e.g., "writing-kit") */
  name: string;
  /** Semantic version */
  version?: string;
  /** Human-readable description */
  description: string;
  /**
   * v0.7.0: Explicit skills declaration.
   * Lists all skills required to run this workflow.
   * Used for selective plugin loading at runtime.
   */
  skills?: string[];
  /**
   * v0.6.3: Named inputs declaration.
   * Enables workflows to accept 0, 1, or N inputs.
   * Referenced in steps via ${{ inputs.name }}
   */
  inputs?: WorkflowInput[];
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
  /** Final step ID for artifact extraction */
  finalStepId?: string;
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
