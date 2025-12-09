import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  persistResultToWorkspace,
  TEMP_ID_PATTERN,
} from "../../src/claude-agent-sdk/utils/persist-result";

describe("persist-result", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `persist-test-${Date.now()}`);
    await mkdir(join(testDir, "contentItem"), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("TEMP_ID_PATTERN", () => {
    it("should match cli-timestamp format", () => {
      expect(TEMP_ID_PATTERN.test("cli-1234567890")).toBe(true);
      expect(TEMP_ID_PATTERN.test("cli-0")).toBe(true);
    });

    it("should not match other formats", () => {
      expect(TEMP_ID_PATTERN.test("session-abc123")).toBe(false);
      expect(TEMP_ID_PATTERN.test("cli-abc")).toBe(false);
      expect(TEMP_ID_PATTERN.test("1234567890")).toBe(false);
    });
  });

  describe("persistResultToWorkspace", () => {
    it("should write to original location when no sessionId", async () => {
      const contentDir = join(testDir, "contentItem", "test-id");
      await mkdir(contentDir, { recursive: true });

      const data = { contentId: "", value: "test" };
      const result = await persistResultToWorkspace(data, {
        workspace: testDir,
        contentId: "test-id",
        filename: "result.json",
      });

      expect(result.finalContentId).toBe("test-id");
      expect(data.contentId).toBe("test-id");

      const written = JSON.parse(
        await readFile(join(contentDir, "result.json"), "utf-8")
      );
      expect(written.value).toBe("test");
    });

    it("should relocate folder when sessionId provided", async () => {
      const tempDir = join(testDir, "contentItem", "cli-123");
      await mkdir(tempDir, { recursive: true });
      await writeFile(join(tempDir, "content.md"), "test content");

      const data = { contentId: "", value: "test" };
      const result = await persistResultToWorkspace(data, {
        workspace: testDir,
        contentId: "cli-123",
        sessionId: "session-abc",
        filename: "result.json",
      });

      expect(result.finalContentId).toBe("session-abc");
      expect(data.contentId).toBe("session-abc");

      const newDir = join(testDir, "contentItem", "session-abc");
      const written = JSON.parse(
        await readFile(join(newDir, "result.json"), "utf-8")
      );
      expect(written.value).toBe("test");
    });

    it("should use sessionId location if target already exists", async () => {
      // Target already exists (concurrent process created it)
      const newDir = join(testDir, "contentItem", "session-abc");
      await mkdir(newDir, { recursive: true });

      const data = { contentId: "", value: "test" };
      const result = await persistResultToWorkspace(data, {
        workspace: testDir,
        contentId: "cli-123",
        sessionId: "session-abc",
        filename: "result.json",
      });

      expect(result.finalContentId).toBe("session-abc");
      expect(data.contentId).toBe("session-abc");
    });

    it("should fallback to tempDir if source missing and target missing", async () => {
      // Neither source nor target exists - should create tempDir
      const data = { contentId: "", value: "test" };
      const result = await persistResultToWorkspace(data, {
        workspace: testDir,
        contentId: "cli-123",
        sessionId: "session-abc",
        filename: "result.json",
      });

      expect(result.finalContentId).toBe("cli-123");
      expect(data.contentId).toBe("cli-123");

      const tempDir = join(testDir, "contentItem", "cli-123");
      const written = JSON.parse(
        await readFile(join(tempDir, "result.json"), "utf-8")
      );
      expect(written.value).toBe("test");
    });

    it("should create directory if it does not exist", async () => {
      const data = { contentId: "", value: "test" };
      const result = await persistResultToWorkspace(data, {
        workspace: testDir,
        contentId: "new-content",
        filename: "result.json",
      });

      expect(result.finalContentId).toBe("new-content");

      const contentDir = join(testDir, "contentItem", "new-content");
      const written = JSON.parse(
        await readFile(join(contentDir, "result.json"), "utf-8")
      );
      expect(written.value).toBe("test");
    });
  });
});
