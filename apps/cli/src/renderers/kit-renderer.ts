/**
 * Kit Result Renderer
 *
 * Handles output formatting and display for kit command results.
 * Target complexity: ≤8
 */

import { writeFileSync } from "node:fs";
import type { WritingKit } from "@looplia-core/core";
import type { AgenticQueryResult, KitConfig } from "../runtime/types";
import { formatKitAsMarkdown } from "../utils/format";

/**
 * Render kit execution result
 *
 * Handles success/error cases, output formatting, and file writing.
 */
export function renderKitResult(
  result: AgenticQueryResult<WritingKit>,
  config: KitConfig
): void {
  if (!result.success) {
    console.error(`Error: ${result.error?.message ?? "Unknown error"}`);
    process.exit(1);
  }

  const data = result.data;
  if (!data) {
    console.error("Error: No data in result");
    process.exit(1);
  }

  const output = formatOutput(data, config.format);
  writeOutput(output, config.outputPath);
}

/**
 * Format result data based on format option
 */
function formatOutput(data: WritingKit, format: "json" | "markdown"): string {
  if (format === "markdown") {
    return formatKitAsMarkdown(data);
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Write output to file or stdout
 */
function writeOutput(output: string, outputPath: string | undefined): void {
  if (outputPath) {
    writeFileSync(outputPath, output);
    console.log(`Writing kit written to: ${outputPath}`);
  } else {
    console.log(output);
  }
}
