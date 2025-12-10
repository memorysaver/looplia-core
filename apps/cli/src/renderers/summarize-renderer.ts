/**
 * Summarize Result Renderer
 *
 * Handles output formatting and display for summarize command results.
 * Target complexity: ≤8
 */

import { writeFileSync } from "node:fs";
import type { ContentSummary } from "@looplia-core/core";
import type { AgenticQueryResult, SummarizeConfig } from "../runtime/types";
import { formatSummaryAsMarkdown } from "../utils/format";

/**
 * Render summarize execution result
 *
 * Handles success/error cases, output formatting, session info, and file writing.
 */
export function renderSummarizeResult(
  result: AgenticQueryResult<ContentSummary>,
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

  // Display session info
  displaySessionInfo(data);

  // Format and write output
  const output = formatOutput(data, config.format);
  writeOutput(output, config.outputPath);
}

/**
 * Display session information and next steps
 */
function displaySessionInfo(data: ContentSummary): void {
  console.log("");
  if (data.contentId) {
    console.log(`Session ID: ${data.contentId}`);
    console.log(`Saved to: ~/.looplia/contentItem/${data.contentId}/\n`);
    console.log(`Next step: looplia kit --session-id ${data.contentId}\n`);
  }
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
 * Write output to file or stdout
 */
function writeOutput(output: string, outputPath: string | undefined): void {
  if (outputPath) {
    writeFileSync(outputPath, output);
    console.log(`Summary written to: ${outputPath}`);
  } else {
    console.log(output);
  }
}
