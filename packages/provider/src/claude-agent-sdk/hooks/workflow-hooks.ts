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

import {
  open,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import type {
  HookCallback,
  HookCallbackMatcher,
  HookEvent,
  HookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  ValidationCriteria,
  ValidationManifest,
} from "@looplia-core/core";
import { getLoopliaPluginPath } from "../../bootstrap";

/** Regex for stripping .json extension from filenames */
const JSON_EXTENSION_REGEX = /\.json$/;
const LOCK_TIMEOUT_MS = 30_000;
const LOCK_RETRY_DELAY_MS = 200;

/**
 * Validation manifest structure from sandbox/validation.json
 */
type SandboxValidationManifest = ValidationManifest & {
  status?: "pending" | "in_progress" | "completed" | "failed";
  steps: Record<
    string,
    {
      output?: string;
      validate?: ValidationCriteria;
      validated: boolean;
      validatedAt?: string;
    }
  >;
};

type ValidationCheck = {
  name: string;
  passed: boolean;
  message: string;
};

type ValidationResult = {
  passed: boolean;
  checks: ValidationCheck[];
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
 * Find the most recently modified sandbox directory
 */
async function findMostRecentSandbox(
  sandboxRoot: string
): Promise<string | undefined> {
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
): Promise<SandboxValidationManifest | undefined> {
  const validationPath = join(sandboxDir, "validation.json");
  try {
    const content = await readFile(validationPath, "utf-8");
    return JSON.parse(content) as SandboxValidationManifest;
  } catch {
    return;
  }
}

function resolveSandboxRoot(context?: HookContext): string {
  return context?.sandboxRoot ?? join(getLoopliaPluginPath(), "sandbox");
}

async function resolveSandboxDir(
  context?: HookContext
): Promise<string | undefined> {
  const sandboxRoot = resolveSandboxRoot(context);
  if (context?.sandboxId) {
    return join(sandboxRoot, context.sandboxId);
  }
  return await findMostRecentSandbox(sandboxRoot);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getSandboxArtifactInfo(
  filePath: string | undefined
): { sandboxDir: string; artifact: string } | undefined {
  if (!filePath) {
    return;
  }

  if (!(filePath.includes("/sandbox/") && filePath.includes("/outputs/"))) {
    return;
  }

  const outputsIndex = filePath.lastIndexOf("/outputs/");
  if (outputsIndex < 0) {
    return;
  }

  const sandboxDir = filePath.slice(0, outputsIndex);
  const filename = filePath.slice(outputsIndex + "/outputs/".length);
  const artifact = filename.replace(JSON_EXTENSION_REGEX, "");
  return { sandboxDir, artifact };
}

async function readArtifactData(
  filePath: string,
  artifact: string
): Promise<Record<string, unknown> | undefined> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    console.error(`Validation failed for ${artifact}: Invalid JSON`);
    return;
  }
}

function validateWorkflowArtifact(
  data: Record<string, unknown>,
  criteria: ValidationCriteria
): ValidationResult {
  const checks: ValidationCheck[] = [];

  if (criteria.required_fields) {
    checks.push(...checkRequiredFields(data, criteria.required_fields));
  }

  if (criteria.min_quotes !== undefined) {
    checks.push(checkMinQuotes(data, criteria.min_quotes));
  }

  if (criteria.min_key_points !== undefined) {
    checks.push(checkMinKeyPoints(data, criteria.min_key_points));
  }

  if (criteria.min_outline_sections !== undefined) {
    checks.push(checkMinOutlineSections(data, criteria.min_outline_sections));
  }

  if (criteria.has_hooks === true) {
    checks.push(checkHasHooks(data));
  }

  const passed = checks.every((check) => check.passed);
  return { passed, checks };
}

function checkRequiredFields(
  data: Record<string, unknown>,
  fields: string[]
): ValidationCheck[] {
  return fields.map((field) => {
    const exists = hasField(data, field);
    return {
      name: `has_${field}`,
      passed: exists,
      message: exists ? "OK" : `Missing required field: ${field}`,
    };
  });
}

function checkMinQuotes(
  data: Record<string, unknown>,
  minQuotes: number
): ValidationCheck {
  const quotes = getArrayLength(data, "importantQuotes");
  const passed = quotes >= minQuotes;
  return {
    name: "min_quotes",
    passed,
    message: passed
      ? `Found ${quotes} quotes (min: ${minQuotes})`
      : `Found ${quotes} quotes, need at least ${minQuotes}`,
  };
}

function checkMinKeyPoints(
  data: Record<string, unknown>,
  minPoints: number
): ValidationCheck {
  const bullets = getArrayLength(data, "bullets");
  const keyPoints = getArrayLength(data, "keyPoints");
  const count = Math.max(bullets, keyPoints);
  const passed = count >= minPoints;
  return {
    name: "min_key_points",
    passed,
    message: passed
      ? `Found ${count} key points (min: ${minPoints})`
      : `Found ${count} key points, need at least ${minPoints}`,
  };
}

function checkMinOutlineSections(
  data: Record<string, unknown>,
  minSections: number
): ValidationCheck {
  const sections = getArrayLength(data, "suggestedOutline");
  const passed = sections >= minSections;
  return {
    name: "min_outline_sections",
    passed,
    message: passed
      ? `Found ${sections} outline sections (min: ${minSections})`
      : `Found ${sections} sections, need at least ${minSections}`,
  };
}

function checkHasHooks(data: Record<string, unknown>): ValidationCheck {
  const hooksCount = getHooksCount(data);
  const passed = hooksCount > 0;
  return {
    name: "has_hooks",
    passed,
    message: passed
      ? `Found ${hooksCount} hooks`
      : "No hooks found in artifact",
  };
}

function getHooksCount(data: Record<string, unknown>): number {
  const ideas = data.ideas as Record<string, unknown> | undefined;
  if (ideas && Array.isArray(ideas.hooks)) {
    return ideas.hooks.length;
  }
  if (Array.isArray(data.hooks)) {
    return data.hooks.length;
  }
  return 0;
}

function hasField(data: Record<string, unknown>, field: string): boolean {
  const parts = field.split(".");
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || typeof current !== "object") {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current !== undefined && current !== null;
}

function getArrayLength(data: Record<string, unknown>, field: string): number {
  const value = data[field];
  return Array.isArray(value) ? value.length : 0;
}

function validateArtifactData(
  artifact: string,
  artifactData: Record<string, unknown>,
  criteria: ValidationCriteria | undefined
): boolean {
  if (criteria === undefined || criteria === null) {
    return true;
  }

  if (!isRecord(criteria)) {
    console.error(`Validation failed for ${artifact}: Invalid criteria`);
    return false;
  }

  const result: ValidationResult = validateWorkflowArtifact(
    artifactData,
    criteria
  );
  if (!result.passed) {
    console.error(`Semantic validation failed for ${artifact}:`);
    console.error(JSON.stringify(result, null, 2));
  }

  return result.passed;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(
  lockPath: string,
  timeoutMs: number
): Promise<{ release: () => Promise<void> } | undefined> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const handle = await open(lockPath, "wx");
      return {
        release: async () => {
          await handle.close();
          try {
            await unlink(lockPath);
          } catch {
            // Ignore lock cleanup failures.
          }
        },
      };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "EEXIST"
      ) {
        await sleep(LOCK_RETRY_DELAY_MS);
        continue;
      }
      throw error;
    }
  }

  return;
}

