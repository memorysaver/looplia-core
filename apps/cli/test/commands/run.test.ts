/**
 * Run Command Unit Tests
 *
 * Tests for the run command's internal functions,
 * particularly createInitialValidationJson.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createInitialValidationJson,
  generateInputlessSandboxId,
  isJsonValue,
  parseArgs,
  type ValidationJson,
} from "../../src/commands/run";

// Top-level regex patterns to avoid performance issues in tests
const SANDBOX_ID_PATTERN = /^[\w-]+-\d{4}-\d{2}-\d{2}-[a-f0-9]{4}$/;

describe("run command", () => {
  describe("createInitialValidationJson", () => {
    let testDir: string;

    beforeEach(() => {
      // Create a unique test directory
      testDir = join(
        tmpdir(),
        `run-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      );
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      // Clean up test directory
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    test("should create validation.json with correct structure", () => {
      const sandboxId = "test-sandbox-123";
      const workflowId = "writing-kit";

      createInitialValidationJson(testDir, sandboxId, workflowId);

      const validationPath = join(testDir, "validation.json");
      expect(existsSync(validationPath)).toBe(true);

      const content = JSON.parse(
        readFileSync(validationPath, "utf-8")
      ) as ValidationJson;

      expect(content.workflow).toBe(workflowId);
      expect(content.sandboxId).toBe(sandboxId);
      expect(content.version).toBe("1.0.0");
      expect(content.status).toBe("pending");
      expect(content.steps).toEqual({});
    });

    test("should include valid ISO timestamp in createdAt", () => {
      const beforeTime = new Date().toISOString();

      createInitialValidationJson(testDir, "sandbox-1", "workflow-1");

      const afterTime = new Date().toISOString();
      const content = JSON.parse(
        readFileSync(join(testDir, "validation.json"), "utf-8")
      ) as ValidationJson;

      // Verify createdAt is a valid ISO string between before and after
      expect(content.createdAt).toBeDefined();
      expect(new Date(content.createdAt).toISOString()).toBe(content.createdAt);
      expect(content.createdAt >= beforeTime).toBe(true);
      expect(content.createdAt <= afterTime).toBe(true);
    });

    test("should create properly formatted JSON", () => {
      createInitialValidationJson(testDir, "sandbox-2", "workflow-2");

      const rawContent = readFileSync(
        join(testDir, "validation.json"),
        "utf-8"
      );

      // Should be formatted with 2-space indentation
      expect(rawContent).toContain("  ");
      expect(rawContent.endsWith("\n}")).toBe(true);
    });

    test("should handle special characters in IDs", () => {
      const sandboxId = "my-article-2025-12-22-ab12";
      const workflowId = "video-to-blog";

      createInitialValidationJson(testDir, sandboxId, workflowId);

      const content = JSON.parse(
        readFileSync(join(testDir, "validation.json"), "utf-8")
      ) as ValidationJson;

      expect(content.sandboxId).toBe(sandboxId);
      expect(content.workflow).toBe(workflowId);
    });

    test("should throw error when directory does not exist", () => {
      const nonExistentDir = join(testDir, "non-existent", "path");

      expect(() => {
        createInitialValidationJson(nonExistentDir, "sandbox", "workflow");
      }).toThrow();
    });
  });

  describe("isJsonValue (Priority 1 Fix)", () => {
    test("should return true for valid JSON object", () => {
      expect(isJsonValue('{"key":"value"}')).toBe(true);
    });

    test("should return true for valid JSON array", () => {
      expect(isJsonValue("[1,2,3]")).toBe(true);
    });

    test("should return true for JSON with whitespace", () => {
      expect(isJsonValue('  {"key":"value"}  ')).toBe(true);
    });

    test("should return false for file path starting with {", () => {
      // This is the edge case from PR review - {production}.json should be file, not JSON
      expect(isJsonValue("{production}.json")).toBe(false);
    });

    test("should return false for file path starting with [", () => {
      expect(isJsonValue("[backup]-config.json")).toBe(false);
    });

    test("should return false for regular file path", () => {
      expect(isJsonValue("config.json")).toBe(false);
    });

    test("should return false for path with curly braces in middle", () => {
      expect(isJsonValue("path/to/{env}/config.json")).toBe(false);
    });
  });

  describe("parseArgs duplicate input detection (Priority 1 Fix)", () => {
    test("should parse single input correctly", () => {
      const result = parseArgs([
        "workflow",
        "--input",
        "video=path/to/video.md",
      ]);
      expect(result.inputs).toBeDefined();
      expect(result.inputs?.video).toBeDefined();
      expect(result.inputs?.video.type).toBe("file");
      expect(result.inputs?.video.value).toBe("path/to/video.md");
    });

    test("should parse multiple different inputs", () => {
      const result = parseArgs([
        "workflow",
        "--input",
        "video1=v1.md",
        "--input",
        "video2=v2.md",
      ]);
      expect(result.inputs).toBeDefined();
      expect(result.inputs?.video1).toBeDefined();
      expect(result.inputs?.video2).toBeDefined();
    });

    test("should throw error for duplicate input names", () => {
      expect(() => {
        parseArgs([
          "workflow",
          "--input",
          "video=v1.md",
          "--input",
          "video=v2.md",
        ]);
      }).toThrow("Duplicate input name: 'video'");
    });

    test("should parse JSON input correctly", () => {
      const result = parseArgs([
        "workflow",
        "--input",
        'config={"key":"value"}',
      ]);
      expect(result.inputs?.config.type).toBe("json");
      expect(result.inputs?.config.value).toBe('{"key":"value"}');
    });
  });

  describe("parseArgs output flag (v0.7.2)", () => {
    test("should parse --output flag", () => {
      const result = parseArgs(["workflow", "--output", "./results"]);
      expect(result.output).toBe("./results");
    });

    test("should parse -o short flag", () => {
      const result = parseArgs(["workflow", "-o", "./results"]);
      expect(result.output).toBe("./results");
    });

    test("should handle output with other flags", () => {
      const result = parseArgs([
        "workflow",
        "--file",
        "input.md",
        "--output",
        "./out",
      ]);
      expect(result.output).toBe("./out");
      expect(result.file).toBe("input.md");
    });

    test("should handle output with absolute path", () => {
      const result = parseArgs(["workflow", "--output", "/tmp/outputs"]);
      expect(result.output).toBe("/tmp/outputs");
    });

    test("should handle output flag at end of args", () => {
      const result = parseArgs([
        "workflow",
        "--file",
        "x.md",
        "--mock",
        "-o",
        "./out",
      ]);
      expect(result.output).toBe("./out");
      expect(result.file).toBe("x.md");
      expect(result.mock).toBe(true);
    });

    test("should return undefined when no output specified", () => {
      // Tests that parseArgs returns undefined for output, allowing
      // runRunCommand to apply priority: flag > env > cwd
      const result = parseArgs(["workflow", "--file", "x.md"]);
      expect(result.output).toBeUndefined();
    });
  });

  describe("generateInputlessSandboxId (Priority 1 Fix)", () => {
    test("should use workflow ID in sandbox name", () => {
      const sandboxId = generateInputlessSandboxId("hn-reporter");
      expect(sandboxId).toMatch(SANDBOX_ID_PATTERN);
      expect(sandboxId.startsWith("hn-reporter-")).toBe(true);
    });

    test("should always include workflow slug at start", () => {
      const sandboxId = generateInputlessSandboxId("video-comparison");
      expect(sandboxId.startsWith("video-comparison-")).toBe(true);
      expect(sandboxId).toMatch(SANDBOX_ID_PATTERN);
    });

    test("should sanitize workflow ID with special chars", () => {
      const sandboxId = generateInputlessSandboxId("My_Workflow!@#$");
      // Should convert to lowercase, replace non-alphanumeric with dashes
      expect(sandboxId).toMatch(SANDBOX_ID_PATTERN);
      expect(sandboxId.startsWith("my-workflow-")).toBe(true);
    });
  });
});
