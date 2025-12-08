import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ContentItem,
  createMockWritingKitProvider,
  type UserProfile,
  type UserTopic,
  validateContentItem,
  validateUserProfile,
} from "@looplia-core/core";
import {
  createClaudeWritingKitProvider,
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

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const TITLE_REGEX = /title:\s*"?([^"\n]+)"?/;

const MIN_WORD_COUNT = 100;
const MAX_WORD_COUNT = 10_000;
const DEFAULT_WORD_COUNT = 1000;

function printKitHelp(): void {
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
  --mock, -m         Use mock providers (no API key required)
  --help, -h         Show this help

Note: Either --file or --session-id is required (but not both)
      --file always creates a new session
      --session-id continues from existing session (smart continuation)

Environment:
  ANTHROPIC_API_KEY  Required unless --mock is specified

Example:
  looplia kit --file ./article.txt --topics "ai,productivity" --tone expert
  looplia kit --session-id article-2025-12-08-abc123 --tone expert
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

function loadContentFromSessionId(
  workspace: string,
  sessionId: string
): ContentItem {
  const contentDir = join(workspace, "contentItem", sessionId);
  const contentPath = join(contentDir, "content.md");

  if (!existsSync(contentPath)) {
    console.error(`Error: Session "${sessionId}" not found`);
    console.error(`Expected content at: ${contentPath}`);
    console.error("Use --file to create a new session");
    process.exit(1);
  }

  // Read content.md and extract metadata from frontmatter
  const contentMd = readFileSync(contentPath, "utf-8");
  const frontmatterMatch = contentMd.match(FRONTMATTER_REGEX);

  let title = "Untitled";
  let rawText = contentMd;

  if (frontmatterMatch?.[1] && frontmatterMatch[2]) {
    const frontmatter = frontmatterMatch[1];
    rawText = frontmatterMatch[2].trim();

    // Extract title from frontmatter
    const titleMatch = frontmatter.match(TITLE_REGEX);
    if (titleMatch?.[1]) {
      title = titleMatch[1].trim();
    }
  }

  return {
    id: sessionId,
    title,
    rawText,
    url: "",
    source: {
      id: sessionId,
      type: "custom",
      url: "",
    },
    metadata: {},
  };
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

async function loadUserProfileWithOverrides(
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

function createProvider(useMock: boolean, workspace: string) {
  if (useMock) {
    return createMockWritingKitProvider();
  }
  return createClaudeWritingKitProvider({ workspace });
}

export async function runKitCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (hasFlag(parsed, "help", "h")) {
    printKitHelp();
    return;
  }

  const filePath = getArg(parsed, "file", "f");
  const sessionId = getArg(parsed, "session-id");

  // Validate that either --file or --session-id is provided, but not both
  if (!(filePath || sessionId)) {
    console.error("Error: Either --file or --session-id is required");
    printKitHelp();
    process.exit(1);
  }

  if (filePath && sessionId) {
    console.error("Error: Cannot use both --file and --session-id together");
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
  const workspace = await ensureWorkspace({
    requireFiles: !useMock,
    skipPluginBootstrap: useMock,
  });

  const user = await loadUserProfileWithOverrides(
    workspace,
    topicsArg,
    toneArg,
    wordCountArg
  );

  // Load or create content based on input mode
  let content: ContentItem;

  if (filePath) {
    // --file: Create new session
    const rawText = readContentFile(filePath);
    content = createContentItemFromFile(filePath, rawText);

    const contentValidation = validateContentItem(content);
    if (!contentValidation.success) {
      console.error(
        `Content validation error: ${contentValidation.error.message}`
      );
      process.exit(1);
    }

    const newSessionId = await writeContentItem(
      contentValidation.data,
      workspace
    );
    console.error(`✓ New session created: ${newSessionId}`);
    content = contentValidation.data;
  } else {
    // --session-id: Continue existing session (agent will detect progress)
    content = loadContentFromSessionId(workspace, sessionId ?? "");
    console.error(`✓ Resuming session: ${sessionId}`);
  }

  const provider = createProvider(useMock, workspace);

  console.error("⏳ Building writing kit...");
  const result = await provider.buildKit(content, user);

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
