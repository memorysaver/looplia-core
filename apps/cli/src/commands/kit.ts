import { readFileSync, writeFileSync } from "node:fs";
import {
  createMockSummarizer,
  createMockIdeaGenerator,
  createMockOutlineGenerator,
  buildWritingKit,
  type ContentItem,
  type UserProfile,
  type UserTopic,
} from "@looplia-core/core";
import { parseArgs, getArg, hasFlag, formatKitAsMarkdown } from "../utils";

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
  const topicsArg = getArg(parsed, "topics");
  const toneArg = getArg(parsed, "tone") ?? "intermediate";
  const wordCountArg = getArg(parsed, "word-count") ?? "1000";

  // Parse topics
  const topics: UserTopic[] = topicsArg
    ? topicsArg.split(",").map((t) => ({
        topic: t.trim(),
        interestLevel: 3 as const,
      }))
    : [];

  // Validate tone
  const validTones = ["beginner", "intermediate", "expert", "mixed"] as const;
  type Tone = (typeof validTones)[number];
  const tone: Tone = validTones.includes(toneArg as Tone)
    ? (toneArg as Tone)
    : "intermediate";

  // Parse word count
  const targetWordCount = Number.parseInt(wordCountArg, 10);

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

  // Create user profile
  const user: UserProfile = {
    userId: "cli-user",
    topics,
    style: {
      tone,
      targetWordCount: Number.isNaN(targetWordCount) ? 1000 : targetWordCount,
      voice: "first-person",
    },
  };

  // Build kit using mock providers
  const providers = {
    summarizer: createMockSummarizer(),
    idea: createMockIdeaGenerator(),
    outline: createMockOutlineGenerator(),
  };

  const result = await buildWritingKit(content, user, providers);

  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }

  // Format output
  let output: string;
  if (format === "markdown") {
    output = formatKitAsMarkdown(result.data);
  } else {
    output = JSON.stringify(result.data, null, 2);
  }

  // Write output
  if (outputPath) {
    writeFileSync(outputPath, output);
    console.log(`Writing kit written to: ${outputPath}`);
  } else {
    console.log(output);
  }
}
