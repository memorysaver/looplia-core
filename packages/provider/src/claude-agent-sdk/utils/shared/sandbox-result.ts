/**
 * Sandbox Result Extraction Utility
 *
 * Extracts final workflow artifacts from sandbox output files
 * instead of relying on SDK StructuredOutput enforcement.
 *
 * @see openspec/changes/remove-structuredoutput-enforcement/design.md
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { getLoopliaPluginPath } from "../../../bootstrap";
import type { AgenticQueryResult } from "./types";

/**
 * Validation manifest structure from sandbox/validation.json
 */
type ValidationManifest = {
  workflow: string;
  version?: string;
  sandboxId?: string;
  createdAt?: string;
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
 */
async function readValidationManifest(
  sandboxDir: string
): Promise<{ manifest?: ValidationManifest; error?: string }> {
  const validationPath = join(sandboxDir, "validation.json");

  try {
    const content = await readFile(validationPath, "utf-8");
    return { manifest: JSON.parse(content) as ValidationManifest };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Failed to read validation.json: ${message}` };
  }
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
  sandboxId?: string
): Promise<AgenticQueryResult<T>> {
  const loopliaHome = getLoopliaPluginPath();
  const sandboxRoot = join(loopliaHome, "sandbox");

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
  const finalStep = findFinalStep(manifest.steps);
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
