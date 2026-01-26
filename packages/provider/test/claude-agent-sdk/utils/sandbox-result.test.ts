/**
 * Unit tests for sandbox-result.ts
 *
 * Tests the extractSandboxResult function and its internal helpers:
 * - findMostRecentSandbox
 * - readValidationManifest (with lock retry)
 * - areAllStepsValidated
 * - Type guard validation
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractSandboxResult } from "../../../src/claude-agent-sdk/utils/shared/sandbox-result";

describe("sandbox-result", () => {
  let testDir: string;
  let sandboxRoot: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `sandbox-test-${Date.now()}`);
    sandboxRoot = join(testDir, "sandbox");
    await mkdir(sandboxRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("extractSandboxResult", () => {
    describe("sandbox resolution", () => {
      it("should return error when no sandbox directories exist", async () => {
        const result = await extractSandboxResult({ sandboxRoot });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("validation_error");
          expect(result.error.message).toBe("No sandbox directories found");
        }
      });

      it("should return error when explicit sandbox ID not found", async () => {
        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "nonexistent-sandbox",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("validation_error");
        }
      });

      it("should use explicit sandbox ID when provided", async () => {
        const sandboxId = "my-sandbox";
        const sandboxDir = join(sandboxRoot, sandboxId);
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          sandboxId,
          steps: {
            step1: { output: "outputs/step1.json", validated: true },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(sandboxDir, "outputs/step1.json"),
          JSON.stringify({ data: "test" })
        );

        const result = await extractSandboxResult({ sandboxRoot, sandboxId });

        expect(result.success).toBe(true);
      });

      it("should find most recent sandbox by mtime", async () => {
        // Create two sandboxes
        const olderDir = join(sandboxRoot, "older-sandbox");
        const newerDir = join(sandboxRoot, "newer-sandbox");

        await mkdir(join(olderDir, "outputs"), { recursive: true });
        await mkdir(join(newerDir, "outputs"), { recursive: true });

        // Write to older first
        const olderManifest = {
          workflow: "older-workflow",
          sandboxId: "older-sandbox",
          steps: {
            step1: { output: "outputs/step1.json", validated: true },
          },
        };
        await writeFile(
          join(olderDir, "validation.json"),
          JSON.stringify(olderManifest)
        );
        await writeFile(
          join(olderDir, "outputs/step1.json"),
          JSON.stringify({ from: "older" })
        );

        // Small delay to ensure different mtime
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Write to newer
        const newerManifest = {
          workflow: "newer-workflow",
          sandboxId: "newer-sandbox",
          steps: {
            step1: { output: "outputs/step1.json", validated: true },
          },
        };
        await writeFile(
          join(newerDir, "validation.json"),
          JSON.stringify(newerManifest)
        );
        await writeFile(
          join(newerDir, "outputs/step1.json"),
          JSON.stringify({ from: "newer" })
        );

        const result = await extractSandboxResult({ sandboxRoot });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.workflowId).toBe("newer-workflow");
        }
      });

      it("should ignore hidden directories", async () => {
        // Create a hidden directory and a visible one
        const hiddenDir = join(sandboxRoot, ".hidden-sandbox");
        const visibleDir = join(sandboxRoot, "visible-sandbox");

        await mkdir(join(hiddenDir, "outputs"), { recursive: true });
        await mkdir(join(visibleDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: { step1: { output: "outputs/step1.json", validated: true } },
        };
        await writeFile(
          join(hiddenDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(visibleDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(hiddenDir, "outputs/step1.json"),
          JSON.stringify({ from: "hidden" })
        );
        await writeFile(
          join(visibleDir, "outputs/step1.json"),
          JSON.stringify({ from: "visible" })
        );

        const result = await extractSandboxResult({ sandboxRoot });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.artifact).toEqual({ from: "visible" });
        }
      });
    });

    describe("validation manifest reading", () => {
      it("should return error for missing validation.json", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(sandboxDir, { recursive: true });
        // Don't create validation.json

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("validation_error");
          expect(result.error.message).toContain("Failed to read");
        }
      });

      it("should return error for corrupted JSON", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(sandboxDir, { recursive: true });
        await writeFile(join(sandboxDir, "validation.json"), "not valid json");

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("validation_error");
        }
      });

      it("should return error for invalid manifest schema", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(sandboxDir, { recursive: true });
        // Missing required 'workflow' field
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify({ steps: {} })
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("validation_error");
          expect(result.error.message).toContain("Invalid validation manifest");
        }
      });

      it("should return error for manifest with null steps", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(sandboxDir, { recursive: true });
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify({ workflow: "test", steps: null })
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
      });
    });

    describe("lock file handling", () => {
      it("should wait for lock file to be released", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: { step1: { output: "outputs/step1.json", validated: true } },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(sandboxDir, "outputs/step1.json"),
          JSON.stringify({ data: "test" })
        );

        // Create lock file
        const lockPath = join(sandboxDir, "validation.json.lock");
        await writeFile(lockPath, "");

        // Remove lock after short delay
        setTimeout(async () => {
          await rm(lockPath);
        }, 100);

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(true);
      });

      it("should timeout if lock is never released", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(sandboxDir, { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: { step1: { output: "outputs/step1.json", validated: true } },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        // Create lock file that won't be released
        const lockPath = join(sandboxDir, "validation.json.lock");
        await writeFile(lockPath, "");

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain("Timeout");
        }
      });
    });

    describe("step validation checking", () => {
      it("should return error when steps are not all validated", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: { output: "outputs/step1.json", validated: true },
            step2: { output: "outputs/step2.json", validated: false },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("validation_error");
          expect(result.error.message).toContain("Pending steps: step2");
        }
      });

      it("should list all pending steps in error", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: { output: "outputs/step1.json", validated: false },
            step2: { output: "outputs/step2.json", validated: false },
            step3: { output: "outputs/step3.json", validated: true },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain("step1");
          expect(result.error.message).toContain("step2");
          expect(result.error.message).not.toContain("step3");
        }
      });

      it("should succeed when all steps are validated", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: { output: "outputs/step1.json", validated: true },
            step2: { output: "outputs/step2.json", validated: true },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(sandboxDir, "outputs/step1.json"),
          JSON.stringify({ data: "step1" })
        );
        await writeFile(
          join(sandboxDir, "outputs/step2.json"),
          JSON.stringify({ data: "step2" })
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(true);
      });

      it("should handle empty steps", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(sandboxDir, { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {},
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain("No steps found");
        }
      });
    });

    describe("final step resolution", () => {
      it("should use finalStepId when specified", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          finalStepId: "step1",
          steps: {
            step1: { output: "outputs/step1.json", validated: true },
            step2: { output: "outputs/step2.json", validated: true },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(sandboxDir, "outputs/step1.json"),
          JSON.stringify({ final: "step1" })
        );
        await writeFile(
          join(sandboxDir, "outputs/step2.json"),
          JSON.stringify({ final: "step2" })
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.artifact).toEqual({ final: "step1" });
        }
      });

      it("should use last step when finalStepId not specified", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: { output: "outputs/step1.json", validated: true },
            step2: { output: "outputs/step2.json", validated: true },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(sandboxDir, "outputs/step1.json"),
          JSON.stringify({ final: "step1" })
        );
        await writeFile(
          join(sandboxDir, "outputs/step2.json"),
          JSON.stringify({ final: "step2" })
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.artifact).toEqual({ final: "step2" });
        }
      });

      it("should fall back to last step if finalStepId not found", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          finalStepId: "nonexistent",
          steps: {
            step1: { output: "outputs/step1.json", validated: true },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(sandboxDir, "outputs/step1.json"),
          JSON.stringify({ final: "step1" })
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.artifact).toEqual({ final: "step1" });
        }
      });
    });

    describe("artifact reading", () => {
      it("should return error for missing artifact file", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: { step1: { output: "outputs/step1.json", validated: true } },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );
        // Don't create the artifact file

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
      });

      it("should return malformed_output error for invalid artifact JSON", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: { step1: { output: "outputs/step1.json", validated: true } },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(sandboxDir, "outputs/step1.json"),
          "not valid json"
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("malformed_output");
        }
      });

      it("should return successful result with artifact data", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          sandboxId: "test-sandbox",
          steps: { step1: { output: "outputs/step1.json", validated: true } },
        };
        const artifact = { content: "test data", nested: { value: 123 } };

        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );
        await writeFile(
          join(sandboxDir, "outputs/step1.json"),
          JSON.stringify(artifact)
        );

        const result = await extractSandboxResult({
          sandboxRoot,
          sandboxId: "test-sandbox",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe("success");
          expect(result.data.sandboxId).toBe("test-sandbox");
          expect(result.data.workflowId).toBe("test-workflow");
          expect(result.data.artifact).toEqual(artifact);
        }
      });
    });
  });
});
