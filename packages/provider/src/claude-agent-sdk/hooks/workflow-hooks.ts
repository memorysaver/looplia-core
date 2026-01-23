/**
 * Workflow Hooks for SDK (v0.7.4)
 *
 * TypeScript implementation of workflow validation hooks.
 * These hooks are passed programmatically to SDK query() options
 * and only apply to workflow execution via the `run` command.
 *
 * Ported from shell script hooks:
 * - stop-guard.sh → stopGuardHook
 * - post-write-validate.sh → postWriteValidateHook
 *
 * @see packages/provider/src/claude-agent-sdk/config.ts
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  HookCallback,
  HookCallbackMatcher,
  HookEvent,
  HookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";
import { getLoopliaPluginPath } from "../../bootstrap";

/** Regex for stripping .json extension from filenames */
const JSON_EXTENSION_REGEX = /\.json$/;

/**
 * Validation manifest structure from sandbox/validation.json
 */
type ValidationManifest = {
  workflow: string;
  version?: string;
  sandboxId?: string;
  createdAt?: string;
  status?: "pending" | "in_progress" | "completed" | "failed";
  steps: Record<
    string,
    {
      output?: string;
      validate?: Record<string, unknown>;
      validated: boolean;
      validatedAt?: string;
    }
  >;
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
 * Find the most recently modified sandbox directory
 */
async function findMostRecentSandbox(): Promise<string | undefined> {
  const sandboxRoot = join(getLoopliaPluginPath(), "sandbox");

  try {
    const entries = await readdir(sandboxRoot, { withFileTypes: true });
    const dirs = entries.filter(
      (e) => e.isDirectory() && !e.name.startsWith(".")
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
 * Read validation manifest from sandbox
 */
async function readValidationManifest(
  sandboxDir: string
): Promise<ValidationManifest | undefined> {
  const validationPath = join(sandboxDir, "validation.json");
  try {
    const content = await readFile(validationPath, "utf-8");
    return JSON.parse(content) as ValidationManifest;
  } catch {
    return;
  }
}

/**
 * Check for missing output files
 */
async function findMissingOutputs(
  sandboxDir: string,
  steps: ValidationManifest["steps"]
): Promise<string[]> {
  const missing: string[] = [];

  for (const [stepId, stepState] of Object.entries(steps)) {
    const outputPath = stepState.output;
    if (!outputPath) {
      continue;
    }

    const fullPath = join(sandboxDir, outputPath);
    try {
      await stat(fullPath);
    } catch {
      missing.push(stepId);
    }
  }

  return missing;
}

/**
 * Find unvalidated steps
 */
function findPendingSteps(steps: ValidationManifest["steps"]): string[] {
  return Object.entries(steps)
    .filter(([, stepState]) => !stepState.validated)
    .map(([stepId]) => stepId);
}

/**
 * Stop Guard Hook - Block if workflow incomplete
 *
 * Triggered when the main agent attempts to stop.
 * Blocks execution if:
 * 1. Any required output files are missing
 * 2. Any steps have validated: false
 *
 * Based on shell script: plugins/looplia-core/scripts/hooks/stop-guard.sh
 */
export const stopGuardHook: HookCallback = async (
  input: Record<string, unknown>
): Promise<HookJSONOutput> => {
  const hookInput = input as StopHookInput;

  // Prevent infinite loop - SDK sets stop_hook_active when re-entering
  if (hookInput.stop_hook_active === true) {
    return {};
  }

  // Find active sandbox
  const sandboxDir = await findMostRecentSandbox();
  if (!sandboxDir) {
    return {};
  }

  // Read validation.json
  const manifest = await readValidationManifest(sandboxDir);
  if (!manifest) {
    return {};
  }

  // Check for missing output files first (more actionable feedback)
  const missingOutputs = await findMissingOutputs(sandboxDir, manifest.steps);
  if (missingOutputs.length > 0) {
    const stepsList = missingOutputs.join(", ");
    return {
      decision: "block",
      reason: `Your workflow is not complete. You still need to create output files for these steps: ${stepsList}. Please continue working on the workflow by using the Write tool to create the required JSON files at the paths specified in validation.json for each incomplete step. Do not stop until all workflow steps have their output files created.`,
    };
  }

  // Check all steps are validated
  const pendingSteps = findPendingSteps(manifest.steps);
  if (pendingSteps.length > 0) {
    const stepsList = pendingSteps.join(", ");
    return {
      decision: "block",
      reason: `Your workflow is not complete. The following steps need validation: ${stepsList}. The output files exist but have not been validated yet. Please re-write these output files using the Write tool to trigger validation. Do not stop until all workflow steps are validated.`,
    };
  }

  // All validated - allow stop
  return {};
};

/**
 * Post-Write Validate Hook - Auto-validate sandbox outputs
 *
 * Triggered after the Write tool completes.
 * Updates validation.json when files are written to sandbox outputs.
 *
 * Based on shell script: plugins/looplia-core/scripts/hooks/post-write-validate.sh
 */
export const postWriteValidateHook: HookCallback = async (
  input: Record<string, unknown>
): Promise<HookJSONOutput> => {
  const hookInput = input as WriteToolInput;
  const filePath = hookInput.tool_input?.file_path;

  if (!filePath) {
    return {};
  }

  // Only process sandbox/ files
  if (!filePath.includes("/sandbox/")) {
    return {};
  }

  // Check if it's in outputs/ directory
  if (!filePath.includes("/outputs/")) {
    return {};
  }

  // Extract sandbox directory and artifact name
  const outputsIndex = filePath.lastIndexOf("/outputs/");
  const sandboxDir = filePath.slice(0, outputsIndex);
  const filename = filePath.slice(outputsIndex + "/outputs/".length);
  const artifact = filename.replace(JSON_EXTENSION_REGEX, "");

  // Read validation.json
  const manifest = await readValidationManifest(sandboxDir);
  if (!manifest) {
    return {};
  }

  // Check if this artifact has a step
  const stepState = manifest.steps[artifact];
  if (!stepState) {
    return {};
  }

  // Basic JSON validation
  try {
    const content = await readFile(filePath, "utf-8");
    JSON.parse(content);
  } catch {
    console.error(`Validation failed for ${artifact}: Invalid JSON`);
    return {};
  }

  // Update validation.json to mark step as validated
  manifest.steps[artifact] = {
    ...stepState,
    validated: true,
    validatedAt: new Date().toISOString(),
  };

  const validationPath = join(sandboxDir, "validation.json");
  await writeFile(validationPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.error(`✓ Validated: ${artifact}.json`);

  return {};
};

/**
 * Create workflow validation hooks for SDK query options
 *
 * Returns a hooks configuration object that can be passed to
 * SDK query() via config.runHooks.
 *
 * @example
 * ```typescript
 * import { createWorkflowHooks } from '@looplia-core/provider/claude-agent-sdk';
 *
 * const executor = createClaudeAgentExecutor({
 *   workspace,
 *   runHooks: createWorkflowHooks()
 * });
 * ```
 */
export function createWorkflowHooks(): Partial<
  Record<HookEvent, HookCallbackMatcher[]>
> {
  return {
    Stop: [{ hooks: [stopGuardHook] }],
    SubagentStop: [{ hooks: [stopGuardHook] }],
    PostToolUse: [{ matcher: "Write", hooks: [postWriteValidateHook] }],
  };
}
