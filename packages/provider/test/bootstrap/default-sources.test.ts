/**
 * Default Sources Installation Tests (v0.7.0)
 *
 * Tests for the new skill marketplace installation during looplia init:
 * - installDefaultSources() - Reads config, clones repos, generates sources.json
 * - getProdPluginPaths() - Scans both root AND plugins/ directories
 * - Workspace structure validation
 *
 * Uses LOOPLIA_HOME env var to redirect to temp workspace for testing.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getProdPluginPaths } from "../../src/bootstrap/index";
import { installDefaultSources } from "../../src/bootstrap/skill-installer";
import { pathExists } from "../../src/utils/fs";
import {
  createLoopliaWorkspace,
  createMockPluginInWorkspace,
  type LoopliaTestWorkspace,
} from "../claude-agent-sdk/fixtures/test-data";

/**
 * Create mock third-party plugin in plugins/ subdirectory
 */
async function createThirdPartyPlugin(
  workspace: LoopliaTestWorkspace,
  name: string,
  skills: string[]
): Promise<string> {
  const pluginsDir = join(workspace.path, "plugins");
  await mkdir(pluginsDir, { recursive: true });

  const pluginPath = join(pluginsDir, name);
  await mkdir(join(pluginPath, ".claude-plugin"), { recursive: true });

  // Create plugin.json
  await writeFile(
    join(pluginPath, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name, version: "1.0.0" })
  );

  // Create skills directories
  if (skills.length > 0) {
    await mkdir(join(pluginPath, "skills"), { recursive: true });
    for (const skill of skills) {
      const skillDir = join(pluginPath, "skills", skill);
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---\nname: ${skill}\ndescription: Mock third-party skill\n---\n# ${skill}\n\nMock skill content.`
      );
    }
  }

  return pluginPath;
}

