/**
 * Summarize Result Renderer
 *
 * Handles output formatting and display for summarize command results.
 * Uses CommandDefinition from core (Clean Architecture).
 * Target complexity: ≤8
 */

import { writeFileSync } from "node:fs";
import type { CommandResult, ContentSummary } from "@looplia-core/core";
import { getCommand } from "@looplia-core/core";
import type { SummarizeConfig } from "../runtime/types";
import { formatSummaryAsMarkdown } from "../utils/format";
import { displayPostCompletion } from "./post-completion";

/**
 * Render summarize execution result
 *
 * Handles success/error cases, output formatting, session info, and file writing.
 */
export function renderSummarizeResult(
  result: CommandResult<ContentSummary>,
  config: SummarizeConfig
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

  // Display post-completion info using command definition from core
  const command = getCommand<ContentSummary>("summarize");
  if (command) {
    displayPostCompletion(command.displayConfig, data.contentId);
  }

  // Format and write output
  const output = formatOutput(data, config.format);
  writeOutput(output, config.outputPath);
}

/**
 * Format result data based on format option
 */
function formatOutput(
  data: ContentSummary,
  format: "json" | "markdown"
): string {
  if (format === "markdown") {
    return formatSummaryAsMarkdown(data);
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Write output to file if path provided
 * (Summary is already saved in contentItem folder by the agent)
 */
function writeOutput(output: string, outputPath: string | undefined): void {
  if (outputPath) {
    writeFileSync(outputPath, output);
    console.log(`Also written to: ${outputPath}`);
  }
  // No stdout dump - summary is already in contentItem folder
}
