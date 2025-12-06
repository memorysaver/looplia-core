import { access, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  ensureWorkspace,
  getWorkspacePath,
} from "../../src/claude-agent-sdk/workspace";
import { createTempWorkspace } from "./fixtures/test-data";

describe("workspace", () => {
  let tempWorkspace: { path: string; cleanup: () => Promise<void> };

  beforeEach(async () => {
    tempWorkspace = await createTempWorkspace();
  });

  afterEach(async () => {
    await tempWorkspace.cleanup();
  });

  describe("getWorkspacePath", () => {
    it("should expand ~ to home directory", () => {
      const path = getWorkspacePath("~/.looplia");
      expect(path).toBe(join(homedir(), ".looplia"));
    });

    it("should return absolute paths unchanged", () => {
      const path = getWorkspacePath("/custom/path");
      expect(path).toBe("/custom/path");
    });

    it("should default to ~/.looplia", () => {
      const path = getWorkspacePath();
      expect(path).toBe(join(homedir(), ".looplia"));
    });
  });

  describe("ensureWorkspace", () => {
    it("should create workspace directory structure", async () => {
      const workspacePath = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        installDefaults: false,
      });

      expect(workspacePath).toBe(tempWorkspace.path);

      // Check directories were created
      const entries = await readdir(workspacePath);
      expect(entries).toContain("agents");
      expect(entries).toContain("skills");
      expect(entries).toContain("plugins");
    });

    it("should create agents directory", async () => {
      const workspacePath = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        installDefaults: false,
      });

      const agentsDir = join(workspacePath, "agents");
      const stats = await stat(agentsDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should create skills directory", async () => {
      const workspacePath = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        installDefaults: false,
      });

      const skillsDir = join(workspacePath, "skills");
      const stats = await stat(skillsDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should create plugins directory", async () => {
      const workspacePath = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        installDefaults: false,
      });

      const pluginsDir = join(workspacePath, "plugins");
      const stats = await stat(pluginsDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should be idempotent (safe to call multiple times)", async () => {
      const path1 = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        installDefaults: false,
      });

      const path2 = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        installDefaults: false,
      });

      expect(path1).toBe(path2);

      // Directories should still exist
      const entries = await readdir(tempWorkspace.path);
      expect(entries).toContain("agents");
    });

    it("should handle ~ path expansion", async () => {
      // Note: This test doesn't actually create in home dir
      // Just verifies the expansion logic works
      const path = getWorkspacePath("~/test-looplia");
      expect(path.startsWith(homedir())).toBe(true);
    });
  });
});