async function writeValidationManifest(
  validationPath: string,
  manifest: SandboxValidationManifest
): Promise<void> {
  const tempPath = `${validationPath}.tmp`;
  await writeFile(tempPath, JSON.stringify(manifest, null, 2), "utf-8");
  await rename(tempPath, validationPath);
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
export function createStopGuardHook(context?: HookContext): HookCallback {
  return async (input: Record<string, unknown>): Promise<HookJSONOutput> => {
    const hookInput = input as StopHookInput;

    // Prevent infinite loop - SDK sets stop_hook_active when re-entering
    if (hookInput.stop_hook_active === true) {
      return {};
    }

    // Find active sandbox
    const sandboxDir = await resolveSandboxDir(context);
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
}

export const stopGuardHook = createStopGuardHook();

/**
 * Post-Write Validate Hook - Auto-validate sandbox outputs
 *
 * Triggered after the Write tool completes.
 * Updates validation.json when files are written to sandbox outputs.
 *
 * Based on shell script: plugins/looplia-core/scripts/hooks/post-write-validate.sh
 */
export function createPostWriteValidateHook(): HookCallback {
  return async (input: Record<string, unknown>): Promise<HookJSONOutput> => {
    const hookInput = input as WriteToolInput;
    const filePath = hookInput.tool_input?.file_path;
    const artifactInfo = getSandboxArtifactInfo(filePath);
    if (!(artifactInfo && filePath)) {
      return {};
    }

    const artifactData = await readArtifactData(
      filePath,
      artifactInfo.artifact
    );
    if (!artifactData) {
      return {};
    }

    const validationPath = join(artifactInfo.sandboxDir, "validation.json");
    const lock = await acquireLock(`${validationPath}.lock`, LOCK_TIMEOUT_MS);
    if (!lock) {
      console.error("Failed to acquire lock on validation.json");
      return {};
    }

    try {
      const manifest = await readValidationManifest(artifactInfo.sandboxDir);
      if (!manifest) {
        return {};
      }

      // Check if this artifact has a step
      const stepState = manifest.steps[artifactInfo.artifact];
      if (!stepState) {
        return {};
      }

      const isValid = validateArtifactData(
        artifactInfo.artifact,
        artifactData,
        stepState.validate
      );
      if (!isValid) {
        return {};
      }

      // Update validation.json to mark step as validated
      manifest.steps[artifactInfo.artifact] = {
        ...stepState,
        validated: true,
        validatedAt: new Date().toISOString(),
      };

      await writeValidationManifest(validationPath, manifest);
      console.error(`✓ Validated: ${artifactInfo.artifact}.json`);
    } finally {
      await lock.release();
    }

    return {};
  };
}

export const postWriteValidateHook = createPostWriteValidateHook();

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
  const context: HookContext = {
    sandboxId: process.env.LOOPLIA_SANDBOX_ID,
    sandboxRoot: process.env.LOOPLIA_SANDBOX_ROOT,
  };
  return {
    Stop: [{ hooks: [createStopGuardHook(context)] }],
    SubagentStop: [{ hooks: [createStopGuardHook(context)] }],
    PostToolUse: [{ matcher: "Write", hooks: [createPostWriteValidateHook()] }],
  };
}
