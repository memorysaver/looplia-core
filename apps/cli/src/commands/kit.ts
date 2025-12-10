/**
 * Kit Command
 *
 * Build a complete writing kit from content.
 * Target complexity: ≤5
 */

import {
  parseKitArgs,
  printKitHelp,
  validateKitInput,
} from "../parsers/kit-parser";
import { renderKitResult } from "../renderers/kit-renderer";
import { createRuntime } from "../runtime";

/**
 * Run the kit command
 *
 * Parse → Validate → Execute → Render
 */
export async function runKitCommand(args: string[]): Promise<void> {
  const config = parseKitArgs(args);

  if (config.help) {
    printKitHelp();
    return;
  }

  try {
    validateKitInput(config);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    printKitHelp();
    process.exit(1);
  }

  const runtime = createRuntime(config);
  const result = await runtime.executeKit(config);

  renderKitResult(result, config);
}
