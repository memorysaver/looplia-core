import { writeFileSync } from "node:fs";
import type { ContentSummary } from "@looplia-core/core";
import {
  createMockSummarizer,
  summarizeContent,
  validateContentItem,
} from "@looplia-core/core";
import { createClaudeSummarizer } from "@looplia-core/provider/claude-agent-sdk";
import { renderStreamingQuery } from "../components/index.js";
import {
  createContentItemFromFile,
  formatSummaryAsMarkdown,
  getArg,
  hasFlag,
  parseArgs,
  readContentFile,
} from "../utils/index.js";
import { isInteractive } from "../utils/terminal.js";

function printSummarizeHelp(): void {
  console.log(`
looplia summarize - Summarize content from a file

Usage:
  looplia summarize --file <path> [options]

Options:
  --file, -f       Path to content file (required)
  --format         Output format: json, markdown (default: json)
  --output, -o     Output file path (default: stdout)
  --no-streaming   Disable streaming UI (use legacy output)
  --mock, -m       Use mock provider (no API key required)
  --help, -h       Show this help

Note: Streaming UI is disabled automatically when piping output

Environment:
  ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN  Required unless --mock is specified

Example:
  looplia summarize --file ./article.txt --format markdown
  looplia summarize --file ./notes.md --no-streaming | jq .headline
`);
}

function writeOutput(
  result: ContentSummary,
  format: string,
  outputPath: string | undefined
): void {
  const output =
    format === "markdown"
      ? formatSummaryAsMarkdown(result)
      : JSON.stringify(result, null, 2);

  if (outputPath) {
    writeFileSync(outputPath, output);
    console.log(`Summary written to: ${outputPath}`);
  } else {
    console.log(output);
  }
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
  const noStreaming = hasFlag(parsed, "no-streaming");

  // Check for API key unless using mock provider
  if (
    !(
      useMock ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.CLAUDE_CODE_OAUTH_TOKEN
    )
  ) {
    console.error(
      "Error: ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable is required"
    );
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

  const validatedContent = validation.data;

  // Determine if we should use streaming UI
  const useStreamingUI = isInteractive() && !noStreaming && !useMock;

  if (useStreamingUI) {
    // Use streaming UI with real-time progress
    const provider = createClaudeSummarizer();

    const { result, error } = await renderStreamingQuery<ContentSummary>({
      title: "Content Summarizer",
      subtitle: validatedContent.title,
      streamGenerator: () => provider.summarizeStreaming(validatedContent),
    });

    if (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }

    if (result) {
      // Display next steps
      console.log("");
      if (result.contentId) {
        console.log(`Session ID: ${result.contentId}`);
        console.log(`Saved to: ~/.looplia/contentItem/${result.contentId}/\n`);
        console.log(
          `Next step: looplia kit --session-id ${result.contentId}\n`
        );
      }

      writeOutput(result, format, outputPath);
    }
  } else {
    // Legacy non-streaming mode
    console.error("⏳ Summarizing content...");

    const provider = useMock
      ? createMockSummarizer()
      : createClaudeSummarizer();
    const result = await summarizeContent(
      validatedContent,
      undefined,
      provider
    );

    if (!result.success) {
      console.error(`Error: ${result.error.message}`);
      process.exit(1);
    }

    // Display summary metadata
    console.log("\n✓ Content summarized successfully\n");
    if (result.data.contentId) {
      console.log(`Session ID: ${result.data.contentId}`);
    }
    if (result.data.detectedSource) {
      console.log(`Source Type: ${result.data.detectedSource}`);
    }
    console.log(`Saved to: ~/.looplia/contentItem/${result.data.contentId}/\n`);

    // Display next steps
    if (result.data.contentId) {
      console.log(
        `Next step: looplia kit --session-id ${result.data.contentId}\n`
      );
    }

    writeOutput(result.data, format, outputPath);
  }
}
