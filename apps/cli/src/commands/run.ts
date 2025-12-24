/**
 * Run Command (v0.6.3) - Thin Wrapper
 *
 * Execute a workflow by injecting /run command into the agent.
 * All workflow logic is in the workflow-executor skill.
 *
 * v0.6.3: Named inputs with --input name=value syntax
 *
 * @see docs/DESIGN-0.6.3.md
 * @see plugins/looplia-core/skills/workflow-executor/SKILL.md
 */

import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import {
  isInputlessWorkflow,
  parseWorkflow,
  type StreamingEvent,
} from "@looplia-core/core";
import {
  createClaudeAgentExecutor,
  type WorkflowResult,
} from "@looplia-core/provider/claude-agent-sdk";

import { renderStreamingQuery } from "../components";
import { isInteractive } from "../utils/terminal";

/**
 * Generate a random 4-character hex suffix for sandbox IDs
 * Uses crypto.randomBytes for secure random generation
 */
function generateRandomSuffix(): string {
  return randomBytes(2).toString("hex");
}

/**
 * Generate a slug from filename for sandbox ID
 */
function generateSlugFromFile(filePath: string): string {
  const filename = basename(filePath, ".md");
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30);
}

/**
 * Generate sandbox ID from file path
 * Format: {slug}-{YYYY-MM-DD}-{random4chars}
 */
function generateSandboxId(filePath: string): string {
  const slug = generateSlugFromFile(filePath);
  const date = new Date().toISOString().split("T")[0];
  const suffix = generateRandomSuffix();
  return `${slug}-${date}-${suffix}`;
}

/** Standard filename for content input in sandbox */
const SANDBOX_CONTENT_FILENAME = "content.md";

/** Validation schema version */
const VALIDATION_SCHEMA_VERSION = "1.0.0";

/**
 * Structure of validation.json file
 * Tracks workflow execution state per sandbox
 */
export type ValidationJson = {
  workflow: string;
  version: string;
  sandboxId: string;
  createdAt: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  steps: Record<string, { validated: boolean; validatedAt?: string }>;
};

/**
 * Create initial validation.json for a new sandbox
 * This ensures deterministic behavior - the workflow-executor skill
 * can always detect the sandbox exists and will populate steps from workflow
 */
/** @internal Exported for testing */
export function createInitialValidationJson(
  sandboxDir: string,
  sandboxId: string,
  workflowId: string
): void {
  const validation: ValidationJson = {
    workflow: workflowId,
    version: VALIDATION_SCHEMA_VERSION,
    sandboxId,
    createdAt: new Date().toISOString(),
    status: "pending",
    steps: {},
  };
  writeFileSync(
    join(sandboxDir, "validation.json"),
    JSON.stringify(validation, null, 2),
    "utf-8"
  );
}

/**
 * Create sandbox folder structure and copy content file
 * Returns the sandbox ID
 * @throws Error if sandbox creation or file copy fails
 */
function createSandbox(
  workspace: string,
  filePath: string,
  workflowId: string
): string {
  const sandboxId = generateSandboxId(filePath);
  const sandboxDir = join(workspace, "sandbox", sandboxId);

  try {
    // Create sandbox folder structure
    mkdirSync(join(sandboxDir, "inputs"), { recursive: true });
    mkdirSync(join(sandboxDir, "outputs"), { recursive: true });
    mkdirSync(join(sandboxDir, "logs"), { recursive: true });

    // Copy content file to inputs/content.md
    const absolutePath = resolve(filePath);
    copyFileSync(
      absolutePath,
      join(sandboxDir, "inputs", SANDBOX_CONTENT_FILENAME)
    );

    // Create initial validation.json so workflow-executor can detect sandbox
    createInitialValidationJson(sandboxDir, sandboxId, workflowId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create sandbox "${sandboxId}": ${message}`);
  }

  return sandboxId;
}

/**
 * Generate sandbox ID from workflow ID (for input-less workflows)
 * Format: {workflow-slug}-{YYYY-MM-DD}-{random4chars}
 */
function generateInputlessSandboxId(workflowId: string): string {
  const slug = workflowId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30);
  const date = new Date().toISOString().split("T")[0];
  const suffix = generateRandomSuffix();
  return `${slug}-${date}-${suffix}`;
}

/**
 * Create sandbox with named inputs (v0.6.3)
 * Supports 0, 1, or N named inputs
 * @throws Error if sandbox creation fails
 */
function createSandboxWithInputs(
  workspace: string,
  workflowId: string,
  inputs: Record<string, ParsedInput>
): string {
  // Use first input name for slug, or workflow name if no inputs
  const inputNames = Object.keys(inputs);
  const slugSource =
    inputNames.length > 0 ? (inputNames[0] ?? workflowId) : workflowId;
  const sandboxId = generateInputlessSandboxId(slugSource);
  const sandboxDir = join(workspace, "sandbox", sandboxId);

  try {
    // Create sandbox folder structure
    mkdirSync(join(sandboxDir, "inputs"), { recursive: true });
    mkdirSync(join(sandboxDir, "outputs"), { recursive: true });
    mkdirSync(join(sandboxDir, "logs"), { recursive: true });

    // Write each input to inputs/{name}.md or inputs/{name}.json
    for (const [name, parsedInput] of Object.entries(inputs)) {
      if (parsedInput.type === "json") {
        writeFileSync(
          join(sandboxDir, "inputs", `${name}.json`),
          parsedInput.value,
          "utf-8"
        );
      } else {
        // File input - copy the file
        const absolutePath = resolve(parsedInput.value);
        if (!existsSync(absolutePath)) {
          throw new Error(`Input file not found: ${parsedInput.value}`);
        }
        copyFileSync(absolutePath, join(sandboxDir, "inputs", `${name}.md`));
      }
    }

    // Create initial validation.json
    createInitialValidationJson(sandboxDir, sandboxId, workflowId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create sandbox "${sandboxId}": ${message}`);
  }

  return sandboxId;
}

