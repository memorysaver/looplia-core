import { writeFileSync } from "node:fs";
import {
  createMockSummarizer,
  summarizeContent,
  validateContentItem,
} from "@looplia-core/core";
import { createClaudeSummarizer } from "@looplia-core/provider/claude-agent-sdk";
import {
  createContentItemFromFile,
  formatSummaryAsMarkdown,
  getArg,
  hasFlag,
  parseArgs,
  readContentFile,
} from "../utils";

function printSummarizeHelp(): void {
  console.log(`
looplia summarize - Summarize content from a file

Usage:
  looplia summarize --file <path> [options]

Options:
  --file, -f    Path to content file (required)
  --format      Output format: json, markdown (default: json)
  --output, -o  Output file path (default: stdout)
  --mock, -m    Use mock provider (no API key required)
  --help, -h    Show this help

Environment:
  ANTHROPIC_API_KEY  Required unless --mock is specified

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
  const useMock = hasFlag(parsed, "mock", "m");

  // Check for API key unless using mock provider
  if (!(useMock || process.env.ANTHROPIC_API_KEY)) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    console.error("Get your API key from: https://console.anthropic.com");
    console.error("Or use --mock flag to run without API key");
    process.exit(1);
  }

  // Read content file using shared utility
  const rawText = readContentFile(filePath);

  // Create content item using shared utility
  const content = createContentItemFromFile(filePath, rawText);

  // Validate input at boundary
  const validation = validateContentItem(content);
  if (!validation.success) {
    console.error(`Validation error: ${validation.error.message}`);
    process.exit(1);
  }

  // Create provider based on --mock flag
  const provider = useMock ? createMockSummarizer() : createClaudeSummarizer();
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
