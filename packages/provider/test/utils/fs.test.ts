import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, pathExists } from "../../src/utils/fs";
import { createTempWorkspace } from "../claude-agent-sdk/fixtures/test-data";

describe("utils/fs", () => {
  let tempWorkspace: { path: string; cleanup: () => Promise<void> };

  beforeEach(async () => {
    tempWorkspace = await createTempWorkspace();
  });

  afterEach(async () => {
    await tempWorkspace.cleanup();
  });

  describe("pathExists", () => {
    it("should return true for existing directory", async () => {
      const exists = await pathExists(tempWorkspace.path);
      expect(exists).toBe(true);
    });

    it("should return false for non-existent path", async () => {
      const exists = await pathExists(
        join(tempWorkspace.path, "does-not-exist")
      );
      expect(exists).toBe(false);
    });

    it("should return true for existing file", async () => {
      const filePath = join(tempWorkspace.path, "test.txt");
      await writeFile(filePath, "test content");

      const exists = await pathExists(filePath);
      expect(exists).toBe(true);
    });
  });

  describe("ensureDir", () => {
    it("should create directory if it does not exist", async () => {
      const dirPath = join(tempWorkspace.path, "new-dir");

      await ensureDir(dirPath);

      const exists = await pathExists(dirPath);
      expect(exists).toBe(true);
    });

    it("should create nested directories", async () => {
      const nestedPath = join(tempWorkspace.path, "a", "b", "c");

      await ensureDir(nestedPath);

      const exists = await pathExists(nestedPath);
      expect(exists).toBe(true);
    });

    it("should not throw if directory already exists", async () => {
      const dirPath = join(tempWorkspace.path, "existing");

      await ensureDir(dirPath);
      await expect(ensureDir(dirPath)).resolves.toBeUndefined();
    });
  });
});