describe("bootstrap/default-sources", () => {
  describe("getProdPluginPaths() with plugins/ directory", () => {
    let workspace: LoopliaTestWorkspace;
    let originalHome: string | undefined;

    beforeEach(async () => {
      workspace = await createLoopliaWorkspace();
      originalHome = process.env.LOOPLIA_HOME;
      process.env.LOOPLIA_HOME = workspace.path;
    });

    afterEach(async () => {
      process.env.LOOPLIA_HOME = originalHome;
      await workspace.cleanup();
    });

    it("should scan first-party plugins at root level", async () => {
      // Create first-party plugins at root
      await createMockPluginInWorkspace(workspace, "looplia-core", ["skill-a"]);
      await createMockPluginInWorkspace(workspace, "looplia-writer", [
        "skill-b",
      ]);

      const paths = await getProdPluginPaths();
      const pathStrings = paths.map((p) => p.path);

      expect(pathStrings.some((p) => p.includes("looplia-core"))).toBe(true);
      expect(pathStrings.some((p) => p.includes("looplia-writer"))).toBe(true);
    });

    it("should scan third-party plugins in plugins/ directory", async () => {
      // Create third-party plugin in plugins/ subdirectory
      await createThirdPartyPlugin(workspace, "anthropic-skills", [
        "xlsx",
        "pdf",
      ]);

      const paths = await getProdPluginPaths();
      const pathStrings = paths.map((p) => p.path);

      expect(pathStrings.some((p) => p.includes("anthropic-skills"))).toBe(
        true
      );
      expect(
        pathStrings.some((p) => p.includes("plugins/anthropic-skills"))
      ).toBe(true);
    });

    it("should exclude 'plugins', 'registry', 'sandbox', 'workflows' from root scan", async () => {
      // These directories are created by createLoopliaWorkspace
      // Plus 'plugins' and 'registry' which we exclude

      const paths = await getProdPluginPaths();
      const pathStrings = paths.map((p) => p.path);

      // None of these should appear as plugins
      for (const excluded of ["sandbox", "workflows", "plugins", "registry"]) {
        const hasExcluded = pathStrings.some(
          (p) => p.endsWith(`/${excluded}`) || p.endsWith(`\\${excluded}`)
        );
        expect(hasExcluded).toBe(false);
      }
    });

    it("should combine both first-party and third-party plugins", async () => {
      // Create first-party at root
      await createMockPluginInWorkspace(workspace, "looplia-core", ["skill-a"]);

      // Create third-party in plugins/
      await createThirdPartyPlugin(workspace, "anthropic-skills", ["xlsx"]);

      const paths = await getProdPluginPaths();
      const pathStrings = paths.map((p) => p.path);

      // Should have both
      expect(pathStrings.some((p) => p.includes("looplia-core"))).toBe(true);
      expect(pathStrings.some((p) => p.includes("anthropic-skills"))).toBe(
        true
      );
      expect(paths.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle missing plugins/ directory gracefully", async () => {
      // Only create first-party plugin, no plugins/ directory
      await createMockPluginInWorkspace(workspace, "looplia-core", ["skill-a"]);

      // Should not throw, just return first-party plugins
      const paths = await getProdPluginPaths();
      expect(paths.length).toBeGreaterThanOrEqual(1);
      expect(paths.some((p) => p.path.includes("looplia-core"))).toBe(true);
    });
  });

  describe("installDefaultSources() unit tests", () => {
    let workspace: LoopliaTestWorkspace;
    let originalHome: string | undefined;

    beforeEach(async () => {
      workspace = await createLoopliaWorkspace();
      originalHome = process.env.LOOPLIA_HOME;
      process.env.LOOPLIA_HOME = workspace.path;
    });

    afterEach(async () => {
      process.env.LOOPLIA_HOME = originalHome;
      await workspace.cleanup();
    });

    it("should create plugins/ directory if not exists", async () => {
      const pluginsDir = join(workspace.path, "plugins");

      // Verify plugins/ doesn't exist yet
      expect(await pathExists(pluginsDir)).toBe(false);

      // Call installDefaultSources (will fail git clone, but should create dir)
      await installDefaultSources();

      // plugins/ should now exist
      expect(await pathExists(pluginsDir)).toBe(true);
    });

    it("should create registry/ directory if not exists", async () => {
      const registryDir = join(workspace.path, "registry");

      // Note: createLoopliaWorkspace already creates registry/
      // But installDefaultSources should ensure it exists
      await installDefaultSources();

      expect(await pathExists(registryDir)).toBe(true);
    });

    it("should return InstallResult[] with status", async () => {
      const results = await installDefaultSources();

      expect(Array.isArray(results)).toBe(true);
      // Each result should have skill and status
      for (const result of results) {
        expect(result).toHaveProperty("skill");
        expect(result).toHaveProperty("status");
        expect(["installed", "updated", "failed"]).toContain(result.status);
      }
    });

    it("should handle git clone failure gracefully", async () => {
      // installDefaultSources tries to clone from GitHub
      // If offline or network fails, should not throw
      const results = await installDefaultSources();

      // Should return results (possibly with failed status)
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("workspace structure validation", () => {
    let workspace: LoopliaTestWorkspace;
    let originalHome: string | undefined;

    beforeEach(async () => {
      workspace = await createLoopliaWorkspace();
      originalHome = process.env.LOOPLIA_HOME;
      process.env.LOOPLIA_HOME = workspace.path;
    });

    afterEach(async () => {
      process.env.LOOPLIA_HOME = originalHome;
      await workspace.cleanup();
    });

    it("should have registry/ directory after installDefaultSources", async () => {
      await installDefaultSources();

      const registryDir = join(workspace.path, "registry");
      expect(await pathExists(registryDir)).toBe(true);
    });

    it("should have plugins/ directory after installDefaultSources", async () => {
      await installDefaultSources();

      const pluginsDir = join(workspace.path, "plugins");
      expect(await pathExists(pluginsDir)).toBe(true);
    });

    it("should respect LOOPLIA_HOME environment variable", async () => {
      // Set a custom LOOPLIA_HOME
      const customPath = workspace.path;
      process.env.LOOPLIA_HOME = customPath;

      await installDefaultSources();

      // Directories should be created in custom path, not ~/.looplia
      const pluginsDir = join(customPath, "plugins");
      const registryDir = join(customPath, "registry");

      expect(await pathExists(pluginsDir)).toBe(true);
      expect(await pathExists(registryDir)).toBe(true);
    });
  });

  // Real integration tests that actually clone from GitHub
  // Skip in CI environments to avoid network dependency
  describe.skipIf(!!process.env.CI)(
    "installDefaultSources() real clone integration",
    () => {
      let workspace: LoopliaTestWorkspace;
      let originalHome: string | undefined;

      beforeEach(async () => {
        workspace = await createLoopliaWorkspace();
        originalHome = process.env.LOOPLIA_HOME;
        process.env.LOOPLIA_HOME = workspace.path;
      });

      afterEach(async () => {
        process.env.LOOPLIA_HOME = originalHome;
        await workspace.cleanup();
      });

      it(
        "should clone anthropic-skills from GitHub",
        async () => {
          const results = await installDefaultSources();

          // Find result for anthropic-skills
          const anthropicResult = results.find(
            (r) => r.skill === "anthropic-skills"
          );

          // Should have installed or updated (if already exists)
          expect(anthropicResult).toBeDefined();
          expect(["installed", "updated"]).toContain(anthropicResult?.status);

          // Verify directory was created
          const pluginPath = join(
            workspace.path,
            "plugins",
            "anthropic-skills"
          );
          expect(await pathExists(pluginPath)).toBe(true);
        },
        { timeout: 60_000 }
      );

      it(
        "should create valid plugin structure with skills/",
        async () => {
          await installDefaultSources();

          const pluginPath = join(
            workspace.path,
            "plugins",
            "anthropic-skills"
          );
          const skillsDir = join(pluginPath, "skills");

          // Should have skills directory
          expect(await pathExists(skillsDir)).toBe(true);

          // Should have at least some skills (xlsx, pdf, etc.)
          const entries = await readdir(skillsDir);
          expect(entries.length).toBeGreaterThan(0);
        },
        { timeout: 60_000 }
      );

      it(
        "should generate registry/sources.json with entries",
        async () => {
          await installDefaultSources();

          const sourcesPath = join(workspace.path, "registry", "sources.json");
          expect(await pathExists(sourcesPath)).toBe(true);

          const content = await readFile(sourcesPath, "utf-8");
          const sources = JSON.parse(content);

          expect(Array.isArray(sources)).toBe(true);
          expect(sources.length).toBeGreaterThan(0);

          // Should have anthropic-skills entry
          const anthropicEntry = sources.find((s: { id: string }) =>
            s.id.includes("anthropic-skills")
          );
          expect(anthropicEntry).toBeDefined();
          expect(anthropicEntry.url).toContain("github.com/anthropics/skills");
        },
        { timeout: 60_000 }
      );

      it(
        "should update existing clone with git pull",
        async () => {
          // First clone
          const results1 = await installDefaultSources();
          const result1 = results1.find((r) => r.skill === "anthropic-skills");
          expect(result1?.status).toBe("installed");

          // Second call should do git pull
          const results2 = await installDefaultSources();
          const result2 = results2.find((r) => r.skill === "anthropic-skills");
          expect(result2?.status).toBe("updated");
        },
        { timeout: 120_000 }
      );
    }
  );
});
