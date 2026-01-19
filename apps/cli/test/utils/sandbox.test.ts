/**
 * Sandbox Utilities Unit Tests (v0.7.2)
 *
 * Tests for copyOutputsToDestination and related sandbox utilities.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  copyOutputsToDestination,
  SANDBOX_DIRS,
  writeWorkflowArtifact,
} from "../../src/utils/sandbox";

describe("copyOutputsToDestination", () => {
  let testWorkspace: string;
  let testDest: string;
  const sandboxId = "test-sandbox-2026-01-15-abcd";

  beforeEach(() => {
    // Create unique test directories
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    testWorkspace = join(tmpdir(), `sandbox-test-workspace-${uniqueId}`);
    testDest = join(tmpdir(), `sandbox-test-dest-${uniqueId}`);

    // Create sandbox structure
    mkdirSync(join(testWorkspace, "sandbox", sandboxId, SANDBOX_DIRS.OUTPUTS), {
      recursive: true,
    });
  });

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
    if (existsSync(testDest)) {
      rmSync(testDest, { recursive: true, force: true });
    }
  });

  test("should copy files to destination directory", () => {
    // Create test output files
    const outputsDir = join(
      testWorkspace,
      "sandbox",
      sandboxId,
      SANDBOX_DIRS.OUTPUTS
    );
    writeFileSync(join(outputsDir, "result.json"), '{"status":"success"}');
    writeFileSync(join(outputsDir, "step-1.json"), '{"step":1}');

    const count = copyOutputsToDestination(testWorkspace, sandboxId, testDest);

    expect(count).toBe(2);
    expect(existsSync(join(testDest, "result.json"))).toBe(true);
    expect(existsSync(join(testDest, "step-1.json"))).toBe(true);

    // Verify content
    const content = readFileSync(join(testDest, "result.json"), "utf-8");
    expect(content).toBe('{"status":"success"}');
  });

  test("should create destination directory if not exists", () => {
    const outputsDir = join(
      testWorkspace,
      "sandbox",
      sandboxId,
      SANDBOX_DIRS.OUTPUTS
    );
    writeFileSync(join(outputsDir, "output.json"), "{}");

    const newDest = join(testDest, "nested", "path");
    expect(existsSync(newDest)).toBe(false);

    copyOutputsToDestination(testWorkspace, sandboxId, newDest);

    expect(existsSync(newDest)).toBe(true);
    expect(existsSync(join(newDest, "output.json"))).toBe(true);
  });

  test("should return count of copied files", () => {
    const outputsDir = join(
      testWorkspace,
      "sandbox",
      sandboxId,
      SANDBOX_DIRS.OUTPUTS
    );
    writeFileSync(join(outputsDir, "a.json"), "{}");
    writeFileSync(join(outputsDir, "b.json"), "{}");
    writeFileSync(join(outputsDir, "c.json"), "{}");

    const count = copyOutputsToDestination(testWorkspace, sandboxId, testDest);

    expect(count).toBe(3);
  });

  test("should handle empty outputs directory", () => {
    // Outputs directory exists but is empty
    const count = copyOutputsToDestination(testWorkspace, sandboxId, testDest);

    expect(count).toBe(0);
    expect(existsSync(testDest)).toBe(true); // Dest still created
  });

  test("should handle non-existent sandbox gracefully", () => {
    const count = copyOutputsToDestination(
      testWorkspace,
      "non-existent-sandbox",
      testDest
    );

    expect(count).toBe(0);
  });

  test("should only copy files, not directories", () => {
    const outputsDir = join(
      testWorkspace,
      "sandbox",
      sandboxId,
      SANDBOX_DIRS.OUTPUTS
    );
    writeFileSync(join(outputsDir, "file.json"), "{}");
    mkdirSync(join(outputsDir, "subdir"), { recursive: true });
    writeFileSync(join(outputsDir, "subdir", "nested.json"), "{}");

    const count = copyOutputsToDestination(testWorkspace, sandboxId, testDest);

    // Should only copy the top-level file, not the directory
    expect(count).toBe(1);
    expect(existsSync(join(testDest, "file.json"))).toBe(true);
    expect(existsSync(join(testDest, "subdir"))).toBe(false);
  });

  test("should return 0 for empty input parameters", () => {
    expect(copyOutputsToDestination("", sandboxId, testDest)).toBe(0);
    expect(copyOutputsToDestination(testWorkspace, "", testDest)).toBe(0);
    expect(copyOutputsToDestination(testWorkspace, sandboxId, "")).toBe(0);
  });
});

describe("writeWorkflowArtifact", () => {
  let testWorkspace: string;

  beforeEach(() => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    testWorkspace = join(tmpdir(), `artifact-test-workspace-${uniqueId}`);
    mkdirSync(testWorkspace, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  test("should write workflow file to workflows directory", () => {
    const filename = "test-workflow.md";
    const content = "---\nname: test\n---\n\n# Test Workflow";

    const result = writeWorkflowArtifact(testWorkspace, filename, content);

    expect(result).toBe(join(testWorkspace, "workflows", filename));
    expect(existsSync(result as string)).toBe(true);

    const written = readFileSync(result as string, "utf-8");
    expect(written).toBe(content);
  });

  test("should create workflows directory if not exists", () => {
    const workflowsDir = join(testWorkspace, "workflows");
    expect(existsSync(workflowsDir)).toBe(false);

    writeWorkflowArtifact(testWorkspace, "new-workflow.md", "content");

    expect(existsSync(workflowsDir)).toBe(true);
  });

  test("should overwrite existing workflow file", () => {
    const filename = "existing.md";
    const workflowsDir = join(testWorkspace, "workflows");
    mkdirSync(workflowsDir, { recursive: true });
    writeFileSync(join(workflowsDir, filename), "old content");

    const newContent = "new content";
    writeWorkflowArtifact(testWorkspace, filename, newContent);

    const written = readFileSync(join(workflowsDir, filename), "utf-8");
    expect(written).toBe(newContent);
  });

  test("should return null for empty workspace", () => {
    const result = writeWorkflowArtifact("", "file.md", "content");
    expect(result).toBeNull();
  });

  test("should return null for empty filename", () => {
    const result = writeWorkflowArtifact(testWorkspace, "", "content");
    expect(result).toBeNull();
  });

  test("should return null for empty content", () => {
    const result = writeWorkflowArtifact(testWorkspace, "file.md", "");
    expect(result).toBeNull();
  });

  test("should return full absolute path", () => {
    const result = writeWorkflowArtifact(
      testWorkspace,
      "my-workflow.md",
      "content"
    );

    expect(result).toContain(testWorkspace);
    expect(result).toContain("workflows");
    expect(result).toContain("my-workflow.md");
  });
});
