/**
 * Agent Utilities (v0.6.0)
 *
 * Deterministic utilities for working with agent references in workflows.
 * The run field in workflow steps follows the format: agents/{name}
 *
 * @see docs/DESIGN-0.6.0.md
 */

/**
 * Pattern for validating run field format.
 * Expects: agents/{name} where name is lowercase alphanumeric with hyphens.
 * Examples: "agents/content-analyzer", "agents/idea-generator"
 */
const RUN_PATTERN = /^agents\/([a-z][a-z0-9-]*)$/;

/**
 * Extract agent name from a workflow step's run field.
 *
 * This is a deterministic utility for mapping workflow step definitions
 * to Claude Code subagent_type values.
 *
 * @param run - The run field value (e.g., "agents/content-analyzer")
 * @returns The agent name (e.g., "content-analyzer") or null if invalid format
 *
 * @example
 * extractAgentName("agents/content-analyzer") // "content-analyzer"
 * extractAgentName("agents/idea-generator")   // "idea-generator"
 * extractAgentName("invalid")                  // null
 */
export function extractAgentName(run: string): string | null {
  const match = run.match(RUN_PATTERN);
  return match?.[1] ?? null;
}

/**
 * Validate that a run field follows the correct format.
 *
 * @param run - The run field value
 * @returns true if valid agents/{name} format, false otherwise
 *
 * @example
 * isValidRunFormat("agents/content-analyzer") // true
 * isValidRunFormat("agents/MyAgent")          // false (uppercase)
 * isValidRunFormat("something-else")          // false (wrong prefix)
 */
export function isValidRunFormat(run: string): boolean {
  return RUN_PATTERN.test(run);
}

/**
 * Get the run pattern regex for external validation use.
 * Useful for Zod schemas or other validation frameworks.
 */
export const RUN_FORMAT_PATTERN = RUN_PATTERN;
