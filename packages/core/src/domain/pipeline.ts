/**
 * Pipeline Domain Types
 *
 * Defines the structure for declarative workflow definitions.
 * Pipelines are YAML files that specify outputs, dependencies, and agents.
 *
 * @see docs/DESIGN-0.5.0.md
 */

/**
 * A single output step in the pipeline
 */
export type PipelineOutput = {
  /** Artifact filename (e.g., "summary.json") */
  artifact: string;
  /** Agent to invoke for this step */
  agent: string;
  /** Dependencies - other output names that must complete first */
  requires?: string[];
  /** Whether this is the final output of the pipeline */
  final?: boolean;
};

/**
 * Pipeline Definition - declarative workflow configuration
 *
 * Stored as YAML in ~/.looplia/pipelines/{name}.yaml
 */
export type PipelineDefinition = {
  /** Pipeline name (e.g., "writing-kit") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Output steps keyed by output name */
  outputs: Record<string, PipelineOutput>;
};
