/**
 * Run Command (v0.5.1)
 *
 * Execute a workflow on content.
 * Supports: looplia run <workflow-id> --file <path>
 *
 * Target complexity: ≤5
 */

import {
  parseWorkflowArgs,
  printWorkflowHelp,
  validateWorkflowInput,
} from "../parsers/workflow-parser";
import { renderWorkflowResult } from "../renderers/workflow-renderer";
import { createRuntime } from "../runtime";

/**
 * Run the workflow command
 *
 * Parse → Validate → Execute → Render
 */
export async function runRunCommand(args: string[]): Promise<void> {
  const config = parseWorkflowArgs(args);

  if (config.help) {
    printWorkflowHelp();
    return;
  }

  try {
    validateWorkflowInput(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    printWorkflowHelp();
    process.exit(1);
  }

  try {
    const runtime = createRuntime(config);
    const result = await runtime.executeWorkflow(config);
    renderWorkflowResult(result, {
      output: config.outputPath,
      workflowId: config.workflowId ?? "unknown",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
