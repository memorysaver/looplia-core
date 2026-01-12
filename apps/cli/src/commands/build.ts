/**
 * Build Command (v0.6.4) - Interactive Wizard
 *
 * Build a workflow from natural language with multi-turn clarification.
 * Uses interactive wizard when run without arguments or with description.
 *
 * The wizard guides users through:
 * 1. Description input (if not provided)
 * 2. AI-generated clarifying questions
 * 3. Tab-based navigation through sections
 * 4. Live workflow preview
 * 5. Final generation and save
 *
 * @see docs/DESIGN-0.6.4.md
 * @see docs/DESIGN-0.6.1.md § 5 CLI Command
 * @see plugins/looplia-core/commands/build.md
 */

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import type { StreamingEvent } from "@looplia-core/core";
import { compileRegistry } from "@looplia-core/provider";
import {
  createClaudeAgentExecutor,
  initializeCommandEnvironment,
} from "@looplia-core/provider/claude-agent-sdk";
import { renderStreamingQuery } from "../components/index.js";
import { renderBuildWizard } from "../components/wizard/index.js";
import { COMMANDS } from "../constants.js";
import { isInteractive } from "../utils/terminal.js";

/** Maximum description length to prevent excessive prompt size */
const MAX_DESCRIPTION_LENGTH = 500;

/** Multiplier for enriched descriptions that include user clarifications */
const ENRICHED_DESCRIPTION_MULTIPLIER = 3;

/** Maximum workflow name length for filesystem compatibility */
const MAX_WORKFLOW_NAME_LENGTH = 50;

/** Build command prefix from constants */
const BUILD_COMMAND = COMMANDS.BUILD;

/**
 * Build result type
 */
export type BuildResult = {
  status: "success" | "error";
  workflowPath?: string;
  workflowName?: string;
  stepsCount?: number;
  error?: string;
};

/**
 * Executor interface for dependency injection in tests
 */
export type BuildExecutor = {
  executePrompt: (
    prompt: string,
    options: { workspace: string; contentId: string }
  ) => Promise<{
    success: boolean;
    data?: BuildResult;
    error?: { message: string };
  }>;
};

/**
 * Parsed command arguments
 */
export type BuildArgs = {
  description: string;
  output?: string;
  name?: string;
  noInteractive: boolean;
  mock: boolean;
  help: boolean;
};

/**
 * Check if argument is a flag that takes a value
 */
function isValueFlag(arg: string): boolean {
  return arg === "--output" || arg === "-o" || arg === "--name" || arg === "-n";
}

/**
 * Validate that a value flag has a valid value
 * @throws Error if value is missing or invalid
 */
