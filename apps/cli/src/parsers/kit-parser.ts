/**
 * Kit Command Parser
 *
 * Parses and validates arguments for the kit command.
 * Target complexity: ≤8
 */

import type { KitConfig } from "../runtime/types";
import { getArg, hasFlag, parseArgs } from "../utils/args";

const VALID_TONES = ["beginner", "intermediate", "expert", "mixed"] as const;
const MIN_WORD_COUNT = 100;
const MAX_WORD_COUNT = 10_000;
const DEFAULT_WORD_COUNT = 1000;

/**
 * Parse kit command arguments into typed config
 */
export function parseKitArgs(args: string[]): KitConfig {
  const parsed = parseArgs(args);

  return {
    help: hasFlag(parsed, "help", "h"),
    file: getArg(parsed, "file", "f"),
    sessionId: getArg(parsed, "session-id"),
    topics: parseTopics(getArg(parsed, "topics")),
    tone: parseTone(getArg(parsed, "tone")),
    wordCount: parseWordCount(getArg(parsed, "word-count")),
    format: (getArg(parsed, "format") ?? "json") as "json" | "markdown",
    outputPath: getArg(parsed, "output", "o"),
    noStreaming: hasFlag(parsed, "no-streaming"),
    mock: hasFlag(parsed, "mock", "m"),
  };
}

/**
 * Validate kit input configuration
 * @throws Error if validation fails
 */
export function validateKitInput(config: KitConfig): void {
  if (!(config.file || config.sessionId)) {
    throw new Error("Either --file or --session-id is required");
  }

  if (config.file && config.sessionId) {
    throw new Error("Cannot use both --file and --session-id together");
  }
}

/**
 * Print kit command help
 */
export function printKitHelp(): void {
  console.log(`
looplia kit - Build a complete writing kit from content

Usage:
  looplia kit --file <path> [options]
  looplia kit --session-id <id> [options]

Options:
  --file, -f         Path to content file (creates new session)
  --session-id       Session ID to continue (resumes existing session)
  --format           Output format: json, markdown (default: json)
  --output, -o       Output file path (default: stdout)
  --topics           Comma-separated topics of interest
  --tone             Writing tone: beginner, intermediate, expert, mixed (default: intermediate)
  --word-count       Target word count (default: 1000, range: 100-10000)
  --no-streaming     Disable streaming UI (use legacy output)
  --mock, -m         Use mock providers (no API key required)
  --help, -h         Show this help

Note: Either --file or --session-id is required (but not both)
      --file always creates a new session
      --session-id continues from existing session (smart continuation)
      Streaming UI is disabled automatically when piping output

Environment:
  ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN  Required unless --mock is specified

Example:
  looplia kit --file ./article.txt --topics "ai,productivity" --tone expert
  looplia kit --session-id article-2025-12-08-abc123 --tone expert
  looplia kit --file ./notes.md --no-streaming | jq .summary
`);
}

/**
 * Parse topics string into array
 */
function parseTopics(topicsArg: string | undefined): string[] | undefined {
  if (!topicsArg) {
    return;
  }
  return topicsArg.split(",").map((t) => t.trim());
}

/**
 * Parse and validate tone
 */
function parseTone(toneArg: string | undefined): string | undefined {
  if (!toneArg) {
    return;
  }
  return VALID_TONES.includes(toneArg as (typeof VALID_TONES)[number])
    ? toneArg
    : "intermediate";
}

/**
 * Parse and validate word count
 */
function parseWordCount(wordCountArg: string | undefined): number | undefined {
  if (!wordCountArg) {
    return;
  }

  const parsed = Number.parseInt(wordCountArg, 10);
  if (
    Number.isNaN(parsed) ||
    parsed < MIN_WORD_COUNT ||
    parsed > MAX_WORD_COUNT
  ) {
    return DEFAULT_WORD_COUNT;
  }
  return parsed;
}
