/**
 * Kit Result Renderer
 *
 * Handles output formatting and display for kit command results.
 * Clean Architecture: Uses DisplayConfig from CLI layer.
 * Target complexity: ≤8
 */

import { writeFileSync } from "node:fs";
import type { CommandResult, WritingKit } from "@looplia-core/core";
import { getDisplayConfig } from "../config/display-config";
import type { KitConfig } from "../runtime/types";
import { formatKitAsMarkdown } from "../utils/format";
import { displayPostCompletion } from "./post-completion";

/**
 * Render kit execution result
 *
 * Handles success/error cases, output formatting, and file writing.
 */
export function renderKitResult(
  result: CommandResult<WritingKit>,
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

  // Display post-completion info using CLI display config
  const displayConfig = getDisplayConfig("kit");
  if (displayConfig) {
    displayPostCompletion(displayConfig, data.contentId);
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
    console.log(`Writing kit saved to: ${outputPath}`);
  } else {
    console.log(output);
  }
}
