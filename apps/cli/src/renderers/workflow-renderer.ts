/**
 * Generic Workflow Renderer (v0.5.1)
 *
 * Renders workflow results to stdout as JSON.
 * Handles output file writing if specified.
 */

import { writeFileSync } from "node:fs";
import type { CommandResult } from "@looplia-core/core";

type WorkflowOutputConfig = {
  output?: string;
  workflowId: string;
};

/**
 * Render workflow result to stdout
 *
 * - Success: Output JSON to stdout
 * - Error: Output error message to stderr and exit with code 1
 * - If --output specified, write to file and log path to stderr
 */
export function renderWorkflowResult(
  result: CommandResult<unknown>,
  config: WorkflowOutputConfig
): void {
  if (!result.success) {
    console.error(`Error: ${result.error?.message ?? "Unknown error"}`);
    process.exit(1);
  }

  const json = JSON.stringify(result.data, null, 2);

  // Output JSON to stdout
  console.log(json);

  // If --output specified, write to file
  if (config.output) {
    writeFileSync(config.output, json);
    console.error(`Output saved to: ${config.output}`);
  }
}
