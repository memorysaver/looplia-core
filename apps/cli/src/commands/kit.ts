import { readFileSync, writeFileSync } from "node:fs";
import {
  buildWritingKit,
  type ContentItem,
  createMockIdeaGenerator,
  createMockOutlineGenerator,
  createMockSummarizer,
  type UserProfile,
  type UserTopic,
  validateContentItem,
  validateUserProfile,
} from "@looplia-core/core";
import { formatKitAsMarkdown, getArg, hasFlag, parseArgs } from "../utils";

const VALID_TONES = ["beginner", "intermediate", "expert", "mixed"] as const;
type Tone = (typeof VALID_TONES)[number];

function printKitHelp(): void {
  console.log(`
looplia kit - Build a complete writing kit from content

Usage:
  looplia kit --file <path> [options]

Options:
  --file, -f         Path to content file (required)
  --format           Output format: json, markdown (default: json)
  --output, -o       Output file path (default: stdout)
  --topics           Comma-separated topics of interest
  --tone             Writing tone: beginner, intermediate, expert, mixed (default: intermediate)
  --word-count       Target word count (default: 1000)
  --help, -h         Show this help

Example:
  looplia kit --file ./article.txt --topics "ai,productivity" --tone expert
`);
}

function parseTopics(topicsArg: string | undefined): UserTopic[] {
  if (!topicsArg) {
    return [];
  }
  return topicsArg.split(",").map((t) => ({
    topic: t.trim(),
    interestLevel: 3 as const,
  }));
}

function parseTone(toneArg: string): Tone {
  return VALID_TONES.includes(toneArg as Tone)
    ? (toneArg as Tone)
    : "intermediate";
}

function readContentFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Error: Could not read file: ${filePath}`);
    process.exit(1);
  }
}

function createContentItem(filePath: string, rawText: string): ContentItem {
  return {
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
}

function createUserProfile(
  topics: UserTopic[],
  tone: Tone,
  targetWordCount: number
): UserProfile {
  return {
    userId: "cli-user",
    topics,
    style: {
      tone,
      targetWordCount: Number.isNaN(targetWordCount) ? 1000 : targetWordCount,
      voice: "first-person",
    },
  };
}

function writeOutput(output: string, outputPath: string | undefined): void {
  if (outputPath) {
    writeFileSync(outputPath, output);
    console.log(`Writing kit written to: ${outputPath}`);
  } else {
    console.log(output);
  }
}

export async function runKitCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (hasFlag(parsed, "help", "h")) {
    printKitHelp();
    return;
  }

  const filePath = getArg(parsed, "file", "f");
  if (!filePath) {
    console.error("Error: --file is required");
    printKitHelp();
    process.exit(1);
  }

  const format = getArg(parsed, "format") ?? "json";
  const outputPath = getArg(parsed, "output", "o");
  const topics = parseTopics(getArg(parsed, "topics"));
  const tone = parseTone(getArg(parsed, "tone") ?? "intermediate");
  const targetWordCount = Number.parseInt(
    getArg(parsed, "word-count") ?? "1000",
    10
  );

  const rawText = readContentFile(filePath);
  const content = createContentItem(filePath, rawText);
  const user = createUserProfile(topics, tone, targetWordCount);

  const contentValidation = validateContentItem(content);
  if (!contentValidation.success) {
    console.error(
      `Content validation error: ${contentValidation.error.message}`
    );
    process.exit(1);
  }

  const userValidation = validateUserProfile(user);
  if (!userValidation.success) {
    console.error(
      `User profile validation error: ${userValidation.error.message}`
    );
    process.exit(1);
  }

  const providers = {
    summarizer: createMockSummarizer(),
    idea: createMockIdeaGenerator(),
    outline: createMockOutlineGenerator(),
  };

  const result = await buildWritingKit(
    contentValidation.data,
    userValidation.data,
    providers
  );

  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }

  const output =
    format === "markdown"
      ? formatKitAsMarkdown(result.data)
      : JSON.stringify(result.data, null, 2);

  writeOutput(output, outputPath);
}
