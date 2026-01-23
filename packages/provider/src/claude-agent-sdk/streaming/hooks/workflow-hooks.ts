/**
 * Workflow Validation Hooks (v0.7.4)
 *
 * Programmatic hooks for the Claude Agent SDK to enforce workflow completion.
 * These replicate the shell script hooks for use with the SDK API.
 *
 * @see plugins/looplia-core/scripts/hooks/stop-guard.sh (original shell version)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";

// Enable debug logging
const DEBUG_HOOKS = process.env.DEBUG_EXECUTOR === "true";

// Top-level regex for sandbox path extraction
const SANDBOX_PATH_REGEX = /(.+\/sandbox\/[^/]+)/;

/**
 * Validation JSON structure
 */
type ValidationJson = {
  workflow: string;
  version: string;
  sandboxId: string;
  steps: Record<
    string,
    {
      output?: string;
      validated: boolean;
    }
  >;
};

/**
 * Find the most recently modified sandbox directory
 */
function findActiveSandbox(): string | null {
  const sandboxBase = join(homedir(), ".looplia", "sandbox");

  if (!existsSync(sandboxBase)) {
    return null;
  }

  try {
    const entries = readdirSync(sandboxBase, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => ({
        name: e.name,
        path: join(sandboxBase, e.name),
        mtime: statSync(join(sandboxBase, e.name)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return dirs[0]?.path ?? null;
  } catch {
    return null;
  }
}

/**
 * Read validation.json from sandbox
 */
function readValidationJson(sandboxDir: string): ValidationJson | null {
  const validationPath = join(sandboxDir, "validation.json");

  if (!existsSync(validationPath)) {
    return null;
  }

  try {
    const content = readFileSync(validationPath, "utf-8");
    return JSON.parse(content) as ValidationJson;
  } catch {
    return null;
  }
}

/**
 * Debug log helper
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG_HOOKS) {
    console.error(message, ...args);
  }
}

/**
 * Check for missing output files in validation
 */
function checkMissingFiles(validation: ValidationJson): string[] {
  const missing: string[] = [];
  for (const [stepId, step] of Object.entries(validation.steps)) {
    if (step.output && !existsSync(step.output)) {
      missing.push(stepId);
    }
  }
  return missing;
}

/**
 * Check for unvalidated steps
 */
function checkPendingSteps(validation: ValidationJson): string[] {
  return Object.entries(validation.steps)
    .filter(([, step]) => !step.validated)
    .map(([stepId]) => stepId);
}

/**
 * Create blocking response for incomplete workflow
 */
function createBlockingResponse(reason: string) {
  return {
    continue: true,
    systemMessage: reason,
  };
}

/**
 * Stop/SubagentStop hook callback - blocks premature completion of workflows
 *
 * This hook is triggered for both Stop and SubagentStop events.
 * Stop is triggered when the main agent tries to stop.
 * SubagentStop is triggered when a Task subagent (like general-purpose) completes.
 */
export const stopGuardHook: HookCallback = (input, _toolUseId) => {
  const hookName = (input as { hook_event_name?: string }).hook_event_name;
  debugLog(`[stopGuardHook] Hook invoked for event: ${hookName}`);

  // Check if stop hook is already active (prevent infinite loop)
  const stopHookActive = (input as { stop_hook_active?: boolean })
    .stop_hook_active;
  if (stopHookActive) {
    debugLog("[stopGuardHook] Already active, allowing stop");
    return Promise.resolve({});
  }

  // Find active sandbox
  const sandboxDir = findActiveSandbox();
  if (!sandboxDir) {
    debugLog("[stopGuardHook] No active sandbox found");
    return Promise.resolve({});
  }
  debugLog("[stopGuardHook] Found sandbox:", sandboxDir);

  // Read validation.json
  const validation = readValidationJson(sandboxDir);
  if (!validation) {
    debugLog("[stopGuardHook] No validation.json found");
    return Promise.resolve({});
  }

  // Check for missing output files
  const missingFiles = checkMissingFiles(validation);
  if (missingFiles.length > 0) {
    const reason = `WORKFLOW INCOMPLETE - Missing output files for steps: ${missingFiles.join(", ")}. Use the Write tool to create the required JSON files. DO NOT STOP.`;
    debugLog("[stopGuardHook] BLOCKING - missing files:", missingFiles);
    return Promise.resolve(createBlockingResponse(reason));
  }

  // Check for unvalidated steps
  const pendingSteps = checkPendingSteps(validation);
  if (pendingSteps.length > 0) {
    const reason = `WORKFLOW INCOMPLETE - Pending validation for steps: ${pendingSteps.join(", ")}. Re-write output files using Write tool. DO NOT STOP.`;
    debugLog("[stopGuardHook] BLOCKING - pending:", pendingSteps);
    return Promise.resolve(createBlockingResponse(reason));
  }

  debugLog("[stopGuardHook] All validated, allowing stop");
  return Promise.resolve({});
};

/**
 * Check if file path is in sandbox outputs directory
 */
function isInSandboxOutputs(filePath: string): boolean {
  return filePath.includes("/sandbox/") && filePath.includes("/outputs/");
}

/**
 * Extract sandbox directory from file path
 */
function extractSandboxDir(filePath: string): string | null {
  const match = filePath.match(SANDBOX_PATH_REGEX);
  return match?.[1] ?? null;
}

/**
 * Update validation.json with validated step
 */
async function updateValidation(
  sandboxDir: string,
  validation: ValidationJson,
  stepId: string
): Promise<void> {
  const validationPath = join(sandboxDir, "validation.json");
  const step = validation.steps[stepId];
  if (step) {
    step.validated = true;
    await writeFile(validationPath, JSON.stringify(validation, null, 2));
    debugLog(`[postWriteValidateHook] Validated step: ${stepId}`);
  }
}

/**
 * PostToolUse hook for Write - validates output files after they're written
 */
export const postWriteValidateHook: HookCallback = async (
  input,
  _toolUseId
) => {
  const toolName = (input as { tool_name?: string }).tool_name;
  debugLog(`[postWriteValidateHook] Hook invoked for tool: ${toolName}`);

  // Only process Write tool calls
  if (toolName !== "Write") {
    return {};
  }

  const toolInput = (input as { tool_input?: { file_path?: string } })
    .tool_input;
  const filePath = toolInput?.file_path;
  if (!(filePath && isInSandboxOutputs(filePath))) {
    debugLog("[postWriteValidateHook] Not a sandbox output file, skipping");
    return {};
  }

  const sandboxDir = extractSandboxDir(filePath);
  if (!sandboxDir) {
    return {};
  }

  const validation = readValidationJson(sandboxDir);
  if (!validation) {
    debugLog("[postWriteValidateHook] No validation.json found");
    return {};
  }

  // Find and validate the step
  for (const [stepId, step] of Object.entries(validation.steps)) {
    if (step.output === filePath) {
      await updateValidation(sandboxDir, validation, stepId);
      break;
    }
  }

  return {};
};

/**
 * Create workflow validation hooks for SDK query options
 *
 * Registers hooks for:
 * - Stop: Blocks main agent from stopping if workflow incomplete
 * - SubagentStop: Blocks subagents from stopping if workflow incomplete
 * - PostToolUse (Write): Validates output files when written to sandbox
 */
export function createWorkflowValidationHooks(): Record<
  string,
  Array<{ hooks: HookCallback[]; matcher?: string }>
> {
  return {
    Stop: [{ hooks: [stopGuardHook] }],
    SubagentStop: [{ hooks: [stopGuardHook] }],
    PostToolUse: [{ hooks: [postWriteValidateHook], matcher: "Write" }],
  };
}
