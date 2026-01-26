/**
 * Sandbox Result Extraction Utility
 *
 * Extracts final workflow artifacts from sandbox output files
 * instead of relying on SDK StructuredOutput enforcement.
 *
 * @see openspec/changes/remove-structuredoutput-enforcement/design.md
 */

import { access, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { getLoopliaPluginPath } from "../../../bootstrap";
import type { AgenticQueryResult } from "./types";

/** Lock retry constants matching workflow-hooks.ts */
const LOCK_MAX_RETRIES = 5;
const LOCK_RETRY_DELAY_MS = 200;

/**
 * Validation manifest structure from sandbox/validation.json
 */
type ValidationManifest = {
  workflow: string;
  version?: string;
  sandboxId?: string;
  createdAt?: string;
  finalStepId?: string;
  steps: Record<
    string,
    {
      output: string;
      validate?: Record<string, unknown>;
      validated: boolean;
    }
  >;
};

/**
 * Type guard to validate manifest structure
 */
function isValidationManifest(value: unknown): value is ValidationManifest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.workflow === "string" &&
    typeof obj.steps === "object" &&
    obj.steps !== null
  );
}

/**
 * Sleep for specified milliseconds
 */
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if lock file exists
 */
async function lockExists(lockPath: string): Promise<boolean> {
  try {
    await access(lockPath);
    return true;
  } catch {
    return false;
  }
}

type SandboxResultOptions = {
  sandboxId?: string;
  sandboxRoot?: string;
};

/**
 * Create a validation error result
 */
function validationError<T>(
  field: string,
  message: string
): AgenticQueryResult<T> {
  return {
    success: false,
    error: { type: "validation_error", field, message },
  };
}

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
 * Find the final step in validation manifest
 */
function findFinalStep(
  steps: ValidationManifest["steps"]
): { id: string; output: string } | undefined {
  const stepEntries = Object.entries(steps);
  if (stepEntries.length === 0) {
    return;
  }

  const lastEntry = stepEntries.at(-1);
  if (!lastEntry) {
    return;
  }

  return { id: lastEntry[0], output: lastEntry[1].output };
}

function resolveFinalStep(
  steps: ValidationManifest["steps"],
  finalStepId?: string
): { id: string; output: string } | undefined {
  if (finalStepId) {
    const step = steps[finalStepId];
    if (step?.output) {
      return { id: finalStepId, output: step.output };
    }
  }

  return findFinalStep(steps);
}

/**
 * Check if all steps in the manifest are validated
 */
function areAllStepsValidated(steps: ValidationManifest["steps"]): {
  allValidated: boolean;
  pendingSteps: string[];
} {
  const pendingSteps: string[] = [];

  for (const [stepId, stepState] of Object.entries(steps)) {
    if (!stepState.validated) {
      pendingSteps.push(stepId);
    }
  }

  return {
    allValidated: pendingSteps.length === 0,
    pendingSteps,
  };
}

/**
 * Resolve sandbox directory from ID or find most recent
 */
function resolveSandboxDir(
  sandboxRoot: string,
  sandboxId?: string
): Promise<string | undefined> | string {
  if (sandboxId) {
    return join(sandboxRoot, sandboxId);
  }
  return findMostRecentSandbox(sandboxRoot);
}

/**
 * Read and parse validation manifest from sandbox
 *
 * Handles concurrency with workflow hooks by checking for lock file
 * and retrying if the file is being written to.
 */
async function readValidationManifest(
  sandboxDir: string
): Promise<{ manifest?: ValidationManifest; error?: string }> {
  const validationPath = join(sandboxDir, "validation.json");
  const lockPath = `${validationPath}.lock`;

  // Retry loop with backoff if lock exists
  for (let attempt = 0; attempt < LOCK_MAX_RETRIES; attempt++) {
    // Check if lock file exists (hook is writing)
    if (await lockExists(lockPath)) {
      await sleep(LOCK_RETRY_DELAY_MS);
      continue;
    }

    try {
      const content = await readFile(validationPath, "utf-8");
      const parsed: unknown = JSON.parse(content);

      // Validate manifest structure
      if (!isValidationManifest(parsed)) {
        return { error: "Invalid validation manifest structure" };
      }

      return { manifest: parsed };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: `Failed to read validation.json: ${message}` };
    }
  }

  return { error: "Timeout waiting for validation.json lock to release" };
}

/**
 * Read and parse the final artifact from sandbox
 */
async function readFinalArtifact<T>(
  sandboxDir: string,
  outputPath: string
): Promise<{ artifact?: T; error?: AgenticQueryResult<T> }> {
  const artifactPath = join(sandboxDir, outputPath);

  try {
    const content = await readFile(artifactPath, "utf-8");
    return { artifact: JSON.parse(content) as T };
  } catch (error) {
    const errorMessage = `Failed to read final artifact from ${outputPath}: ${error instanceof Error ? error.message : String(error)}`;
    const isParseError =
      error instanceof Error && error.message.includes("JSON");

    if (isParseError) {
      return {
        error: {
          success: false,
          error: {
            type: "malformed_output",
            expected: "valid JSON",
            got: "invalid JSON",
            message: errorMessage,
          },
        },
      };
    }
    return { error: validationError("artifact", errorMessage) };
  }
}

/**
 * Extract final workflow result from sandbox
 *
 * After SDK query completes, reads validation.json to find
 * the validated output files and returns the final artifact.
 *
 * @param sandboxId - Optional sandbox ID. If not provided, uses most recent sandbox.
 * @returns AgenticQueryResult with extracted artifact or error
 */
export async function extractSandboxResult<T>(
  options?: SandboxResultOptions
): Promise<AgenticQueryResult<T>> {
  const loopliaHome = getLoopliaPluginPath();
  const sandboxRoot = options?.sandboxRoot ?? join(loopliaHome, "sandbox");
  const sandboxId = options?.sandboxId;

  // Find sandbox directory
  const sandboxDir = await resolveSandboxDir(sandboxRoot, sandboxId);
  if (!sandboxDir) {
    const message = sandboxId
      ? `Sandbox not found: ${sandboxId}`
      : "No sandbox directories found";
    return validationError("sandbox", message);
  }

  // Read validation.json
  const { manifest, error: readError } =
    await readValidationManifest(sandboxDir);
  if (!manifest) {
    return validationError("validation.json", readError ?? "Unknown error");
  }

  // Check all steps are validated
  const { allValidated, pendingSteps } = areAllStepsValidated(manifest.steps);
  if (!allValidated) {
    return validationError(
      "steps",
      `Workflow incomplete. Pending steps: ${pendingSteps.join(", ")}`
    );
  }

  // Find final step
  const finalStep = resolveFinalStep(manifest.steps, manifest.finalStepId);
  if (!finalStep) {
    return validationError("steps", "No steps found in validation manifest");
  }

  // Read final artifact
  const { artifact, error: artifactError } = await readFinalArtifact<T>(
    sandboxDir,
    finalStep.output
  );
  if (artifactError) {
    return artifactError;
  }

  // Return successful result
  return {
    success: true,
    data: {
      status: "success",
      sandboxId: manifest.sandboxId ?? sandboxDir.split("/").pop(),
      workflowId: manifest.workflow,
      artifact,
    } as T,
  };
}
