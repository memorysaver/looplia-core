/**
 * Run Command (v0.5.2) - Thin Wrapper
 *
 * Execute a workflow by injecting /run command into the agent.
 * All workflow logic is in the workflow-executor skill.
 *
 * @see docs/DESIGN-0.5.2.md § 7.3 CLI as Thin Wrapper
 * @see plugins/looplia-core/skills/workflow-executor/SKILL.md
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import type { StreamingEvent } from "@looplia-core/core";
import {
  createClaudeAgentExecutor,
  type WorkflowResult,
} from "@looplia-core/provider/claude-agent-sdk";

import { renderStreamingQuery } from "../components";
import { isInteractive } from "../utils/terminal";

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
 */
function ensureWorkspace(): string {
  const workspace = getWorkspacePath();

  if (!existsSync(workspace)) {
    console.error("Workspace not initialized. Run: looplia init");
    process.exit(1);
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
 */
function buildRunPrompt(args: RunArgs): string {
  if (args.sandboxId) {
    return `/run ${args.workflowId} --sandbox-id ${args.sandboxId}`;
  }

  if (args.file) {
    const absolutePath = resolve(args.file);
    return `/run ${args.workflowId} --file ${absolutePath}`;
  }

  throw new Error("Either --file or --sandbox-id is required");
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
 * Main entry point for run command (v0.5.2 thin wrapper)
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
    const workspace = ensureWorkspace();

    // 3. Build /run prompt
    const prompt = buildRunPrompt(parsed);

    // 4. Execute
    let result: WorkflowResult;

    if (parsed.mock) {
      result = executeMock(parsed);
    } else if (isInteractive() && !parsed.noStreaming) {
      result = await executeStreaming(prompt, workspace, parsed.workflowId);
    } else {
      result = await executeBatch(prompt, workspace, parsed.workflowId);
    }

    // 5. Render result
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
