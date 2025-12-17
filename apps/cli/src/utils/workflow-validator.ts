/**
 * Workflow Validator (v0.5.1)
 *
 * Validates workflow files before execution.
 *
 * Current validation:
 * - File exists
 * - Valid YAML frontmatter structure
 * - Required fields (name, description, outputs)
 *
 * Future validation (TODO):
 * - Referenced agents exist in .claude/agents/
 * - Referenced skills exist in .claude/skills/
 * - Dependency graph is valid (no missing deps)
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowDefinition } from "@looplia-core/core";
import { parseWorkflow } from "@looplia-core/core";

/**
 * Validation error with structured information
 */
export type WorkflowValidationError = {
  code:
    | "NOT_FOUND"
    | "PARSE_ERROR"
    | "INVALID_STRUCTURE"
    | "MISSING_AGENT"
    | "MISSING_SKILL";
  message: string;
  details?: string;
};

/**
 * Result of workflow validation
 */
export type WorkflowValidationResult =
  | { valid: true; definition: WorkflowDefinition; instructions: string }
  | { valid: false; error: WorkflowValidationError };

/**
 * Validate a workflow file
 *
 * @param workflowId - Workflow ID (e.g., "writing-kit")
 * @param workspace - Workspace root path (e.g., ~/.looplia)
 * @returns Validation result with definition or error
 */
export function validateWorkflow(
  workflowId: string,
  workspace: string
): WorkflowValidationResult {
  const workflowPath = join(workspace, "workflows", `${workflowId}.md`);

  // Check file exists
  if (!existsSync(workflowPath)) {
    return {
      valid: false,
      error: {
        code: "NOT_FOUND",
        message: `Workflow not found: ${workflowId}`,
        details: `Expected file at: ${workflowPath}`,
      },
    };
  }

  // Read and parse workflow
  let content: string;
  try {
    content = readFileSync(workflowPath, "utf-8");
  } catch (err) {
    return {
      valid: false,
      error: {
        code: "NOT_FOUND",
        message: `Failed to read workflow: ${workflowId}`,
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Parse workflow (validates structure)
  try {
    const { definition, instructions } = parseWorkflow(content);
    return { valid: true, definition, instructions };
  } catch (err) {
    return {
      valid: false,
      error: {
        code: "PARSE_ERROR",
        message: `Invalid workflow: ${workflowId}`,
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * List available workflows in a workspace
 *
 * @param workspace - Workspace root path
 * @returns Array of workflow IDs (without .md extension)
 */
export function listWorkflows(workspace: string): string[] {
  const workflowsDir = join(workspace, "workflows");

  if (!existsSync(workflowsDir)) {
    return [];
  }

  const files = readdirSync(workflowsDir);

  return files.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)); // Remove .md extension
}

/**
 * Check if a workflow exists
 *
 * @param workflowId - Workflow ID
 * @param workspace - Workspace root path
 * @returns true if workflow file exists
 */
export function workflowExists(workflowId: string, workspace: string): boolean {
  const workflowPath = join(workspace, "workflows", `${workflowId}.md`);
  return existsSync(workflowPath);
}