function validateValueFlag(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

/**
 * Process a single argument and its value
 */
function processArg(
  result: BuildArgs,
  arg: string,
  nextArg: string | undefined,
  descriptionParts: string[]
): void {
  if (arg === "--help" || arg === "-h") {
    result.help = true;
  } else if (arg === "--output" || arg === "-o") {
    result.output = validateValueFlag(arg, nextArg);
  } else if (arg === "--name" || arg === "-n") {
    result.name = validateValueFlag(arg, nextArg);
  } else if (arg === "--no-interactive") {
    result.noInteractive = true;
  } else if (arg === "--mock") {
    result.mock = true;
  } else if (!arg.startsWith("-")) {
    descriptionParts.push(arg);
  }
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): BuildArgs {
  const descriptionParts: string[] = [];
  const result: BuildArgs = {
    description: "",
    noInteractive: false,
    mock: false,
    help: false,
  };

  let skipNext = false;
  for (const [index, arg] of args.entries()) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    const nextArg = args[index + 1];
    processArg(result, arg, nextArg, descriptionParts);

    if (isValueFlag(arg)) {
      skipNext = true;
    }
  }

  result.description = descriptionParts.join(" ");
  return result;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Usage: looplia build [description] [options]

Build a workflow from natural language requirements.

Arguments:
  description           What the workflow should do (optional, can be interactive)

Options:
  --output, -o <path>     Output directory (default: ~/.looplia/workflows/)
  --name, -n <name>       Workflow filename (derived from description if not set)
  --no-interactive        Skip TUI, batch mode
  --mock                  Use mock mode (no API calls)
  --help, -h              Show this help

Examples:
  looplia build
  looplia build "analyze videos and create blog outlines"
  looplia build "summarize articles" --name article-summary
  looplia build "..." --no-interactive --name my-workflow
`);
}

/**
 * Get workspace path
 */
export function getWorkspacePath(): string {
  return resolve(homedir(), ".looplia");
}

/**
 * Ensure workspace and workflows directory exist
 */
export function ensureWorkspace(mock: boolean): string {
  const workspace = getWorkspacePath();
  const workflowsDir = resolve(workspace, "workflows");

  if (!existsSync(workspace)) {
    if (mock) {
      mkdirSync(workflowsDir, { recursive: true });
    } else {
      console.error("Workspace not initialized. Run: looplia init");
      process.exit(1);
    }
  } else if (!existsSync(workflowsDir)) {
    mkdirSync(workflowsDir, { recursive: true });
  }

  return workspace;
}

/**
 * Validate environment (API key)
 * @deprecated Use initializeCommandEnvironment() from @looplia-core/provider/claude-agent-sdk instead.
 * This function does not load workspace settings before validation.
 * Will be removed in v0.7.0.
 */
export function validateEnvironment(mock: boolean): void {
  if (mock) {
    return;
  }

  if (!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN)) {
    console.error(
      "Error: ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN required"
    );
    console.error("Get your API key from: https://console.anthropic.com");
    console.error("Or use --mock flag to run without API key");
    process.exit(1);
  }
}

/**
 * Build the /build prompt to inject into the agent.
 * Sanitizes user input to prevent prompt injection.
 */
export function buildPrompt(args: BuildArgs): string {
  // v0.6.5: Use looplia: prefix to avoid conflict with built-in commands
  let prompt = BUILD_COMMAND;

  // Include --name flag if provided (must come before description)
  if (args.name) {
    const sanitizedName = args.name
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, "-") // Only allow safe filename characters
      .replace(/-+/g, "-") // Collapse consecutive hyphens
      .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
      .slice(0, MAX_WORKFLOW_NAME_LENGTH); // Limit name length
    if (sanitizedName) {
      prompt += ` --name ${sanitizedName}`;
    }
  }

  if (args.description) {
    const sanitized = args.description
      .trim()
      .slice(0, MAX_DESCRIPTION_LENGTH)
      .replace(/[\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (sanitized) {
      prompt += ` ${sanitized}`;
    }
  }

  return prompt;
}

/**
 * Execute in mock mode
 */
function executeMock(args: BuildArgs): BuildResult {
  console.error("⏳ Building workflow (mock)...");

  const workflowName = args.name ?? "mock-workflow";
  const workspace = getWorkspacePath();
  const workflowPath = resolve(workspace, "workflows", `${workflowName}.md`);

  return {
    status: "success",
    workflowPath,
    workflowName,
    stepsCount: 3,
  };
}

/**
 * Execute with streaming UI (legacy).
 * Wraps streaming execution with error handling and proper session tracking.
 * v0.7.1: Creates sandbox for logging consistency with run command
 * @deprecated Use executeWizard for interactive builds (v0.6.4+)
 */
export async function executeStreamingLegacy(
  prompt: string,
  workspace: string
): Promise<BuildResult> {
  try {
    // v0.7.1: Create sandbox for build session (same pattern as run command)
    const { createSandboxDirectories, generateSandboxId } = await import(
      "../utils/sandbox.js"
    );
    const sandboxId = generateSandboxId("build");
    createSandboxDirectories(workspace, sandboxId);

    // Append sandbox-id to prompt so logger can extract it
    const promptWithSandbox = `${prompt} --sandbox-id ${sandboxId}`;

    const executor = createClaudeAgentExecutor({ workspace });
    const generator = executor.executePromptStreaming(promptWithSandbox, {
      workspace,
      contentId: sandboxId,
    });

    const { result, error } = await renderStreamingQuery<BuildResult>({
      title: "Workflow Builder",
      subtitle: "Creating workflow from description",
      streamGenerator: () =>
        generator as AsyncGenerator<
          StreamingEvent,
          { success: boolean; data?: BuildResult; error?: { message: string } }
        >,
    });

    if (error) {
      return {
        status: "error",
        error: error.message,
      };
    }

    return (
      result ?? {
        status: "error",
        error: "No result received",
      }
    );
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute in batch mode (non-streaming)
 * v0.7.1: Creates sandbox for logging consistency with run command
 * @param executor Optional executor for dependency injection (testing)
 */
export async function executeBatch(
  prompt: string,
  workspace: string,
  executor?: BuildExecutor
): Promise<BuildResult> {
  console.error("⏳ Building workflow...");

  // v0.7.1: Create sandbox for build session (same pattern as run command)
  const { createSandboxDirectories, generateSandboxId } = await import(
    "../utils/sandbox.js"
  );
  const sandboxId = generateSandboxId("build");
  createSandboxDirectories(workspace, sandboxId);

  // Append sandbox-id to prompt so logger can extract it
  const promptWithSandbox = `${prompt} --sandbox-id ${sandboxId}`;

  const exec = executor ?? createClaudeAgentExecutor({ workspace });
  const result = await exec.executePrompt(promptWithSandbox, {
    workspace,
    contentId: sandboxId,
  });

  if (result.success && result.data) {
    return result.data as BuildResult;
  }

  return {
    status: "error",
    error: result.error?.message ?? "Unknown error",
  };
}

/**
 * Streaming batch executor for wizard use.
 * v0.7.1: Creates sandbox for logging consistency with run command
 * Returns an async generator that yields StreamingEvents.
 */
export async function* executeStreamingBatch(
  prompt: string,
  workspace: string
): AsyncGenerator<StreamingEvent> {
  // v0.7.1: Create sandbox for build session (same pattern as run command)
  const { createSandboxDirectories, generateSandboxId } = await import(
    "../utils/sandbox.js"
  );
  const sandboxId = generateSandboxId("build");
  createSandboxDirectories(workspace, sandboxId);

  // Append sandbox-id to prompt so logger can extract it
  const promptWithSandbox = `${prompt} --sandbox-id ${sandboxId}`;

  const executor = createClaudeAgentExecutor({ workspace });
  const generator = executor.executePromptStreaming(promptWithSandbox, {
    workspace,
    contentId: sandboxId,
  });

  for await (const event of generator) {
    yield event;
  }
}

/**
 * QuestionCallback type for interactive streaming
 */
export type QuestionCallback = (
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>
) => Promise<Record<string, string>>;

/**
 * Interactive streaming batch executor for wizard use (v0.7.1).
 * Supports AskUserQuestion tool via questionCallback.
 * v0.7.1: Creates sandbox for logging consistency with run command
 * Returns an async generator that yields StreamingEvents.
 */
export async function* executeInteractiveStreamingBatch(
  prompt: string,
  workspace: string,
  questionCallback?: QuestionCallback
): AsyncGenerator<StreamingEvent> {
  // v0.7.1: Create sandbox for build session (same pattern as run command)
  const { createSandboxDirectories, generateSandboxId } = await import(
    "../utils/sandbox.js"
  );
  const sandboxId = generateSandboxId("build");
  createSandboxDirectories(workspace, sandboxId);

  // Append sandbox-id to prompt so logger can extract it
  const promptWithSandbox = `${prompt} --sandbox-id ${sandboxId}`;

  // Dynamically import interactive executor to avoid circular dependencies
  const { executeInteractiveQueryStreaming } = await import(
    "@looplia-core/provider/claude-agent-sdk"
  );

  // Use a simple schema that allows any JSON result
  const schema = {
    type: "object",
    properties: {
      status: { type: "string" },
      workflowPath: { type: "string" },
      workflowName: { type: "string" },
      stepsCount: { type: "number" },
      error: { type: "string" },
    },
  };

  const generator = executeInteractiveQueryStreaming<BuildResult>(
    promptWithSandbox,
    schema as Record<string, unknown>,
    { workspace },
    questionCallback
  );

  for await (const event of generator) {
    yield event;
  }
}

/**
 * Section type for answer serialization
 */
type SectionForContext = {
  id: string;
  questions: Array<{ id: string; text: string }>;
};

/**
 * Build a map of questionId -> question text from sections
 */
function buildQuestionTextMap(
  sections?: SectionForContext[]
): Map<string, string> {
  const map = new Map<string, string>();
  if (!sections) {
    return map;
  }

  for (const section of sections) {
    for (const question of section.questions) {
      map.set(question.id, question.text);
    }
  }
  return map;
}

/**
 * Format a single answer value to string
 */
function formatAnswerValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

/**
 * Format a question-answer pair for the prompt
 */
function formatQAPair(
  questionId: string,
  value: string | string[],
  questionTextMap: Map<string, string>
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const formattedValue = formatAnswerValue(value);
  if (!formattedValue) {
    return null;
  }

  const questionText = questionTextMap.get(questionId);
  if (questionText) {
    return `Q: ${questionText} A: ${formattedValue}`;
  }
  const key = questionId.replace(/-/g, " ");
  return `${key}: ${formattedValue}`;
}

/**
 * Serialize wizard answers to natural language context.
 * Transforms structured answers into readable text for the agent prompt.
 * Uses original question text for better context.
 */
function serializeAnswersToContext(
  answers: Record<string, Record<string, string | string[]>>,
  sections?: SectionForContext[]
): string {
  const questionTextMap = buildQuestionTextMap(sections);
  const parts: string[] = [];

  for (const [sectionId, sectionAnswers] of Object.entries(answers)) {
    if (sectionId === "review") {
      continue;
    }

    for (const [questionId, value] of Object.entries(sectionAnswers)) {
      const formatted = formatQAPair(questionId, value, questionTextMap);
      if (formatted) {
        parts.push(formatted);
      }
    }
  }

  return parts.join(". ");
}

/**
 * Build an enriched prompt from wizard answers.
 * Combines description with user answers for the agent's /build command.
 * Exported for use by wizard's GeneratingPanel.
 */
export function buildEnrichedPrompt(
  description: string,
  answers: Record<string, Record<string, string | string[]>>,
  name?: string,
  sections?: SectionForContext[]
): string {
  // v0.6.5: Use looplia: prefix to avoid conflict with built-in commands
  let prompt = BUILD_COMMAND;

  // Include --name flag if provided
  if (name) {
    const sanitizedName = name
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, MAX_WORKFLOW_NAME_LENGTH);
    if (sanitizedName) {
      prompt += ` --name ${sanitizedName}`;
    }
  }

  // Serialize answers into natural language context (with question text)
  const context = serializeAnswersToContext(answers, sections);

  // Combine description with user answers
  const enrichedDescription = context
    ? `${description}. User clarifications: ${context}`
    : description;

  const sanitized = enrichedDescription
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH * ENRICHED_DESCRIPTION_MULTIPLIER)
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized) {
    prompt += ` ${sanitized}`;
  }

  return prompt;
}

/**
 * Execute with interactive wizard (v0.6.4)
 * Uses tab-based UI for multi-turn clarification.
 * Generation happens via streaming TUI within the wizard (non-mock mode).
 */
async function executeWizard(
  workspace: string,
  parsed: BuildArgs
): Promise<BuildResult> {
  const { result, cancelled, error } = await renderBuildWizard({
    initialDescription: parsed.description,
    workflowName: parsed.name,
    workspace,
    mock: parsed.mock,
  });

  if (cancelled) {
    return {
      status: "error",
      error: "Build cancelled by user",
    };
  }

  if (error) {
    return {
      status: "error",
      error: error.message,
    };
  }

  if (!result) {
    return {
      status: "error",
      error: "No result received from wizard",
    };
  }

  // v0.6.4: Non-mock mode returns buildResult from streaming generation
  if (result.buildResult) {
    return result.buildResult;
  }

  // Mock mode fallback: use executeBatch
  const enrichedPrompt = buildEnrichedPrompt(
    result.description,
    result.answers,
    result.workflowName || parsed.name
  );

  return executeBatch(enrichedPrompt, workspace);
}

/**
 * Execute build based on mode
 */
function executeBuild(
  prompt: string,
  workspace: string,
  parsed: BuildArgs
): Promise<BuildResult> {
  if (parsed.mock) {
    return Promise.resolve(executeMock(parsed));
  }

  // Use interactive wizard in terminal mode (v0.6.4)
  if (isInteractive() && !parsed.noInteractive) {
    return executeWizard(workspace, parsed);
  }

  // Batch mode: require description
  if (!parsed.description) {
    return Promise.resolve({
      status: "error",
      error:
        "Description required in non-interactive mode. Use --no-interactive with a description.",
    });
  }

  return executeBatch(prompt, workspace);
}

/**
 * Render the result
 */
export function renderResult(result: BuildResult): void {
  if (result.status === "success") {
    console.log("\n✅ Workflow created successfully");
    if (result.workflowPath) {
      console.log(`Path: ${result.workflowPath}`);
    }
    if (result.workflowName) {
      console.log("\nRun with:");
      console.log(`  looplia run ${result.workflowName} --file <content.md>`);
    }
    if (result.stepsCount) {
      console.log(`\nSteps: ${result.stepsCount}`);
    }
  } else {
    console.error(`\n❌ Build failed: ${result.error ?? "Unknown error"}`);
  }
}

/**
 * Main entry point for build command (v0.6.1)
 */
export async function runBuildCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  try {
    // 1. Ensure workspace
    const workspace = ensureWorkspace(parsed.mock);

    // 2. v0.7.1: Compile local skill catalog (no remote fetching)
    if (!parsed.mock) {
      try {
        await compileRegistry({ localOnly: true });
      } catch {
        // Registry compilation failure is non-fatal - continue with existing cache
      }
    }

    // 3. Load settings, inject env vars, validate API key (v0.6.10)
    await initializeCommandEnvironment({ mock: parsed.mock });

    // 4. Build /build prompt
    const prompt = buildPrompt(parsed);

    // 5. Execute
    const result = await executeBuild(prompt, workspace, parsed);

    // 6. Render result
    renderResult(result);

    if (result.status !== "success") {
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
