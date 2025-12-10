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
    console.log("\x1b[32m✓\x1b[0m Summary complete");
    console.log(`  \x1b[90mSession:\x1b[0m ${data.contentId}`);
    console.log(
      `  \x1b[90mSaved to:\x1b[0m ~/.looplia/contentItem/${data.contentId}/summary.json`
    );
    console.log("");
    console.log(
      `\x1b[36mNext step:\x1b[0m looplia kit --session-id ${data.contentId}`
    );
    console.log("");
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
