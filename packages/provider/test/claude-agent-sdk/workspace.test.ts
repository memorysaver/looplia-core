import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
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
        skipPluginBootstrap: true,
        force: true,
      });

      expect(workspacePath).toBe(tempWorkspace.path);

      // Check v0.3 directory structure: .claude/ subdirectory with agents/skills
      const entries = await readdir(workspacePath);
      expect(entries).toContain(".claude");
      expect(entries).toContain("contentItem");
      expect(entries).toContain("CLAUDE.md");
      expect(entries).toContain("user-profile.json");

      // Check .claude/ subdirectory
      const claudeEntries = await readdir(join(workspacePath, ".claude"));
      expect(claudeEntries).toContain("agents");
      expect(claudeEntries).toContain("skills");
    });

    it("should create agents directory under .claude/", async () => {
      const workspacePath = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        skipPluginBootstrap: true,
        force: true,
      });

      const agentsDir = join(workspacePath, ".claude", "agents");
      const stats = await stat(agentsDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should create skills directory under .claude/", async () => {
      const workspacePath = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        skipPluginBootstrap: true,
        force: true,
      });

      const skillsDir = join(workspacePath, ".claude", "skills");
      const stats = await stat(skillsDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should create contentItem directory", async () => {
      const workspacePath = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        skipPluginBootstrap: true,
        force: true,
      });

      const contentDir = join(workspacePath, "contentItem");
      const stats = await stat(contentDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should be idempotent (safe to call multiple times)", async () => {
      const path1 = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        skipPluginBootstrap: true,
        force: true,
      });

      const path2 = await ensureWorkspace({
        baseDir: tempWorkspace.path,
        skipPluginBootstrap: true,
      });

      expect(path1).toBe(path2);

      // Directories should still exist
      const claudeEntries = await readdir(join(tempWorkspace.path, ".claude"));
      expect(claudeEntries).toContain("agents");
    });

    it("should handle ~ path expansion", () => {
      // Note: This test doesn't actually create in home dir
      // Just verifies the expansion logic works
      const path = getWorkspacePath("~/test-looplia");
      expect(path.startsWith(homedir())).toBe(true);
    });
  });
});
