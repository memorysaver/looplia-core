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

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import type { StreamingEvent } from "@looplia-core/core";
import { compileRegistry } from "@looplia-core/provider";
import {
  type BuildValidationManifest,
  createBuildHooks,
  createClaudeAgentExecutor,
  initializeCommandEnvironment,
} from "@looplia-core/provider/claude-agent-sdk";
import { renderStreamingQuery } from "../components/index.js";
import { renderBuildWizard } from "../components/wizard/index.js";
import { COMMANDS } from "../constants.js";
import { writeWorkflowArtifact } from "../utils/sandbox.js";
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
 * Artifact schema for CLI-controlled persistence (v0.7.3)
 */
export type BuildArtifact = {
  filename: string; // e.g., "article-summary.md"
  content: string; // Complete markdown content
};

/**
 * Build result type
 */
export type BuildResult = {
  status: "success" | "error";
  workflowPath?: string;
  workflowName?: string;
  /** Distinct from workflowName; used when agent returns an ID for the workflow */
  workflowId?: string;
  stepsCount?: number;
  error?: string;
  artifact?: BuildArtifact; // v0.7.3: CLI writes from this
};

/**
 * Streaming result type for generator return values
 */
type StreamingResult = {
  success: boolean;
  data?: BuildResult;
  error?: { message: string };
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
  skipResearch: boolean; // v0.8.0: Skip skill auto-discovery
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
  } else if (arg === "--skip-research" || arg === "--offline") {
    result.skipResearch = true;
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
    skipResearch: false,
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
  --skip-research         Skip skill auto-discovery (use local skills only)
  --offline               Alias for --skip-research
  --mock                  Use mock mode (no API calls)
  --help, -h              Show this help

Skill Auto-Discovery (v0.8.0):
  By default, build searches skills.sh for relevant skills based on your
  description and installs them to ~/.looplia/plugins/auto-discovery-plugin/.
  Use --skip-research to disable this and use only locally installed skills.

Examples:
  looplia build
  looplia build "analyze videos and create blog outlines"
  looplia build "summarize articles" --name article-summary
  looplia build "..." --no-interactive --name my-workflow
  looplia build "..." --skip-research  # Skip skill discovery
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
 * v0.7.5: Uses buildHooks for workflow file validation
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
    const sandboxDir = join(workspace, "sandbox", sandboxId);
    createSandboxDirectories(workspace, sandboxId);

    // v0.7.5: Create build-type validation.json for build hooks
    createBuildValidationJson(sandboxDir, sandboxId, "untitled");

    // v0.7.5: Set env vars for hooks to find sandbox
    process.env.LOOPLIA_SANDBOX_ID = sandboxId;
    process.env.LOOPLIA_SANDBOX_ROOT = join(workspace, "sandbox");

    // Append sandbox-id to prompt so logger can extract it
    const promptWithSandbox = `${prompt} --sandbox-id ${sandboxId}`;

    // v0.7.5: Pass buildHooks for workflow file validation
    const executor = createClaudeAgentExecutor({
      workspace,
      buildHooks: createBuildHooks(),
    });
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

    // v0.7.5: Handle success with no data by reading validation.json
    if (!result) {
      const validation = readBuildValidationSync(sandboxDir);
      if (validation?.workflowValidated && validation.workflowPath) {
        return {
          status: "success",
          workflowPath: validation.workflowPath,
          workflowName: validation.workflowName ?? undefined,
        };
      }
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
  const sandboxDir = join(workspace, "sandbox", sandboxId);
  createSandboxDirectories(workspace, sandboxId);

  // v0.7.5: Create build-type validation.json for build hooks
  createBuildValidationJson(sandboxDir, sandboxId, "untitled");

  // v0.7.5: Set env vars for hooks to find sandbox
  process.env.LOOPLIA_SANDBOX_ID = sandboxId;
  process.env.LOOPLIA_SANDBOX_ROOT = join(workspace, "sandbox");

  // Append sandbox-id to prompt so logger can extract it
  const promptWithSandbox = `${prompt} --sandbox-id ${sandboxId}`;

  // v0.7.5: Pass buildHooks for workflow file validation
  const exec =
    executor ??
    createClaudeAgentExecutor({ workspace, buildHooks: createBuildHooks() });
  const result = await exec.executePrompt(promptWithSandbox, {
    workspace,
    contentId: sandboxId,
  });

  if (result.success && result.data) {
    return result.data as BuildResult;
  }

  // v0.7.5: When buildHooks are used, success with no data means workflow was created
  // Check validation.json for the result
  if (result.success && !result.data) {
    const validation = readBuildValidationSync(sandboxDir);
    if (validation?.workflowValidated && validation.workflowPath) {
      return {
        status: "success",
        workflowPath: validation.workflowPath,
        workflowName: validation.workflowName ?? undefined,
      };
    }
  }

  return {
    status: "error",
    error: result.error?.message ?? "Unknown error",
  };
}

/**
 * Create initial build validation.json (v0.7.5)
 */
function createBuildValidationJson(
  sandboxDir: string,
  sandboxId: string,
  workflowName: string
): void {
  const validation: BuildValidationManifest = {
    type: "build",
    workflow: workflowName,
    version: "1.0.0",
    sandboxId,
    createdAt: new Date().toISOString(),
    status: "building",
    workflowValidated: false,
    workflowPath: null,
    workflowName: null,
  };
  writeFileSync(
    join(sandboxDir, "validation.json"),
    JSON.stringify(validation, null, 2),
    "utf-8"
  );
}

/**
 * Read build validation.json synchronously (v0.7.5)
 */
function readBuildValidationSync(
  sandboxDir: string
): BuildValidationManifest | undefined {
  try {
    const { readFileSync } = require("node:fs");
    const content = readFileSync(
      join(sandboxDir, "validation.json"),
      "utf-8"
    ) as string;
    const manifest = JSON.parse(content) as BuildValidationManifest;
    if (manifest.type === "build") {
      return manifest;
    }
    return;
  } catch {
    return;
  }
}

/**
 * Streaming batch executor for wizard use.
 * v0.7.1: Creates sandbox for logging consistency with run command
 * v0.7.5: Uses buildHooks for workflow file validation
 * Returns an async generator that yields StreamingEvents and final result.
 */
export async function* executeStreamingBatch(
  prompt: string,
  workspace: string
): AsyncGenerator<StreamingEvent, StreamingResult> {
  // v0.7.1: Create sandbox for build session (same pattern as run command)
  const { createSandboxDirectories, generateSandboxId } = await import(
    "../utils/sandbox.js"
  );
  const sandboxId = generateSandboxId("build");
  const sandboxDir = join(workspace, "sandbox", sandboxId);
  createSandboxDirectories(workspace, sandboxId);

  // v0.7.5: Create build-type validation.json for build hooks
  createBuildValidationJson(sandboxDir, sandboxId, "untitled");

  // v0.7.5: Set env vars for hooks to find sandbox
  process.env.LOOPLIA_SANDBOX_ID = sandboxId;
  process.env.LOOPLIA_SANDBOX_ROOT = join(workspace, "sandbox");

  // Append sandbox-id to prompt so logger can extract it
  const promptWithSandbox = `${prompt} --sandbox-id ${sandboxId}`;

  // v0.7.5: Pass buildHooks for workflow file validation
  const executor = createClaudeAgentExecutor({
    workspace,
    buildHooks: createBuildHooks(),
  });
  const generator = executor.executePromptStreaming(promptWithSandbox, {
    workspace,
    contentId: sandboxId,
  });

  // Properly capture return value using manual iteration
  let iterResult = await generator.next();
  while (!iterResult.done) {
    yield iterResult.value;
    iterResult = await generator.next();
  }

  // Map executor result to StreamingResult
  const executorResult = iterResult.value;

  // v0.7.5: Handle success with no data by reading validation.json
  if (executorResult.success && !executorResult.data) {
    const validation = readBuildValidationSync(sandboxDir);
    if (validation?.workflowValidated && validation.workflowPath) {
      return {
        success: true,
        data: {
          status: "success",
          workflowPath: validation.workflowPath,
          workflowName: validation.workflowName ?? undefined,
        },
      };
    }
  }

  return {
    success: executorResult.success,
    data: executorResult.data as BuildResult | undefined,
    error: executorResult.error,
  };
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
 * v0.7.5: Uses buildHooks for workflow file validation
 * Returns an async generator that yields StreamingEvents and final result.
 */
export async function* executeInteractiveStreamingBatch(
  prompt: string,
  workspace: string,
  questionCallback?: QuestionCallback
): AsyncGenerator<StreamingEvent, StreamingResult> {
  // v0.7.1: Create sandbox for build session (same pattern as run command)
  const { createSandboxDirectories, generateSandboxId } = await import(
    "../utils/sandbox.js"
  );
  const sandboxId = generateSandboxId("build");
  const sandboxDir = join(workspace, "sandbox", sandboxId);
  createSandboxDirectories(workspace, sandboxId);

  // v0.7.5: Create build-type validation.json for build hooks
  createBuildValidationJson(sandboxDir, sandboxId, "untitled");

  // v0.7.5: Set env vars for hooks to find sandbox
  process.env.LOOPLIA_SANDBOX_ID = sandboxId;
  process.env.LOOPLIA_SANDBOX_ROOT = join(workspace, "sandbox");

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

  // v0.7.5: Pass buildHooks for workflow file validation
  const generator = executeInteractiveQueryStreaming<BuildResult>(
    promptWithSandbox,
    schema as Record<string, unknown>,
    { workspace, buildHooks: createBuildHooks() },
    questionCallback
  );

  // Properly capture return value using manual iteration
  let iterResult = await generator.next();
  while (!iterResult.done) {
    yield iterResult.value;
    iterResult = await generator.next();
  }

  // Map executor result to StreamingResult
  const executorResult = iterResult.value;

  // v0.7.5: Handle success with no data by reading validation.json
  if (executorResult.success && !executorResult.data) {
    const validation = readBuildValidationSync(sandboxDir);
    if (validation?.workflowValidated && validation.workflowPath) {
      return {
        success: true,
        data: {
          status: "success",
          workflowPath: validation.workflowPath,
          workflowName: validation.workflowName ?? undefined,
        },
      };
    }
  }

  if (executorResult.success) {
    return {
      success: true,
      data: executorResult.data,
    };
  }
  return {
    success: false,
    error: { message: executorResult.error?.message ?? "Unknown error" },
  };
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
 * Write artifact to disk if present (v0.7.3: CLI-controlled persistence)
 * Returns the actual file path written, or null if no artifact or write failed
 */
function handleArtifactWrite(
  result: BuildResult,
  workspace: string
): string | null {
  // No artifact provided - backward compatibility
  if (!result.artifact) {
    console.warn("⚠ No artifact in result - workflow may not be saved");
    return null;
  }

  const { filename, content } = result.artifact;

  // Invalid artifact - log warning but don't fail
  if (!(filename && content)) {
    console.warn("⚠ Invalid artifact (missing filename or content)");
    return null;
  }

  // Write the artifact
  const writtenPath = writeWorkflowArtifact(workspace, filename, content);

  if (!writtenPath) {
    // Per spec: write failure for valid artifact should be error, not warning
    console.error("✘ Failed to write workflow artifact");
    return null;
  }

  return writtenPath;
}

/**
 * Render success message with workflow details
 */
function renderSuccessMessage(
  result: BuildResult,
  displayPath: string | null
): void {
  console.log("\n✅ Workflow created successfully");
  if (displayPath) {
    console.log(`Path: ${displayPath}`);
  }
  if (result.workflowName || result.workflowId) {
    const name = result.workflowName ?? result.workflowId;
    console.log("\nRun with:");
    console.log(`  looplia run ${name} --file <content.md>`);
  }
  if (result.stepsCount) {
    console.log(`\nSteps: ${result.stepsCount}`);
  }
}

/**
 * Render the result
 * v0.7.3: Now writes artifact to disk via CLI-controlled persistence
 */
export function renderResult(result: BuildResult, workspace: string): void {
  if (result.status !== "success") {
    console.error(`\n❌ Build failed: ${result.error ?? "Unknown error"}`);
    return;
  }

  // v0.7.3: CLI writes the artifact
  const writtenPath = handleArtifactWrite(result, workspace);

  // Per spec: valid artifact that fails to write should be error status
  const hasValidArtifact =
    result.artifact?.filename && result.artifact?.content;
  if (hasValidArtifact && !writtenPath) {
    console.error("\n❌ Build failed: Unable to save workflow artifact");
    return;
  }

  const displayPath = writtenPath ?? result.workflowPath ?? null;
  renderSuccessMessage(result, displayPath);
}

/**
 * Research and install skills for workflow description (v0.8.0)
 *
 * Searches skills.sh using Vercel's CLI and installs matching skills
 * to the auto-discovery-plugin for use during workflow generation.
 *
 * @param description - Workflow description to search for
 * @param interactive - Whether to prompt for skill selection
 * @returns Names of installed skills
 */
async function researchAndInstallSkills(
  description: string,
  interactive: boolean
): Promise<string[]> {
  // Dynamic imports to avoid loading when not needed
  const {
    searchSkills,
    fetchSkillContent,
    installSkillToAutoDiscovery,
    isSkillAutoDiscovered,
  } = await import("@looplia-core/provider/discovery");

  console.log("Researching skills for workflow...");

  // Search using Vercel's CLI
  const results = await searchSkills(description);

  if (results.length === 0) {
    console.log("No additional skills found, using local catalog");
    return [];
  }

  // Select skills (interactive or auto)
  let selectedSkills: Array<{
    name: string;
    description: string;
    owner: string;
    repo: string;
    installCommand: string;
  }>;
  if (interactive) {
    // In interactive mode, show top 5 and let user see what was found
    console.log(`Found ${results.length} potential skills:`);
    for (const [i, skill] of results.slice(0, 5).entries()) {
      console.log(`  ${i + 1}. ${skill.name} - ${skill.description}`);
    }
    // For now, auto-select top 3 (full interactive selection can be added later)
    selectedSkills = results.slice(0, 3);
    console.log(`Auto-selecting top ${selectedSkills.length} skills...`);
  } else {
    // Auto-select top 3 in batch mode
    selectedSkills = results.slice(0, 3);
  }

  // Install to auto-discovery plugin
  const installedNames: string[] = [];

  for (const skill of selectedSkills) {
    // Skip if already installed
    if (await isSkillAutoDiscovered(skill.name)) {
      console.log(`  Skipped: ${skill.name} (already installed)`);
      installedNames.push(skill.name);
      continue;
    }

    try {
      const content = await fetchSkillContent(
        skill.owner,
        skill.repo,
        skill.name
      );
      await installSkillToAutoDiscovery(skill.name, content);
      installedNames.push(skill.name);
      console.log(`  Installed: ${skill.name}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`  Failed to install ${skill.name}: ${msg}`);
    }
  }

  if (installedNames.length > 0) {
    console.log(`Installed ${installedNames.length} skills for workflow`);
  }

  return installedNames;
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

    // 2. v0.8.0: Skill auto-discovery phase (before registry compilation)
    if (!(parsed.mock || parsed.skipResearch) && parsed.description) {
      try {
        await researchAndInstallSkills(
          parsed.description,
          isInteractive() && !parsed.noInteractive
        );
      } catch {
        // Skill research failure is non-fatal - continue with local skills
        console.warn(
          "Skill research unavailable, continuing with local skills"
        );
      }
    }

    // 3. v0.7.1: Compile local skill catalog (includes auto-discovered)
    if (!parsed.mock) {
      try {
        await compileRegistry({ localOnly: true });
      } catch {
        // Registry compilation failure is non-fatal - continue with existing cache
      }
    }

    // 4. Load settings, inject env vars, validate API key (v0.6.10)
    await initializeCommandEnvironment({ mock: parsed.mock });

    // 4. Build /build prompt
    const prompt = buildPrompt(parsed);

    // 5. Execute
    const result = await executeBuild(prompt, workspace, parsed);

    // 6. Render result (v0.7.3: includes CLI-controlled artifact persistence)
    renderResult(result, workspace);

    if (result.status !== "success") {
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
