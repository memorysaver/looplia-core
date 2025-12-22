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
  type ValidationJson,
} from "../../src/commands/run";

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
});
