import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ensureDir,
  isValidGitUrl,
  isValidPathSegment,
  pathExists,
} from "../../src/utils/fs";
import { createTempWorkspace } from "../claude-agent-sdk/fixtures/test-data";

describe("utils/fs security", () => {
  describe("isValidGitUrl", () => {
    it("should accept valid GitHub HTTPS URLs", () => {
      expect(isValidGitUrl("https://github.com/user/repo")).toBe(true);
      expect(isValidGitUrl("https://github.com/user/repo.git")).toBe(true);
      expect(isValidGitUrl("https://github.com/anthropics/skills")).toBe(true);
    });

    it("should accept valid GitLab HTTPS URLs", () => {
      expect(isValidGitUrl("https://gitlab.com/user/repo")).toBe(true);
      expect(isValidGitUrl("https://gitlab.com/user/repo.git")).toBe(true);
    });

    it("should accept valid Bitbucket HTTPS URLs", () => {
      expect(isValidGitUrl("https://bitbucket.org/user/repo")).toBe(true);
      expect(isValidGitUrl("https://bitbucket.org/user/repo.git")).toBe(true);
    });

    it("should reject HTTP URLs (require HTTPS)", () => {
      expect(isValidGitUrl("http://github.com/user/repo")).toBe(false);
    });

    it("should reject untrusted hosts", () => {
      expect(isValidGitUrl("https://evil.com/user/repo")).toBe(false);
      expect(isValidGitUrl("https://github.evil.com/user/repo")).toBe(false);
    });

    it("should reject URLs with shell injection characters", () => {
      expect(isValidGitUrl("https://github.com/user/repo; rm -rf /")).toBe(
        false
      );
      expect(isValidGitUrl("https://github.com/user/repo`whoami`")).toBe(false);
      expect(isValidGitUrl("https://github.com/user/repo$(whoami)")).toBe(
        false
      );
      expect(
        isValidGitUrl("https://github.com/user/repo|cat /etc/passwd")
      ).toBe(false);
      expect(isValidGitUrl("https://github.com/user/repo&echo")).toBe(false);
    });

    it("should reject empty or invalid inputs", () => {
      expect(isValidGitUrl("")).toBe(false);
      expect(isValidGitUrl("not-a-url")).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isValidGitUrl(null)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isValidGitUrl(undefined)).toBe(false);
    });
  });

  describe("isValidPathSegment", () => {
    it("should accept valid path segments", () => {
      expect(isValidPathSegment("skill-name")).toBe(true);
      expect(isValidPathSegment("my_skill")).toBe(true);
      expect(isValidPathSegment("skill123")).toBe(true);
    });

    it("should reject path traversal attempts", () => {
      expect(isValidPathSegment("..")).toBe(false);
      expect(isValidPathSegment("../etc/passwd")).toBe(false);
      expect(isValidPathSegment("skill/../../etc")).toBe(false);
    });

    it("should reject absolute paths", () => {
      expect(isValidPathSegment("/etc/passwd")).toBe(false);
      expect(isValidPathSegment("/home/user")).toBe(false);
    });

    it("should reject null bytes", () => {
      expect(isValidPathSegment("skill\0name")).toBe(false);
    });

    it("should reject empty or invalid inputs", () => {
      expect(isValidPathSegment("")).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isValidPathSegment(null)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isValidPathSegment(undefined)).toBe(false);
    });
  });
});

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
