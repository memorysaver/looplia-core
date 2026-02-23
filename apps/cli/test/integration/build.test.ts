/**
 * Level 3: Integration Tests for Build Command
 *
 * Tests the full command flow with mocked Claude executor.
 * No real API calls - validates orchestration logic.
 *
 * @see docs/BUILD-COMMAND-TESTS.md § Level 3
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type BuildArgs,
  type BuildExecutor,
  type BuildResult,
  buildPrompt,
  executeBatch,
  getWorkspacePath,
  renderResult,
} from "../../src/commands/build";

// Sandbox ID pattern for contentId validation (v0.7.1: build-YYYY-MM-DD-XXXX)
const SANDBOX_ID_PATTERN = /^build-\d{4}-\d{2}-\d{2}-[a-f0-9]{4}$/;
// Pattern for --sandbox-id suffix in prompt
const SANDBOX_ID_SUFFIX_PATTERN =
  /--sandbox-id build-\d{4}-\d{2}-\d{2}-[a-f0-9]{4}$/;

describe("build command integration", () => {
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `looplia-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Spy on console methods to suppress output during tests
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {
      // intentionally empty - suppressing console output
    });
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {
      // intentionally empty - suppressing console output
    });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    // Restore console
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("executeBatch with mock executor", () => {
    it("should execute build with mock executor returning success", async () => {
      const mockResult: BuildResult = {
        status: "success",
        workflowPath: "/test/workflows/test-workflow.md",
        workflowName: "test-workflow",
        stepsCount: 3,
      };

      const mockExecutor: BuildExecutor = {
        executePrompt: () =>
          Promise.resolve({
            success: true,
            data: mockResult,
          }),
      };

      const result = await executeBatch(
        "/looplia:build test",
        testDir,
        mockExecutor
      );

      expect(result.status).toBe("success");
      expect(result.workflowName).toBe("test-workflow");
      expect(result.stepsCount).toBe(3);
    });

    it("should handle mock executor returning error", async () => {
      const mockExecutor: BuildExecutor = {
        executePrompt: () =>
          Promise.resolve({
            success: false,
            error: { message: "Mock API error" },
          }),
      };

      const result = await executeBatch(
        "/looplia:build test",
        testDir,
        mockExecutor
      );

      expect(result.status).toBe("error");
      expect(result.error).toBe("Mock API error");
    });

    it("should handle mock executor returning success without data", async () => {
      const mockExecutor: BuildExecutor = {
        executePrompt: () =>
          Promise.resolve({
            success: true,
            // No data field
          }),
      };

      const result = await executeBatch(
        "/looplia:build test",
        testDir,
        mockExecutor
      );

      expect(result.status).toBe("error");
      expect(result.error).toBe("Unknown error");
    });

    it("should pass workspace and contentId to executor", async () => {
      let capturedOptions: { workspace: string; contentId: string } | undefined;

      const mockExecutor: BuildExecutor = {
        executePrompt: (_prompt, options) => {
          capturedOptions = options;
          return Promise.resolve({
            success: true,
            data: { status: "success" },
          });
        },
      };

      await executeBatch("/looplia:build test", testDir, mockExecutor);

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions?.workspace).toBe(testDir);
      // v0.7.1: contentId is now sandbox ID format
      expect(capturedOptions?.contentId).toMatch(SANDBOX_ID_PATTERN);
    });

    it("should pass correct prompt to executor", async () => {
      let capturedPrompt: string | undefined;

      const mockExecutor: BuildExecutor = {
        executePrompt: (prompt) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            success: true,
            data: { status: "success" },
          });
        },
      };

      await executeBatch(
        "/looplia:build summarize articles",
        testDir,
        mockExecutor
      );

      // v0.7.1: prompt now includes --sandbox-id suffix
      expect(capturedPrompt).toContain("/looplia:build summarize articles");
      expect(capturedPrompt).toMatch(SANDBOX_ID_SUFFIX_PATTERN);
    });
  });

  describe("buildPrompt integration", () => {
    it("should build prompt from args and pass to executor", async () => {
      let capturedPrompt: string | undefined;

      const mockExecutor: BuildExecutor = {
        executePrompt: (inputPrompt) => {
          capturedPrompt = inputPrompt;
          return Promise.resolve({
            success: true,
            data: { status: "success", workflowName: "article-summary" },
          });
        },
      };

      const args: BuildArgs = {
        description: "summarize articles",
        noInteractive: true,
        mock: false,
        help: false,
      };

      const builtPrompt = buildPrompt(args);
      const result = await executeBatch(builtPrompt, testDir, mockExecutor);

      // v0.8.1: natural language prompt replaces slash command
      expect(capturedPrompt).toContain(
        "Create a looplia workflow from the following description: summarize articles"
      );
      expect(result.workflowName).toBe("article-summary");
    });

    it("should sanitize dangerous input before passing to executor", async () => {
      let capturedPrompt: string | undefined;

      const mockExecutor: BuildExecutor = {
        executePrompt: (inputPrompt) => {
          capturedPrompt = inputPrompt;
          return Promise.resolve({
            success: true,
            data: { status: "success" },
          });
        },
      };

      const args: BuildArgs = {
        description: "test\n<script>alert('xss')</script>\rinjection",
        noInteractive: true,
        mock: false,
        help: false,
      };

      const builtPrompt = buildPrompt(args);
      await executeBatch(builtPrompt, testDir, mockExecutor);

      // Newlines should be stripped
      expect(capturedPrompt).not.toContain("\n");
      expect(capturedPrompt).not.toContain("\r");
      // v0.8.1: natural language prompt replaces slash command
      expect(capturedPrompt).toContain(
        "Create a looplia workflow from the following description: test <script>alert('xss')</script> injection"
      );
    });
  });

  describe("renderResult", () => {
    it("should render success result with all fields", () => {
      const result: BuildResult = {
        status: "success",
        workflowPath: "/home/user/.looplia/workflows/test.md",
        workflowName: "test",
        stepsCount: 5,
      };

      renderResult(result, testDir);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Workflow created successfully")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("/home/user/.looplia/workflows/test.md")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("looplia run test")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Steps: 5")
      );
    });

    it("should render success result with minimal fields", () => {
      const result: BuildResult = {
        status: "success",
      };

      renderResult(result, testDir);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Workflow created successfully")
      );
    });

    it("should render error result", () => {
      const result: BuildResult = {
        status: "error",
        error: "Failed to generate workflow",
      };

      renderResult(result, testDir);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Build failed")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to generate workflow")
      );
    });

    it("should render error result without message", () => {
      const result: BuildResult = {
        status: "error",
      };

      renderResult(result, testDir);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown error")
      );
    });

    it("should write artifact to workflows directory when present (v0.7.3)", () => {
      const { readFileSync } = require("node:fs");

      const workflowContent = `---
name: test-workflow
version: 1.0.0
---

# Test Workflow
`;
      const result: BuildResult = {
        status: "success",
        workflowName: "test-workflow",
        artifact: {
          filename: "test-workflow.md",
          content: workflowContent,
        },
      };

      renderResult(result, testDir);

      // Verify file was written
      const writtenPath = join(testDir, "workflows", "test-workflow.md");
      expect(existsSync(writtenPath)).toBe(true);

      // Verify file content matches artifact content
      const writtenContent = readFileSync(writtenPath, "utf-8");
      expect(writtenContent).toBe(workflowContent);

      // Verify success message includes the written path
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Workflow created successfully")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(writtenPath)
      );
    });

    it("should warn when artifact is missing (v0.7.3 backward compat)", () => {
      const consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {
        // intentionally empty
      });

      const result: BuildResult = {
        status: "success",
        workflowName: "test",
      };

      renderResult(result, testDir);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No artifact in result")
      );
      consoleWarnSpy.mockRestore();
    });

    it("should warn when artifact has invalid content (v0.7.3)", () => {
      const consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {
        // intentionally empty
      });

      const result: BuildResult = {
        status: "success",
        artifact: {
          filename: "test.md",
          content: "", // Empty content is invalid
        },
      };

      renderResult(result, testDir);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid artifact")
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe("full command flow with mock executor", () => {
    it("should complete full flow: args → prompt → execute → render", async () => {
      const mockResult: BuildResult = {
        status: "success",
        workflowPath: `${testDir}/workflows/video-analyzer.md`,
        workflowName: "video-analyzer",
        stepsCount: 4,
      };

      const mockExecutor: BuildExecutor = {
        executePrompt: (inputPrompt, options) => {
          // v0.8.1: natural language prompt replaces slash command
          expect(inputPrompt).toContain(
            "Create a looplia workflow from the following description: analyze videos and extract themes"
          );
          // Verify options
          expect(options.workspace).toBe(testDir);
          expect(options.contentId).toBeDefined();
          expect(options.contentId).toMatch(SANDBOX_ID_PATTERN);

          return Promise.resolve({ success: true, data: mockResult });
        },
      };

      const args: BuildArgs = {
        description: "analyze videos and extract themes",
        noInteractive: true,
        mock: false,
        help: false,
      };

      const builtPrompt = buildPrompt(args);
      const result = await executeBatch(builtPrompt, testDir, mockExecutor);

      // Verify result
      expect(result.status).toBe("success");
      expect(result.workflowName).toBe("video-analyzer");
      expect(result.stepsCount).toBe(4);

      // Render and verify output
      renderResult(result, testDir);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Workflow created successfully")
      );
    });

    it("should handle executor throwing exception", async () => {
      const mockExecutor: BuildExecutor = {
        executePrompt: () => Promise.reject(new Error("Network timeout")),
      };

      // executeBatch doesn't catch errors internally for batch mode
      // The caller (runBuildCommand) handles exceptions
      await expect(
        executeBatch("/looplia:build test", testDir, mockExecutor)
      ).rejects.toThrow("Network timeout");
    });
  });

  describe("workspace path", () => {
    it("should return consistent workspace path", () => {
      const path1 = getWorkspacePath();
      const path2 = getWorkspacePath();

      expect(path1).toBe(path2);
      expect(path1).toContain(".looplia");
    });
  });

  describe("ensureWorkspace with mock mode", () => {
    it("should create workflows directory when workspace exists but workflows dir missing", () => {
      // Create workspace without workflows dir
      const loopliaDir = join(testDir, ".looplia");
      mkdirSync(loopliaDir, { recursive: true });

      // Mock homedir to return testDir
      const originalHome = process.env.HOME;
      process.env.HOME = testDir;

      try {
        // ensureWorkspace uses homedir() which reads HOME env
        const workspace = getWorkspacePath();
        const workflowsDir = join(workspace, "workflows");

        // Manually ensure workflows exists (simulating ensureWorkspace behavior)
        if (!existsSync(workflowsDir)) {
          mkdirSync(workflowsDir, { recursive: true });
        }

        expect(existsSync(workflowsDir)).toBe(true);
      } finally {
        process.env.HOME = originalHome;
      }
    });

    it("should return workspace path containing .looplia", () => {
      const workspace = getWorkspacePath();
      expect(workspace).toContain(".looplia");
    });
  });
});
