/**
 * Build Hooks for SDK (v0.7.5)
 *
 * TypeScript implementation of build validation hooks.
 * These hooks are passed programmatically to SDK query() options
 * and only apply to workflow generation via the `build` command.
 *
 * Unlike run command's workflow-hooks which validate step outputs,
 * build hooks validate the generated workflow file itself.
 *
 * @see packages/provider/src/claude-agent-sdk/config.ts
 */

import { readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  HookCallback,
  HookCallbackMatcher,
  HookEvent,
  HookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";
import { parseWorkflow } from "@looplia-core/core";
import { getLoopliaPluginPath } from "../../bootstrap";

/** Enable debug logging via LOOPLIA_DEBUG=1 */
const DEBUG = process.env.LOOPLIA_DEBUG === "1";

/**
 * Build validation manifest structure
 * Different from run command's ValidationManifest - tracks workflow file validation
 */
export type BuildValidationManifest = {
  type: "build";
  workflow: string;
  version: string;
  sandboxId: string;
  createdAt: string;
  status: "building" | "validated" | "failed";
  workflowValidated: boolean;
  workflowPath: string | null;
  workflowName: string | null;
  error?: string;
};

type HookContext = {
  sandboxId?: string;
  sandboxRoot?: string;
};

/**
 * Stop hook input from SDK
 */
type StopHookInput = {
  hook_event_name?: string;
  stop_hook_active?: boolean;
  session_id?: string;
  cwd?: string;
};

/**
 * PostToolUse hook input for Write tool
 */
type WriteToolInput = {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    content?: string;
  };
  tool_response?: unknown;
};

/**
 * Check if a file path is a workflow file
 */
export function isWorkflowFile(filePath: string | undefined): boolean {
  if (!filePath) {
    return false;
  }
  return filePath.includes("/workflows/") && filePath.endsWith(".md");
}

/**
 * Resolve sandbox root directory
 */
function resolveSandboxRoot(context?: HookContext): string {
  return context?.sandboxRoot ?? join(getLoopliaPluginPath(), "sandbox");
}

/**
 * Find the most recently modified build sandbox directory
 * Fallback when sandboxId is not provided via environment variable
 */
async function findMostRecentBuildSandbox(
  sandboxRoot: string
): Promise<string | undefined> {
  try {
    const entries = await readdir(sandboxRoot, { withFileTypes: true });
    const dirs = entries.filter(
      (e) => e.isDirectory() && e.name.startsWith("build-")
    );

    if (dirs.length === 0) {
      return;
    }

    const dirStats = await Promise.all(
      dirs.map(async (dir) => {
        const dirPath = join(sandboxRoot, dir.name);
        const dirStat = await stat(dirPath);
        return { path: dirPath, mtime: dirStat.mtime.getTime() };
      })
    );

    dirStats.sort((a, b) => b.mtime - a.mtime);
    return dirStats[0]?.path;
  } catch {
    return;
  }
}

/**
 * Resolve sandbox directory from context
 * Falls back to most recent build sandbox if sandboxId not provided
 */
async function resolveSandboxDir(
  context?: HookContext
): Promise<string | undefined> {
  const sandboxRoot = resolveSandboxRoot(context);
  if (context?.sandboxId) {
    return join(sandboxRoot, context.sandboxId);
  }
  // Fallback: find most recent build sandbox
  return await findMostRecentBuildSandbox(sandboxRoot);
}

/**
 * Read build validation manifest from sandbox
 */
export async function readBuildValidation(
  context?: HookContext
): Promise<BuildValidationManifest | undefined> {
  const sandboxDir = await resolveSandboxDir(context);
  if (!sandboxDir) {
    if (DEBUG) {
      console.error("[build-hooks] readBuildValidation: no sandbox dir found");
    }
    return;
  }

  const validationPath = join(sandboxDir, "validation.json");
  try {
    const content = await readFile(validationPath, "utf-8");
    const manifest = JSON.parse(content) as BuildValidationManifest;
    // Only return if it's a build-type manifest
    if (manifest.type === "build") {
      return manifest;
    }
    return;
  } catch {
    return;
  }
}

/**
 * Update build validation manifest
 */
export async function updateBuildValidation(
  context: HookContext,
  updates: Partial<BuildValidationManifest>
): Promise<void> {
  const sandboxDir = await resolveSandboxDir(context);
  if (!sandboxDir) {
    if (DEBUG) {
      console.error(
        "[build-hooks] updateBuildValidation: no sandbox dir found"
      );
    }
    return;
  }

  const validationPath = join(sandboxDir, "validation.json");
  try {
    const content = await readFile(validationPath, "utf-8");
    const manifest = JSON.parse(content) as BuildValidationManifest;

    const updated: BuildValidationManifest = {
      ...manifest,
      ...updates,
    };

    const tempPath = `${validationPath}.tmp`;
    await writeFile(tempPath, JSON.stringify(updated, null, 2), "utf-8");
    await rename(tempPath, validationPath);

    if (DEBUG) {
      console.error(
        `[build-hooks] updateBuildValidation: updated ${validationPath}`
      );
    }
  } catch (error) {
    if (DEBUG) {
      console.error("[build-hooks] updateBuildValidation error:", error);
    }
    // Ignore errors - validation may not exist yet
  }
}

