import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildWritingKit,
  type ContentItem,
  type ContentSummary,
  createMockIdeaGenerator,
  createMockOutlineGenerator,
  createMockSummarizer,
  type UserProfile,
  type UserTopic,
  validateContentItem,
  validateUserProfile,
} from "@looplia-core/core";
import {
  createClaudeProviders,
  ensureWorkspace,
  readUserProfile,
  writeContentItem,
} from "@looplia-core/provider/claude-agent-sdk";
import {
  createContentItemFromFile,
  formatKitAsMarkdown,
  getArg,
  hasFlag,
  parseArgs,
  readContentFile,
} from "../utils";

const VALID_TONES = ["beginner", "intermediate", "expert", "mixed"] as const;
type Tone = (typeof VALID_TONES)[number];

const MIN_WORD_COUNT = 100;
const MAX_WORD_COUNT = 10_000;
const DEFAULT_WORD_COUNT = 1000;

function printKitHelp(): void {
  console.log(`
looplia kit - Build a complete writing kit from content

Usage:
  looplia kit --file <path> [options]
  looplia kit --content-id <id> [options]

Options:
  --file, -f         Path to content file
  --content-id       Content ID from previous summarize (reuse existing content)
  --format           Output format: json, markdown (default: json)
  --output, -o       Output file path (default: stdout)
  --topics           Comma-separated topics of interest
  --tone             Writing tone: beginner, intermediate, expert, mixed (default: intermediate)
  --word-count       Target word count (default: 1000, range: 100-10000)
  --mock, -m         Use mock providers (no API key required)
  --help, -h         Show this help

Note: Either --file or --content-id is required (but not both)

Environment:
  ANTHROPIC_API_KEY  Required unless --mock is specified

Example:
  looplia kit --file ./article.txt --topics "ai,productivity" --tone expert
  looplia kit --content-id podcast-2024-12-08-ai-healthcare --tone expert
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

function parseWordCount(wordCountArg: string | undefined): number {
  const parsed = Number.parseInt(
    wordCountArg ?? String(DEFAULT_WORD_COUNT),
    10
  );
  if (
    Number.isNaN(parsed) ||
    parsed < MIN_WORD_COUNT ||
    parsed > MAX_WORD_COUNT
  ) {
    return DEFAULT_WORD_COUNT;
  }
  return parsed;
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
      targetWordCount,
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

function checkApiKey(useMock: boolean): void {
  if (useMock || process.env.ANTHROPIC_API_KEY) {
    return;
  }
  console.error("Error: ANTHROPIC_API_KEY environment variable is required");
  console.error("Get your API key from: https://console.anthropic.com");
  console.error("Or use --mock flag to run without API key");
  process.exit(1);
}

function loadContentFromId(
  workspace: string,
  contentId: string
): { content: ContentItem; summary: ContentSummary } {
  const contentDir = join(workspace, "contentItem", contentId);
  const summaryPath = join(contentDir, "summary.json");

  try {
    const summaryData = JSON.parse(
      readFileSync(summaryPath, "utf-8")
    ) as ContentSummary;

    // Reconstruct ContentItem from summary data
    const content: ContentItem = {
      id: contentId,
      title: summaryData.headline || "Untitled",
      rawText: "", // We don't need the raw text for kit generation
      url: "",
      source: {
        id: contentId,
        type: "custom",
        url: "",
      },
      metadata: {},
    };

    return { content, summary: summaryData };
  } catch (_error) {
    console.error(`Error: Could not load content with ID "${contentId}"`);
    console.error("Make sure you've run 'looplia summarize' first");
    process.exit(1);
  }
}

function applyCliOverrides(
  user: UserProfile,
  topicsArg: string | undefined,
  toneArg: string | undefined,
  wordCountArg: string | undefined
): void {
  if (topicsArg) {
    user.topics = parseTopics(topicsArg);
  }
  if (toneArg) {
    user.style.tone = parseTone(toneArg);
  }
  if (wordCountArg) {
    user.style.targetWordCount = parseWordCount(wordCountArg);
  }
}

async function loadUserProfile(
  workspace: string,
  topicsArg: string | undefined,
  toneArg: string | undefined,
  wordCountArg: string | undefined
): Promise<UserProfile> {
  try {
    const profileData = await readUserProfile(workspace);
    const validation = validateUserProfile(profileData);
    if (validation.success) {
      applyCliOverrides(validation.data, topicsArg, toneArg, wordCountArg);
      return validation.data;
    }
    console.error("Warning: Invalid user-profile.json, using CLI args");
  } catch {
    // No user profile found, fall through to create from CLI args
  }
  return createUserProfile(
    parseTopics(topicsArg),
    parseTone(toneArg ?? "intermediate"),
    parseWordCount(wordCountArg)
  );
}

function createProviders(useMock: boolean) {
  if (useMock) {
    return {
      summarizer: createMockSummarizer(),
      idea: createMockIdeaGenerator(),
      outline: createMockOutlineGenerator(),
    };
  }
  return createClaudeProviders();
}

export async function runKitCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (hasFlag(parsed, "help", "h")) {
    printKitHelp();
    return;
  }

  const filePath = getArg(parsed, "file", "f");
  const contentId = getArg(parsed, "content-id");

  // Validate that either --file or --content-id is provided, but not both
  if (!(filePath || contentId)) {
    console.error("Error: Either --file or --content-id is required");
    printKitHelp();
    process.exit(1);
  }

  if (filePath && contentId) {
    console.error("Error: Cannot use both --file and --content-id together");
    printKitHelp();
    process.exit(1);
  }

  const format = getArg(parsed, "format") ?? "json";
  const outputPath = getArg(parsed, "output", "o");
  const topicsArg = getArg(parsed, "topics");
  const toneArg = getArg(parsed, "tone");
  const wordCountArg = getArg(parsed, "word-count");
  const useMock = hasFlag(parsed, "mock", "m");

  checkApiKey(useMock);

  // When using mock providers, skip plugin bootstrap requirement
  // but don't force refresh (preserve existing workspace)
  const workspace = await ensureWorkspace({
    requireFiles: !useMock,
    skipPluginBootstrap: useMock,
  });
  const user = await loadUserProfile(
    workspace,
    topicsArg,
    toneArg,
    wordCountArg
  );

  // Load content either from file or from content ID
  let content: ContentItem;
  if (filePath) {
    const rawText = readContentFile(filePath);
    content = createContentItemFromFile(filePath, rawText);

    const contentValidation = validateContentItem(content);
    if (!contentValidation.success) {
      console.error(
        `Content validation error: ${contentValidation.error.message}`
      );
      process.exit(1);
    }

    const newContentId = await writeContentItem(
      contentValidation.data,
      workspace
    );
    console.error(`✓ Content written to workspace: ${newContentId}`);
    content = contentValidation.data;
  } else {
    // Load from existing content ID
    const { content: loadedContent } = loadContentFromId(
      workspace,
      contentId ?? ""
    );
    console.error(`✓ Loaded content: ${contentId}`);
    content = loadedContent;
  }

  const providers = createProviders(useMock);

  console.error("⏳ Processing content...");
  const result = await buildWritingKit(content, user, providers);

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
