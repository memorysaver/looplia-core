/**
 * Unit tests for workflow-hooks.ts
 *
 * Tests the workflow validation hooks:
 * - createStopGuardHook
 * - createPostWriteValidateHook
 * - createWorkflowHooks
 * - acquireLock (indirectly through hooks)
 * - getSandboxArtifactInfo (indirectly through postWrite hook)
 * - Validation functions (required fields, min counts, etc.)
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPostWriteValidateHook,
  createStopGuardHook,
  createWorkflowHooks,
} from "../../../src/claude-agent-sdk/hooks/workflow-hooks";

describe("workflow-hooks", () => {
  let testDir: string;
  let sandboxRoot: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `hooks-test-${Date.now()}`);
    sandboxRoot = join(testDir, "sandbox");
    await mkdir(sandboxRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("createStopGuardHook", () => {
    it("should allow stop when no sandbox exists", async () => {
      const hook = createStopGuardHook({ sandboxRoot });

      const result = await hook({
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result).toEqual({});
    });

    it("should allow stop when stop_hook_active is true (prevents infinite loop)", async () => {
      const sandboxDir = join(sandboxRoot, "test-sandbox");
      await mkdir(join(sandboxDir, "outputs"), { recursive: true });

      // Create incomplete manifest
      const manifest = {
        workflow: "test-workflow",
        steps: { step1: { output: "outputs/step1.json", validated: false } },
      };
      await writeFile(
        join(sandboxDir, "validation.json"),
        JSON.stringify(manifest)
      );

      const hook = createStopGuardHook({ sandboxRoot });

      const result = await hook({
        hook_event_name: "Stop",
        stop_hook_active: true,
      });

      expect(result).toEqual({});
    });

    it("should allow stop when all steps are validated", async () => {
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
        JSON.stringify({ data: "test" })
      );
      await writeFile(
        join(sandboxDir, "outputs/step2.json"),
        JSON.stringify({ data: "test" })
      );

      const hook = createStopGuardHook({ sandboxRoot });

      const result = await hook({
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result).toEqual({});
    });

    it("should block stop when output files are missing", async () => {
      const sandboxDir = join(sandboxRoot, "test-sandbox");
      await mkdir(join(sandboxDir, "outputs"), { recursive: true });

      const manifest = {
        workflow: "test-workflow",
        steps: {
          step1: { output: "outputs/step1.json", validated: false },
          step2: { output: "outputs/step2.json", validated: false },
        },
      };
      await writeFile(
        join(sandboxDir, "validation.json"),
        JSON.stringify(manifest)
      );
      // Only create one output file
      await writeFile(
        join(sandboxDir, "outputs/step1.json"),
        JSON.stringify({ data: "test" })
      );

      const hook = createStopGuardHook({ sandboxRoot });

      const result = await hook({
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result.decision).toBe("block");
      expect(result.reason).toContain("step2");
      expect(result.reason).toContain("output files");
    });

    it("should block stop when steps are not validated", async () => {
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
      await writeFile(
        join(sandboxDir, "outputs/step1.json"),
        JSON.stringify({ data: "test" })
      );
      await writeFile(
        join(sandboxDir, "outputs/step2.json"),
        JSON.stringify({ data: "test" })
      );

      const hook = createStopGuardHook({ sandboxRoot });

      const result = await hook({
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result.decision).toBe("block");
      expect(result.reason).toContain("step2");
      expect(result.reason).toContain("need validation");
    });

    it("should use explicit sandboxId when provided", async () => {
      const sandboxDir = join(sandboxRoot, "explicit-sandbox");
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

      const hook = createStopGuardHook({
        sandboxRoot,
        sandboxId: "explicit-sandbox",
      });

      const result = await hook({
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result).toEqual({});
    });

    it("should allow stop when no validation.json exists", async () => {
      const sandboxDir = join(sandboxRoot, "test-sandbox");
      await mkdir(sandboxDir, { recursive: true });
      // Don't create validation.json

      const hook = createStopGuardHook({ sandboxRoot });

      const result = await hook({
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result).toEqual({});
    });
  });

  describe("createPostWriteValidateHook", () => {
    it("should ignore non-sandbox file writes", async () => {
      const hook = createPostWriteValidateHook();

      const result = await hook({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/some/other/path/file.json",
          content: '{"data": "test"}',
        },
      });

      expect(result).toEqual({});
    });

    it("should ignore writes without file_path", async () => {
      const hook = createPostWriteValidateHook();

      const result = await hook({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {},
      });

      expect(result).toEqual({});
    });

    it("should ignore sandbox writes that are not in outputs directory", async () => {
      const sandboxDir = join(sandboxRoot, "test-sandbox");
      await mkdir(sandboxDir, { recursive: true });

      const hook = createPostWriteValidateHook();

      const result = await hook({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: `${sandboxDir}/other-file.json`,
          content: '{"data": "test"}',
        },
      });

      expect(result).toEqual({});
    });

    it("should validate and update manifest on valid artifact write", async () => {
      const sandboxDir = join(sandboxRoot, "test-sandbox");
      await mkdir(join(sandboxDir, "outputs"), { recursive: true });

      const manifest = {
        workflow: "test-workflow",
        steps: {
          step1: { output: "outputs/step1.json", validated: false },
        },
      };
      await writeFile(
        join(sandboxDir, "validation.json"),
        JSON.stringify(manifest)
      );

      // Write the artifact file first (simulating what Write tool does)
      const artifactPath = join(sandboxDir, "outputs/step1.json");
      await writeFile(artifactPath, JSON.stringify({ data: "test" }));

      const hook = createPostWriteValidateHook();

      const result = await hook({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: artifactPath,
          content: '{"data": "test"}',
        },
      });

      expect(result).toEqual({});

      // Check that manifest was updated
      const updatedManifest = JSON.parse(
        await readFile(join(sandboxDir, "validation.json"), "utf-8")
      );
      expect(updatedManifest.steps.step1.validated).toBe(true);
      expect(updatedManifest.steps.step1.validatedAt).toBeDefined();
    });

    it("should not update manifest for non-existent step", async () => {
      const sandboxDir = join(sandboxRoot, "test-sandbox");
      await mkdir(join(sandboxDir, "outputs"), { recursive: true });

      const manifest = {
        workflow: "test-workflow",
        steps: {
          step1: { output: "outputs/step1.json", validated: false },
        },
      };
      await writeFile(
        join(sandboxDir, "validation.json"),
        JSON.stringify(manifest)
      );

      // Write an artifact that doesn't match any step
      const artifactPath = join(sandboxDir, "outputs/unknown.json");
      await writeFile(artifactPath, JSON.stringify({ data: "test" }));

      const hook = createPostWriteValidateHook();

      await hook({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: artifactPath,
          content: '{"data": "test"}',
        },
      });

      // Check that manifest was NOT updated
      const updatedManifest = JSON.parse(
        await readFile(join(sandboxDir, "validation.json"), "utf-8")
      );
      expect(updatedManifest.steps.step1.validated).toBe(false);
    });

    it("should skip validation for invalid JSON artifact", async () => {
      const sandboxDir = join(sandboxRoot, "test-sandbox");
      await mkdir(join(sandboxDir, "outputs"), { recursive: true });

      const manifest = {
        workflow: "test-workflow",
        steps: {
          step1: { output: "outputs/step1.json", validated: false },
        },
      };
      await writeFile(
        join(sandboxDir, "validation.json"),
        JSON.stringify(manifest)
      );

      // Write invalid JSON to artifact file
      const artifactPath = join(sandboxDir, "outputs/step1.json");
      await writeFile(artifactPath, "not valid json");

      const hook = createPostWriteValidateHook();

      await hook({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: artifactPath,
          content: "not valid json",
        },
      });

      // Check that manifest was NOT updated
      const updatedManifest = JSON.parse(
        await readFile(join(sandboxDir, "validation.json"), "utf-8")
      );
      expect(updatedManifest.steps.step1.validated).toBe(false);
    });

    describe("validation criteria", () => {
      it("should validate required_fields", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { required_fields: ["title", "summary"] },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        // Write artifact with required fields
        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(
          artifactPath,
          JSON.stringify({ title: "Test", summary: "Summary" })
        );

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(true);
      });

      it("should fail validation when required_fields are missing", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { required_fields: ["title", "summary"] },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        // Write artifact missing 'summary' field
        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(artifactPath, JSON.stringify({ title: "Test" }));

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(false);
      });

      it("should validate nested required_fields", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { required_fields: ["metadata.author", "content"] },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        // Write artifact with nested field
        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(
          artifactPath,
          JSON.stringify({ metadata: { author: "Test" }, content: "Body" })
        );

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(true);
      });

      it("should validate min_quotes", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { min_quotes: 2 },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        // Write artifact with enough quotes
        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(
          artifactPath,
          JSON.stringify({
            importantQuotes: [{ text: "Quote 1" }, { text: "Quote 2" }],
          })
        );

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(true);
      });

      it("should fail min_quotes validation when not enough quotes", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { min_quotes: 3 },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        // Write artifact with not enough quotes
        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(
          artifactPath,
          JSON.stringify({ importantQuotes: [{ text: "Quote 1" }] })
        );

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(false);
      });

      it("should validate min_key_points with bullets field", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { min_key_points: 2 },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(
          artifactPath,
          JSON.stringify({ bullets: ["Point 1", "Point 2", "Point 3"] })
        );

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(true);
      });

      it("should validate min_key_points with keyPoints field", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { min_key_points: 2 },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(
          artifactPath,
          JSON.stringify({ keyPoints: ["Point 1", "Point 2"] })
        );

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(true);
      });

      it("should validate min_outline_sections", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { min_outline_sections: 3 },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(
          artifactPath,
          JSON.stringify({
            suggestedOutline: ["Intro", "Body", "Conclusion"],
          })
        );

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(true);
      });

      it("should validate has_hooks with top-level hooks array", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { has_hooks: true },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(
          artifactPath,
          JSON.stringify({ hooks: ["hook1", "hook2"] })
        );

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(true);
      });

      it("should validate has_hooks with nested ideas.hooks array", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { has_hooks: true },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(
          artifactPath,
          JSON.stringify({ ideas: { hooks: ["hook1"] } })
        );

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(true);
      });

      it("should fail has_hooks when no hooks present", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              validate: { has_hooks: true },
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(artifactPath, JSON.stringify({ content: "no hooks" }));

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(false);
      });

      it("should pass validation when no criteria specified", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: {
              output: "outputs/step1.json",
              validated: false,
              // No validate criteria
            },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(artifactPath, JSON.stringify({ any: "content" }));

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        const updatedManifest = JSON.parse(
          await readFile(join(sandboxDir, "validation.json"), "utf-8")
        );
        expect(updatedManifest.steps.step1.validated).toBe(true);
      });
    });

    describe("lock handling", () => {
      it("should acquire and release lock during manifest update", async () => {
        const sandboxDir = join(sandboxRoot, "test-sandbox");
        await mkdir(join(sandboxDir, "outputs"), { recursive: true });

        const manifest = {
          workflow: "test-workflow",
          steps: {
            step1: { output: "outputs/step1.json", validated: false },
          },
        };
        await writeFile(
          join(sandboxDir, "validation.json"),
          JSON.stringify(manifest)
        );

        const artifactPath = join(sandboxDir, "outputs/step1.json");
        await writeFile(artifactPath, JSON.stringify({ data: "test" }));

        const hook = createPostWriteValidateHook();

        await hook({
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: { file_path: artifactPath },
        });

        // Lock should be released after hook completes
        const lockPath = join(sandboxDir, "validation.json.lock");
        let lockExists = true;
        try {
          await readFile(lockPath);
        } catch {
          lockExists = false;
        }
        expect(lockExists).toBe(false);
      });
    });
  });

  describe("createWorkflowHooks", () => {
    it("should create hooks configuration with Stop, SubagentStop, and PostToolUse", () => {
      const hooks = createWorkflowHooks();

      expect(hooks.Stop).toBeDefined();
      expect(hooks.SubagentStop).toBeDefined();
      expect(hooks.PostToolUse).toBeDefined();
    });

    it("should have Stop hooks array", () => {
      const hooks = createWorkflowHooks();

      expect(Array.isArray(hooks.Stop)).toBe(true);
      expect(hooks.Stop?.length).toBeGreaterThan(0);
      expect(hooks.Stop?.[0].hooks).toBeDefined();
    });

    it("should have PostToolUse hooks with Write matcher", () => {
      const hooks = createWorkflowHooks();

      expect(Array.isArray(hooks.PostToolUse)).toBe(true);
      expect(hooks.PostToolUse?.length).toBeGreaterThan(0);
      expect(hooks.PostToolUse?.[0].matcher).toBe("Write");
    });
  });
});
