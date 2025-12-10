/**
 * Summarize Command
 *
 * Summarize content from a file.
 * Target complexity: ≤5
 */

import {
  parseSummarizeArgs,
  printSummarizeHelp,
  validateSummarizeInput,
} from "../parsers/summarize-parser";
import { renderSummarizeResult } from "../renderers/summarize-renderer";
import { createRuntime } from "../runtime";

/**
 * Run the summarize command
 *
 * Parse → Validate → Execute → Render
 */
export async function runSummarizeCommand(args: string[]): Promise<void> {
  const config = parseSummarizeArgs(args);

  if (config.help) {
    printSummarizeHelp();
    return;
  }

  try {
    validateSummarizeInput(config);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    printSummarizeHelp();
    process.exit(1);
  }

  const runtime = createRuntime(config);
  const result = await runtime.executeSummarize(config);

  renderSummarizeResult(result, config);
}
