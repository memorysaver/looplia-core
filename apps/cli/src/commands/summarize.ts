import { readFileSync, writeFileSync } from "node:fs";
import {
  createMockSummarizer,
  summarizeContent,
  validateContentItem,
  type ContentItem,
} from "@looplia-core/core";
import { parseArgs, getArg, hasFlag, formatSummaryAsMarkdown } from "../utils";

function printSummarizeHelp(): void {
  console.log(`
looplia summarize - Summarize content from a file

Usage:
  looplia summarize --file <path> [options]

Options:
  --file, -f    Path to content file (required)
  --format      Output format: json, markdown (default: json)
  --output, -o  Output file path (default: stdout)
  --help, -h    Show this help

Example:
  looplia summarize --file ./article.txt --format markdown
`);
}

export async function runSummarizeCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (hasFlag(parsed, "help", "h")) {
    printSummarizeHelp();
    return;
  }

  const filePath = getArg(parsed, "file", "f");
  if (!filePath) {
    console.error("Error: --file is required");
    printSummarizeHelp();
    process.exit(1);
  }

  const format = getArg(parsed, "format") ?? "json";
  const outputPath = getArg(parsed, "output", "o");

  // Read content file
  let rawText: string;
  try {
    rawText = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Error: Could not read file: ${filePath}`);
    process.exit(1);
  }

  // Create content item
  const content: ContentItem = {
    id: `cli-${Date.now()}`,
    title: filePath.split("/").pop() ?? "Untitled",
    url: `file://${filePath}`,
    rawText,
    source: {
      id: "cli",
      type: "custom",
      url: `file://${filePath}`,
      label: "CLI Input",
    },
    metadata: {},
  };

  // Validate input at boundary
  const validation = validateContentItem(content);
  if (!validation.success) {
    console.error(`Validation error: ${validation.error.message}`);
    process.exit(1);
  }

  // Summarize using mock provider
  const provider = createMockSummarizer();
  const result = await summarizeContent(validation.data, undefined, provider);

  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }

  // Format output
  let output: string;
  if (format === "markdown") {
    output = formatSummaryAsMarkdown(result.data);
  } else {
    output = JSON.stringify(result.data, null, 2);
  }

  // Write output
  if (outputPath) {
    writeFileSync(outputPath, output);
    console.log(`Summary written to: ${outputPath}`);
  } else {
    console.log(output);
  }
}
