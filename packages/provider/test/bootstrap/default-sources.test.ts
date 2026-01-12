/**
 * Default Sources Installation Tests (v0.7.1)
 *
 * Tests for the skill marketplace installation during looplia init:
 * - syncRegistrySources() - Downloads sources, splits marketplaces, generates plugins
 * - getProdPluginPaths() - Scans both root AND plugins/ directories
 * - Workspace structure validation
 *
 * v0.7.1: Uses unified syncRegistrySources() from registry/sync.ts
 *
 * Uses LOOPLIA_HOME env var to redirect to temp workspace for testing.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { InstallResult } from "@looplia-core/core";
import { getProdPluginPaths } from "../../src/bootstrap/index";
import { initializeRegistry } from "../../src/registry/compiler";
import { syncRegistrySources } from "../../src/registry/sync";
import { pathExists } from "../../src/utils/fs";
import {
  createLoopliaWorkspace,
  createMockPluginInWorkspace,
  type LoopliaTestWorkspace,
} from "../claude-agent-sdk/fixtures/test-data";

/**
 * v0.7.1: Helper that mimics the old installDefaultSources() behavior
 * for backward compatibility with existing tests.
 * Combines initializeRegistry() + syncRegistrySources().
 */
async function installDefaultSources(): Promise<InstallResult[]> {
  // Initialize registry (creates sources.json)
  await initializeRegistry();

  // Sync all sources
  const syncResults = await syncRegistrySources();

  // Flatten plugins from all sync results
  const installResults: InstallResult[] = [];
  for (const result of syncResults) {
    installResults.push(...result.plugins);
  }

  return installResults;
}

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

    it(
      "should create plugins/ directory if not exists",
      async () => {
        const pluginsDir = join(workspace.path, "plugins");

        // Verify plugins/ doesn't exist yet
        expect(await pathExists(pluginsDir)).toBe(false);

        // Call installDefaultSources (will fail git clone, but should create dir)
        await installDefaultSources();

        // plugins/ should now exist
        expect(await pathExists(pluginsDir)).toBe(true);
      },
      { timeout: 60_000 }
    );

    it(
      "should create registry/ directory if not exists",
      async () => {
        const registryDir = join(workspace.path, "registry");

        // Note: createLoopliaWorkspace already creates registry/
        // But installDefaultSources should ensure it exists
        await installDefaultSources();

        expect(await pathExists(registryDir)).toBe(true);
      },
      { timeout: 60_000 }
    );

    it(
      "should return InstallResult[] with status",
      async () => {
        const results = await installDefaultSources();

        expect(Array.isArray(results)).toBe(true);
        // Each result should have skill and status
        for (const result of results) {
          expect(result).toHaveProperty("skill");
          expect(result).toHaveProperty("status");
          // v0.7.1: also includes "already_installed"
          expect([
            "installed",
            "updated",
            "failed",
            "already_installed",
          ]).toContain(result.status);
        }
      },
      { timeout: 60_000 }
    );

    it(
      "should handle git clone failure gracefully",
      async () => {
        // installDefaultSources tries to clone from GitHub
        // If offline or network fails, should not throw
        const results = await installDefaultSources();

        // Should return results (possibly with failed status)
        expect(Array.isArray(results)).toBe(true);
      },
      { timeout: 60_000 }
    );
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

    it(
      "should have registry/ directory after installDefaultSources",
      async () => {
        await installDefaultSources();

        const registryDir = join(workspace.path, "registry");
        expect(await pathExists(registryDir)).toBe(true);
      },
      { timeout: 60_000 }
    );

    it(
      "should have plugins/ directory after installDefaultSources",
      async () => {
        await installDefaultSources();

        const pluginsDir = join(workspace.path, "plugins");
        expect(await pathExists(pluginsDir)).toBe(true);
      },
      { timeout: 60_000 }
    );

    it(
      "should respect LOOPLIA_HOME environment variable",
      async () => {
        // Set a custom LOOPLIA_HOME
        const customPath = workspace.path;
        process.env.LOOPLIA_HOME = customPath;

        await installDefaultSources();

        // Directories should be created in custom path, not ~/.looplia
        const pluginsDir = join(customPath, "plugins");
        const registryDir = join(customPath, "registry");

        expect(await pathExists(pluginsDir)).toBe(true);
        expect(await pathExists(registryDir)).toBe(true);
      },
      { timeout: 60_000 }
    );
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
        "should split anthropic-skills into document-skills and example-skills",
        async () => {
          const results = await installDefaultSources();

          // Find results for split plugins
          const docResult = results.find((r) => r.skill === "document-skills");
          const exampleResult = results.find(
            (r) => r.skill === "example-skills"
          );

          // Should have installed (split from anthropic-skills)
          expect(docResult).toBeDefined();
          expect(docResult?.status).toBe("installed");
          expect(exampleResult).toBeDefined();
          expect(exampleResult?.status).toBe("installed");

          // Verify directories were created
          const docPath = join(workspace.path, "plugins", "document-skills");
          const examplePath = join(workspace.path, "plugins", "example-skills");
          expect(await pathExists(docPath)).toBe(true);
          expect(await pathExists(examplePath)).toBe(true);
        },
        { timeout: 60_000 }
      );

      it(
        "should create valid plugin structure with skills/",
        async () => {
          await installDefaultSources();

          // Check document-skills plugin structure
          const docPluginPath = join(
            workspace.path,
            "plugins",
            "document-skills"
          );
          const docSkillsDir = join(docPluginPath, "skills");

          // Should have skills directory
          expect(await pathExists(docSkillsDir)).toBe(true);

          // Should have document skills (xlsx, pdf, docx, pptx)
          const docSkills = await readdir(docSkillsDir);
          expect(docSkills).toContain("xlsx");
          expect(docSkills).toContain("pdf");
          expect(docSkills).toContain("docx");
          expect(docSkills).toContain("pptx");

          // Should have plugin.json
          const pluginJsonPath = join(
            docPluginPath,
            ".claude-plugin",
            "plugin.json"
          );
          expect(await pathExists(pluginJsonPath)).toBe(true);
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

          // Should have anthropic-skills entry (v0.7.1: id format is "github:anthropics/skills")
          const anthropicEntry = sources.find((s: { id: string }) =>
            s.id.includes("anthropics/skills")
          );
          expect(anthropicEntry).toBeDefined();
          expect(anthropicEntry.url).toContain("github.com/anthropics/skills");
        },
        { timeout: 60_000 }
      );

      it(
        "should reinstall plugins on second call (fresh clone + split)",
        async () => {
          // First install
          const results1 = await installDefaultSources();
          const docResult1 = results1.find(
            (r) => r.skill === "document-skills"
          );
          expect(docResult1?.status).toBe("installed");

          // Second call reinstalls (clones fresh to temp, then splits)
          // This tests idempotency - should still succeed
          const results2 = await installDefaultSources();
          const docResult2 = results2.find(
            (r) => r.skill === "document-skills"
          );
          expect(docResult2?.status).toBe("installed");
        },
        { timeout: 120_000 }
      );

      it(
        "should create individual plugins from awesome-claude-skills (ComposioHQ)",
        async () => {
          const results = await installDefaultSources();

          // ComposioHQ style: each plugins[] entry = 1 plugin
          const brandResult = results.find(
            (r) => r.skill === "brand-guidelines"
          );
          const mcpResult = results.find((r) => r.skill === "mcp-builder");

          expect(brandResult).toBeDefined();
          expect(brandResult?.status).toBe("installed");
          expect(mcpResult).toBeDefined();
          expect(mcpResult?.status).toBe("installed");

          // Verify directories created
          const brandPath = join(workspace.path, "plugins", "brand-guidelines");
          const mcpPath = join(workspace.path, "plugins", "mcp-builder");
          expect(await pathExists(brandPath)).toBe(true);
          expect(await pathExists(mcpPath)).toBe(true);
        },
        { timeout: 60_000 }
      );

      it(
        "should create ComposioHQ plugins with single skill matching plugin name",
        async () => {
          await installDefaultSources();

          // Each ComposioHQ plugin has 1 skill with same name as plugin
          const brandSkillsDir = join(
            workspace.path,
            "plugins",
            "brand-guidelines",
            "skills"
          );
          expect(await pathExists(brandSkillsDir)).toBe(true);

          const brandSkills = await readdir(brandSkillsDir);
          expect(brandSkills).toHaveLength(1);
          expect(brandSkills).toContain("brand-guidelines"); // Skill name = plugin name
        },
        { timeout: 60_000 }
      );

      it(
        "should install 29+ plugins total from both marketplaces",
        async () => {
          const results = await installDefaultSources();

          const installed = results.filter((r) => r.status === "installed");

          // 2 from Anthropic (document-skills, example-skills) + 27 from ComposioHQ
          expect(installed.length).toBeGreaterThanOrEqual(29);
        },
        { timeout: 60_000 }
      );
    }
  );
});
