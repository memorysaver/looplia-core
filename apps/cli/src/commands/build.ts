/**
 * Build Command (v0.6.1) - Thin Wrapper
 *
 * Build a workflow from natural language by injecting /build command into the agent.
 * All workflow building logic is in the 3 builder skills:
 * - plugin-registry-scanner
 * - skill-capability-matcher
 * - workflow-schema-composer
 *
 * @see docs/DESIGN-0.6.1.md § 5 CLI Command
 * @see plugins/looplia-core/commands/build.md
 */

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import type { StreamingEvent } from "@looplia-core/core";
import { createClaudeAgentExecutor } from "@looplia-core/provider/claude-agent-sdk";

import { renderStreamingQuery } from "../components";
import { isInteractive } from "../utils/terminal";

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
    result.output = nextArg;
  } else if (arg === "--name" || arg === "-n") {
    result.name = nextArg;
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
  let prompt = "/build";

  if (args.description) {
    const sanitized = args.description
      .trim()
      .slice(0, 500)
      .replace(/[\n\r]/g, " ");
    prompt += ` ${sanitized}`;
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
 * Execute with streaming UI.
 * Wraps streaming execution with error handling and proper session tracking.
 */
async function executeStreaming(
  prompt: string,
  workspace: string
): Promise<BuildResult> {
  try {
    const contentId = crypto.randomUUID();
    const executor = createClaudeAgentExecutor({ workspace });

    const generator = executor.executePromptStreaming(prompt, {
      workspace,
      contentId,
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
 * @param executor Optional executor for dependency injection (testing)
 */
export async function executeBatch(
  prompt: string,
  workspace: string,
  executor?: BuildExecutor
): Promise<BuildResult> {
  console.error("⏳ Building workflow...");

  const contentId = crypto.randomUUID();
  const exec = executor ?? createClaudeAgentExecutor({ workspace });
  const result = await exec.executePrompt(prompt, {
    workspace,
    contentId,
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

  if (isInteractive() && !parsed.noInteractive) {
    return executeStreaming(prompt, workspace);
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
    // 1. Validate environment
    validateEnvironment(parsed.mock);

    // 2. Ensure workspace
    const workspace = ensureWorkspace(parsed.mock);

    // 3. Build /build prompt
    const prompt = buildPrompt(parsed);

    // 4. Execute
    const result = await executeBuild(prompt, workspace, parsed);

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