/**
 * Build Validate Hook - Validate workflow files when written
 *
 * Triggered after the Write tool completes.
 * Validates workflow files written to ~/.looplia/workflows/*.md
 * using the parseWorkflow() function from @looplia-core/core.
 */
export function createBuildValidateHook(context?: HookContext): HookCallback {
  return async (input: Record<string, unknown>): Promise<HookJSONOutput> => {
    if (DEBUG) {
      console.error(
        "[build-hooks] PostToolUse fired:",
        JSON.stringify(input).slice(0, 200)
      );
    }

    const hookInput = input as WriteToolInput;
    const filePath = hookInput.tool_input?.file_path;
    const content = hookInput.tool_input?.content;

    if (DEBUG) {
      console.error("[build-hooks] file_path:", filePath);
      console.error("[build-hooks] isWorkflowFile:", isWorkflowFile(filePath));
    }

    // Only validate workflow files
    if (!isWorkflowFile(filePath)) {
      return {};
    }

    if (!content) {
      return {
        decision: "block",
        reason:
          "Workflow validation failed: No content provided. Please write the workflow content to the file.",
      };
    }

    try {
      // parseWorkflow validates: YAML frontmatter, required fields, steps, dependencies
      const parsed = parseWorkflow(content);

      // Update validation.json with success
      await updateBuildValidation(context ?? {}, {
        workflowValidated: true,
        workflowPath: filePath,
        workflowName: parsed.definition.name,
        status: "validated",
      });

      console.error(`✓ Workflow validated: ${parsed.definition.name}`);
      return {};
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Update validation.json with failure
      await updateBuildValidation(context ?? {}, {
        workflowValidated: false,
        status: "failed",
        error: errorMessage,
      });

      // Block write with actionable error message
      return {
        decision: "block",
        reason: `Workflow validation failed: ${errorMessage}\n\nPlease fix the workflow file and try writing it again. Ensure the workflow has valid YAML frontmatter with 'name', 'description', and 'steps' fields.`,
      };
    }
  };
}

/**
 * Build Stop Guard Hook - Block if workflow not validated
 *
 * Triggered when the agent attempts to stop.
 * Blocks execution if the workflow file has not been validated.
 */
export function createBuildStopGuardHook(context?: HookContext): HookCallback {
  return async (input: Record<string, unknown>): Promise<HookJSONOutput> => {
    if (DEBUG) {
      console.error(
        "[build-hooks] Stop/SubagentStop fired:",
        JSON.stringify(input).slice(0, 200)
      );
    }

    const hookInput = input as StopHookInput;

    // Prevent infinite loop - SDK sets stop_hook_active when re-entering
    if (hookInput.stop_hook_active === true) {
      return {};
    }

    const validation = await readBuildValidation(context);

    if (DEBUG) {
      console.error("[build-hooks] validation:", JSON.stringify(validation));
    }

    // If no validation manifest, allow stop (may be non-build context)
    if (!validation) {
      return {};
    }

    if (!validation.workflowValidated) {
      return {
        decision: "block",
        reason:
          "Build incomplete. The workflow file has not been validated yet. Please write the workflow to ~/.looplia/workflows/ with valid YAML frontmatter including 'name', 'description', and 'steps' fields. Do not stop until the workflow is successfully created.",
      };
    }

    // Workflow validated - allow stop
    return {};
  };
}

/**
 * Create build validation hooks for SDK query options
 *
 * Returns a hooks configuration object that can be passed to
 * SDK query() via config.buildHooks.
 *
 * @example
 * ```typescript
 * import { createBuildHooks } from '@looplia-core/provider/claude-agent-sdk';
 *
 * const executor = createClaudeAgentExecutor({
 *   workspace,
 *   buildHooks: createBuildHooks()
 * });
 * ```
 */
export function createBuildHooks(): Partial<
  Record<HookEvent, HookCallbackMatcher[]>
> {
  const context: HookContext = {
    sandboxId: process.env.LOOPLIA_SANDBOX_ID,
    sandboxRoot: process.env.LOOPLIA_SANDBOX_ROOT,
  };
  return {
    Stop: [{ hooks: [createBuildStopGuardHook(context)] }],
    SubagentStop: [{ hooks: [createBuildStopGuardHook(context)] }],
    PostToolUse: [
      { matcher: "Write", hooks: [createBuildValidateHook(context)] },
    ],
  };
}
