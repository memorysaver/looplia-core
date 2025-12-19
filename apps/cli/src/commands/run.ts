/**
 * Run Command (v0.6.0) - Thin Wrapper
 *
 * Execute a workflow by injecting /run command into the agent.
 * All workflow logic is in the workflow-executor skill.
 *
 * @see docs/DESIGN-0.5.2.md § 7.3 CLI as Thin Wrapper
 * @see plugins/looplia-core/skills/workflow-executor/SKILL.md
 */

import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import type { StreamingEvent } from "@looplia-core/core";
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

/**
 * Create sandbox folder structure and copy content file
 * Returns the sandbox ID
 * @throws Error if sandbox creation or file copy fails
 */
function createSandbox(workspace: string, filePath: string): string {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create sandbox "${sandboxId}": ${message}`);
  }

  return sandboxId;
}

/**
 * Parsed command arguments
 */
type RunArgs = {
  workflowId: string;
  file?: string;
  sandboxId?: string;
  mock: boolean;
  noStreaming: boolean;
  help: boolean;
};

/**
 * Check if argument is a flag that takes a value
 */
function isValueFlag(arg: string): boolean {
  return (
    arg === "--file" ||
    arg === "-f" ||
    arg === "--sandbox" ||
    arg === "-s" ||
    arg === "--sandbox-id"
  );
}

/**
 * Process a single argument and its value
 */
function processArg(
  result: RunArgs,
  arg: string,
  nextArg: string | undefined
): void {
  if (arg === "--help" || arg === "-h") {
    result.help = true;
  } else if (arg === "--file" || arg === "-f") {
    result.file = nextArg;
  } else if (arg === "--sandbox-id" || arg === "--sandbox" || arg === "-s") {
    result.sandboxId = nextArg;
  } else if (arg === "--mock") {
    result.mock = true;
  } else if (arg === "--no-streaming") {
    result.noStreaming = true;
  } else if (!(arg.startsWith("-") || result.workflowId)) {
    result.workflowId = arg;
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
 * Print help message
 */
function printHelp(): void {
  console.log(`
Usage: looplia run <workflow-id> [options]

Execute a workflow on content.

Arguments:
  workflow-id           Name of workflow (e.g., "writing-kit")

Options:
  --file, -f <path>       Path to content file (creates new sandbox)
  --sandbox-id, -s <id>   Resume existing sandbox
  --mock                  Use mock mode (no API calls)
  --no-streaming          Disable streaming output
  --help, -h              Show this help

Examples:
  looplia run writing-kit --file article.md
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
  const executor = createClaudeAgentExecutor({ workspace });

  const generator = executor.executePromptStreaming(prompt, {
    workspace,
    contentId: "",
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

  const executor = createClaudeAgentExecutor({ workspace });
  const result = await executor.executePrompt(prompt, {
    workspace,
    contentId: "",
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
 * Resolve or create sandbox ID based on args
 * Returns sandbox ID or exits on error
 */
function resolveSandboxId(workspace: string, parsed: RunArgs): string {
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

  if (parsed.file) {
    // Create new sandbox
    if (!existsSync(parsed.file)) {
      console.error(`Error: File not found: ${parsed.file}`);
      process.exit(1);
    }
    const sandboxId = createSandbox(workspace, parsed.file);
    console.error(`Created sandbox: ${sandboxId}`);
    return sandboxId;
  }

  throw new Error("Either --file or --sandbox-id is required");
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
 * Main entry point for run command (v0.6.0 thin wrapper)
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

  if (!(parsed.file || parsed.sandboxId)) {
    console.error("Error: Either --file or --sandbox-id is required");
    printHelp();
    process.exit(1);
  }

  try {
    // 1. Validate environment
    validateEnvironment(parsed.mock);

    // 2. Ensure workspace
    const workspace = ensureWorkspace(parsed.mock);

    // 3. Resolve or create sandbox
    const sandboxId = resolveSandboxId(workspace, parsed);

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
