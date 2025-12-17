/**
 * Workflow Command Parser (v0.5.1)
 *
 * Parses and validates arguments for the workflow-based run command.
 * Supports: looplia run <workflow-id> --file <path>
 */

import type { WorkflowConfig } from "../runtime/types";
import { getArg, hasFlag, type ParsedArgs, parseArgs } from "../utils/args";

const VALID_TONES = ["beginner", "intermediate", "expert", "mixed"] as const;
const MIN_WORD_COUNT = 100;
const MAX_WORD_COUNT = 10_000;
const DEFAULT_WORD_COUNT = 1000;

/**
 * Parse workflow command arguments into typed config
 *
 * Usage: looplia run <workflow-id> --file <path> [options]
 */
export function parseWorkflowArgs(args: string[]): WorkflowConfig {
  const parsed = parseArgs(args);

  // Extract workflow ID from positional argument
  const workflowId = extractWorkflowId(parsed);

  return {
    help: hasFlag(parsed, "help", "h"),
    workflowId,
    file: getArg(parsed, "file", "f"),
    sessionId: getArg(parsed, "session-id"),
    topics: parseTopics(getArg(parsed, "topics")),
    tone: parseTone(getArg(parsed, "tone")),
    wordCount: parseWordCount(getArg(parsed, "word-count")),
    outputPath: getArg(parsed, "output", "o"),
    noStreaming: hasFlag(parsed, "no-streaming"),
    mock: hasFlag(parsed, "mock", "m"),
  };
}

/**
 * Extract workflow ID from positional arguments
 *
 * First non-flag argument that doesn't follow a flag expecting a value
 */
function extractWorkflowId(parsed: ParsedArgs): string | undefined {
  // Check for positional argument (first item in positionals array)
  if (parsed._ && parsed._.length > 0) {
    return parsed._[0];
  }
  return;
}

/**
 * Validate workflow input configuration
 * @throws Error if validation fails
 */
export function validateWorkflowInput(config: WorkflowConfig): void {
  if (!config.workflowId) {
    throw new Error(
      "Workflow ID is required: looplia run <workflow-id> --file <path>"
    );
  }

  if (!(config.file || config.sessionId)) {
    throw new Error("Either --file or --session-id is required");
  }

  if (config.file && config.sessionId) {
    throw new Error("Cannot use both --file and --session-id together");
  }
}

/**
 * Print workflow command help
 */
export function printWorkflowHelp(availableWorkflows: string[] = []): void {
  const workflowList =
    availableWorkflows.length > 0
      ? `\nAvailable workflows:\n  ${availableWorkflows.join(", ")}`
      : "";

  console.log(`
looplia run - Execute a workflow on content

Usage:
  looplia run <workflow-id> --file <path> [options]
  looplia run <workflow-id> --session-id <id> [options]

Arguments:
  <workflow-id>      Workflow to execute (e.g., writing-kit)
${workflowList}

Options:
  --file, -f         Path to content file (creates new session)
  --session-id       Session ID to continue (resumes existing session)
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
  looplia run writing-kit --file ./article.txt --topics "ai,productivity" --tone expert
  looplia run writing-kit --session-id article-2025-12-08-abc123 --tone expert
  looplia run writing-kit --file ./notes.md --no-streaming | jq .summary
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
