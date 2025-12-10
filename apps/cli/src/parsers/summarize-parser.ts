/**
 * Summarize Command Parser
 *
 * Parses and validates arguments for the summarize command.
 * Target complexity: ≤5
 */

import type { SummarizeConfig } from "../runtime/types";
import { getArg, hasFlag, parseArgs } from "../utils/args";

/**
 * Parse summarize command arguments into typed config
 */
export function parseSummarizeArgs(args: string[]): SummarizeConfig {
  const parsed = parseArgs(args);

  return {
    help: hasFlag(parsed, "help", "h"),
    file: getArg(parsed, "file", "f") ?? "",
    format: (getArg(parsed, "format") ?? "json") as "json" | "markdown",
    outputPath: getArg(parsed, "output", "o"),
    noStreaming: hasFlag(parsed, "no-streaming"),
    mock: hasFlag(parsed, "mock", "m"),
  };
}

/**
 * Validate summarize input configuration
 * @throws Error if validation fails
 */
export function validateSummarizeInput(config: SummarizeConfig): void {
  if (!config.file) {
    throw new Error("--file is required");
  }
}

/**
 * Print summarize command help
 */
export function printSummarizeHelp(): void {
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