/**
 * Create an input-less sandbox (v0.6.3)
 * For workflows that don't require any input files
 */
function createInputlessSandbox(workspace: string, workflowId: string): string {
  const sandboxId = generateInputlessSandboxId(workflowId);
  const sandboxDir = join(workspace, "sandbox", sandboxId);

  try {
    mkdirSync(join(sandboxDir, "inputs"), { recursive: true });
    mkdirSync(join(sandboxDir, "outputs"), { recursive: true });
    mkdirSync(join(sandboxDir, "logs"), { recursive: true });

    createInitialValidationJson(sandboxDir, sandboxId, workflowId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create sandbox "${sandboxId}": ${message}`);
  }

  return sandboxId;
}

/**
 * Parsed input value (v0.6.3)
 * Supports both file paths and inline JSON
 */
type ParsedInput = {
  type: "json" | "file";
  value: string;
};

/**
 * Parsed command arguments (v0.6.3)
 */
type RunArgs = {
  workflowId: string;
  file?: string;
  inputs?: Record<string, ParsedInput>;
  sandboxId?: string;
  mock: boolean;
  noStreaming: boolean;
  help: boolean;
};

/**
 * Check if a value looks like inline JSON
 */
function isJsonValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/**
 * Parse an input value into type and content
 */
function parseInputValue(value: string): ParsedInput {
  if (isJsonValue(value)) {
    // Validate JSON by parsing it
    try {
      JSON.parse(value);
    } catch {
      throw new Error(`Invalid JSON in input value: ${value}`);
    }
    return { type: "json", value };
  }
  return { type: "file", value };
}

/**
 * Check if argument is a flag that takes a value
 */
function isValueFlag(arg: string): boolean {
  return (
    arg === "--file" ||
    arg === "-f" ||
    arg === "--input" ||
    arg === "-i" ||
    arg === "--sandbox" ||
    arg === "-s" ||
    arg === "--sandbox-id"
  );
}

/**
 * Parse --input argument in name=value format
 */
function parseInputArg(value: string): {
  name: string;
  parsedValue: ParsedInput;
} {
  const equalsIndex = value.indexOf("=");
  if (equalsIndex === -1) {
    throw new Error(`Invalid input format: "${value}". Expected: name=value`);
  }
  const name = value.slice(0, equalsIndex);
  const rawValue = value.slice(equalsIndex + 1);
  if (!name) {
    throw new Error(`Invalid input format: "${value}". Name cannot be empty`);
  }
  if (!rawValue) {
    throw new Error(`Invalid input format: "${value}". Value cannot be empty`);
  }
  return { name, parsedValue: parseInputValue(rawValue) };
}

/** Handle --input argument processing */
function handleInputArg(result: RunArgs, nextArg: string | undefined): void {
  if (!nextArg) {
    throw new Error("--input requires a value in format: name=value");
  }
  const { name, parsedValue } = parseInputArg(nextArg);
  result.inputs = result.inputs ?? {};
  result.inputs[name] = parsedValue;
}

/**
 * Process a single argument and its value
 */
function processArg(
  result: RunArgs,
  arg: string,
  nextArg: string | undefined
): void {
  switch (arg) {
    case "--help":
    case "-h":
      result.help = true;
      break;
    case "--file":
    case "-f":
      result.file = nextArg;
      break;
    case "--input":
    case "-i":
      handleInputArg(result, nextArg);
      break;
    case "--sandbox-id":
    case "--sandbox":
    case "-s":
      result.sandboxId = nextArg;
      break;
    case "--mock":
      result.mock = true;
      break;
    case "--no-streaming":
      result.noStreaming = true;
      break;
    default:
      if (!(arg.startsWith("-") || result.workflowId)) {
        result.workflowId = arg;
      }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): RunArgs {
  const result: RunArgs = {
    workflowId: "",
    mock: false,
    noStreaming: false,
    help: false,
  };

  let skipNext = false;
  for (const [index, arg] of args.entries()) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    const nextArg = args[index + 1];
    processArg(result, arg, nextArg);

    if (isValueFlag(arg)) {
      skipNext = true;
    }
  }

  return result;
}

/**
 * Print help message (v0.6.3)
 */
function printHelp(): void {
  console.log(`
Usage: looplia run <workflow-id> [options]

Execute a workflow on content.

Arguments:
  workflow-id               Name of workflow (e.g., "writing-kit", "hn-reporter")

Options:
  --file, -f <path>         Path to content file (creates new sandbox, legacy)
  --input, -i <name=value>  Named input (can specify multiple times)
                            Value can be a file path or inline JSON
  --sandbox-id, -s <id>     Resume existing sandbox
  --mock                    Use mock mode (no API calls)
  --no-streaming            Disable streaming output
  --help, -h                Show this help

Examples:
  # Single file input (legacy)
  looplia run writing-kit --file article.md

  # Named inputs (v0.6.3)
  looplia run video-comparison --input video1=vid1.md --input video2=vid2.md

  # Inline JSON input
  looplia run config-processor --input config='{"key":"value"}'

  # Input-less workflow (no input required)
  looplia run hn-reporter

  # Resume existing sandbox
  looplia run writing-kit --sandbox-id text-2025-12-18-abc123
`);
}

/**
 * Get workspace path
 */
function getWorkspacePath(): string {
  return resolve(homedir(), ".looplia");
}

/**
 * Ensure workspace is initialized
 * In mock mode, auto-create minimal workspace structure
 */
function ensureWorkspace(mock: boolean): string {
  const workspace = getWorkspacePath();

  if (!existsSync(workspace)) {
    if (mock) {
      // In mock mode, auto-create minimal workspace structure
      mkdirSync(join(workspace, "sandbox"), { recursive: true });
    } else {
      console.error("Workspace not initialized. Run: looplia init");
      process.exit(1);
    }
  }

  return workspace;
}

/**
 * Validate environment (API key)
 */
function validateEnvironment(mock: boolean): void {
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
 * Build the /run prompt to inject into the agent
 * When sandboxId is provided (either from --sandbox-id or from createSandbox),
 * always use sandbox-id format so the logger can extract it
 */
function buildRunPrompt(workflowId: string, sandboxId: string): string {
  return `/run ${workflowId} --sandbox-id ${sandboxId}`;
}

/**
 * Check if a workflow supports input-less execution (v0.6.3)
 * Parses the workflow definition and checks if it uses input-less capable skills.
 *
 * @param workspace - Workspace path (~/.looplia)
 * @param workflowId - Workflow ID (e.g., "hn-reporter")
 * @returns true if workflow can run without inputs, false otherwise
 */
function checkWorkflowInputless(
  workspace: string,
  workflowId: string
): boolean {
  const workflowPath = join(workspace, "workflows", `${workflowId}.md`);

  if (!existsSync(workflowPath)) {
    // Workflow doesn't exist - let it fail later with proper error
    return false;
  }

  try {
    const content = readFileSync(workflowPath, "utf-8");
    const parsed = parseWorkflow(content);
    return isInputlessWorkflow(parsed.definition);
  } catch {
    // Parse error - let it fail later with proper error
    return false;
  }
}

/**
 * Execute in mock mode
 */
function executeMock(args: RunArgs): WorkflowResult {
  console.error("⏳ Processing (mock)...");
  return {
    status: "success",
    workflowId: args.workflowId,
    sessionId: `mock-${Date.now()}`,
    artifact: {
      mock: true,
      message: "Mock execution - use real API for actual workflow output",
    },
  };
}

/**
 * Execute with streaming UI
 */
async function executeStreaming(
  prompt: string,
  workspace: string,
  workflowId: string
): Promise<WorkflowResult> {
  const contentId = crypto.randomUUID();
  const executor = createClaudeAgentExecutor({ workspace });

  const generator = executor.executePromptStreaming(prompt, {
    workspace,
    contentId,
  });

  // Format workflow name for display (e.g., "writing-kit" -> "Writing Kit")
  const title = workflowId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const { result, error } = await renderStreamingQuery<WorkflowResult>({
    title,
    subtitle: `Workflow: ${workflowId}`,
    streamGenerator: () =>
      generator as AsyncGenerator<
        StreamingEvent,
        { success: boolean; data?: WorkflowResult; error?: { message: string } }
      >,
  });

  if (error) {
    return {
      status: "error",
      workflowId,
      error: error.message,
    };
  }

  return (
    result ?? {
      status: "error",
      workflowId,
      error: "No result received",
    }
  );
}

/**
 * Execute in batch mode (non-streaming)
 */
async function executeBatch(
  prompt: string,
  workspace: string,
  workflowId: string
): Promise<WorkflowResult> {
  console.error("⏳ Processing...");

  const contentId = crypto.randomUUID();
  const executor = createClaudeAgentExecutor({ workspace });
  const result = await executor.executePrompt(prompt, {
    workspace,
    contentId,
  });

  if (result.success && result.data) {
    return result.data;
  }

  return {
    status: "error",
    workflowId,
    error: result.error?.message ?? "Unknown error",
  };
}

/**
 * Resolve or create sandbox ID based on args (v0.6.3)
 * Supports: --sandbox-id, --file, --input, or no input (input-less workflow)
 * Returns sandbox ID or exits on error
 */
function resolveSandboxId(
  workspace: string,
  parsed: RunArgs,
  allowInputless: boolean
): string {
  if (parsed.sandboxId) {
    // Resume existing sandbox
    const sandboxDir = join(workspace, "sandbox", parsed.sandboxId);
    if (!existsSync(sandboxDir)) {
      console.error(`Error: Sandbox not found: ${parsed.sandboxId}`);
      console.error(`Path: ${sandboxDir}`);
      process.exit(1);
    }
    return parsed.sandboxId;
  }

  if (parsed.inputs && Object.keys(parsed.inputs).length > 0) {
    // v0.6.3: Create sandbox with named inputs
    const sandboxId = createSandboxWithInputs(
      workspace,
      parsed.workflowId,
      parsed.inputs
    );
    console.error(`Created sandbox: ${sandboxId}`);
    return sandboxId;
  }

  if (parsed.file) {
    // Legacy: Create new sandbox from single file
    if (!existsSync(parsed.file)) {
      console.error(`Error: File not found: ${parsed.file}`);
      process.exit(1);
    }
    const sandboxId = createSandbox(workspace, parsed.file, parsed.workflowId);
    console.error(`Created sandbox: ${sandboxId}`);
    return sandboxId;
  }

  if (allowInputless) {
    // v0.6.3: Create input-less sandbox
    const sandboxId = createInputlessSandbox(workspace, parsed.workflowId);
    console.error(`Created input-less sandbox: ${sandboxId}`);
    return sandboxId;
  }

  throw new Error(
    "Either --file, --input, or --sandbox-id is required for this workflow"
  );
}

/**
 * Execute workflow based on mode
 */
function executeWorkflow(
  prompt: string,
  workspace: string,
  workflowId: string,
  parsed: RunArgs
): Promise<WorkflowResult> {
  if (parsed.mock) {
    return Promise.resolve(executeMock(parsed));
  }

  if (isInteractive() && !parsed.noStreaming) {
    return executeStreaming(prompt, workspace, workflowId);
  }

  return executeBatch(prompt, workspace, workflowId);
}

/**
 * Render the result
 */
function renderResult(result: WorkflowResult): void {
  if (result.status === "success") {
    console.log("\n✅ Workflow completed successfully");
    if (result.sessionId) {
      console.log(`Session: ${result.sessionId}`);
    }
    if (result.artifact) {
      console.log("\nResult:");
      console.log(JSON.stringify(result.artifact, null, 2));
    }
  } else {
    console.error(`\n❌ Workflow failed: ${result.error ?? "Unknown error"}`);
  }
}

/**
 * Main entry point for run command (v0.6.3 thin wrapper)
 */
export async function runRunCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  if (!parsed.workflowId) {
    console.error("Error: workflow-id is required");
    printHelp();
    process.exit(1);
  }

  try {
    // 1. Ensure workspace (needed to check workflow definition)
    const workspace = ensureWorkspace(parsed.mock);

    // 2. Resolve or create sandbox (validates inputs before API key check)
    // v0.6.3: Check if workflow supports input-less execution
    const allowInputless = checkWorkflowInputless(workspace, parsed.workflowId);
    const sandboxId = resolveSandboxId(workspace, parsed, allowInputless);

    // 3. Validate environment (after input validation for better error messages)
    validateEnvironment(parsed.mock);

    // 4. Build /run prompt with sandbox ID
    const prompt = buildRunPrompt(parsed.workflowId, sandboxId);

    // 5. Execute
    const result = await executeWorkflow(
      prompt,
      workspace,
      parsed.workflowId,
      parsed
    );

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
