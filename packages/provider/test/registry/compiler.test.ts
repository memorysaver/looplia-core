import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  compileRegistry,
  getRegistryPath,
  initializeRegistry,
} from "../../src/registry/compiler";
import { createTempWorkspace } from "../claude-agent-sdk/fixtures/test-data";

/**
 * Create a mock plugin structure with skills
 */
async function _createMockPlugin(
  basePath: string,
  pluginName: string,
  skills: Array<{ name: string; description: string }>
): Promise<void> {
  const pluginDir = join(basePath, pluginName);
  await mkdir(join(pluginDir, "skills"), { recursive: true });
  await mkdir(join(pluginDir, ".claude-plugin"), { recursive: true });

  // Create plugin.json
  await writeFile(
    join(pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName, version: "1.0.0" })
  );

  // Create skills
  for (const skill of skills) {
    const skillDir = join(pluginDir, "skills", skill.name);
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: ${skill.name}
description: |
  ${skill.description}
model: claude-haiku-4-5-20251001
---

# ${skill.name}

${skill.description}
`
    );
  }
}

describe("registry/compiler", () => {
  let tempWorkspace: { path: string; cleanup: () => Promise<void> };

  beforeEach(async () => {
    tempWorkspace = await createTempWorkspace();
  });

  afterEach(async () => {
    await tempWorkspace.cleanup();
  });

  describe("getRegistryPath", () => {
    it("should return path in home directory", () => {
      const path = getRegistryPath();
      expect(path).toContain(".looplia");
      expect(path).toContain("registry");
    });
  });

  describe("initializeRegistry", () => {
    it("should create registry directory structure", async () => {
      // This tests against the real ~/.looplia path
      await initializeRegistry();

      const registryPath = getRegistryPath();
      const entries = await readdir(registryPath);

      expect(entries).toContain("sources.json");
    });

    it("should create default sources.json with predefined github sources", async () => {
      await initializeRegistry(true); // Force recreate

      const registryPath = getRegistryPath();
      const sourcesFile = join(registryPath, "sources.json");
      const content = await readFile(sourcesFile, "utf-8");
      const sources = JSON.parse(content);

      // Predefined github sources (looplia, anthropic)
      expect(sources.length).toBe(2);
      expect(sources[0].id).toBe("github:memorysaver/looplia-skills");
      expect(sources[0].type).toBe("github");
      expect(sources[0].enabled).toBe(true);
      expect(sources[1].id).toBe("github:anthropics/skills");
      expect(sources[1].type).toBe("github");
    });
  });

  describe("compileRegistry", () => {
    it(
      "should compile registry and return summary",
      async () => {
        const registry = await compileRegistry();

        expect(registry.version).toBeDefined();
        expect(registry.compiledAt).toBeDefined();
        expect(registry.sources).toBeDefined();
        expect(registry.skills).toBeDefined();
        expect(registry.summary).toBeDefined();
        expect(registry.summary.totalSkills).toBeGreaterThanOrEqual(0);
        expect(registry.summary.byCategory).toBeDefined();
      },
      { timeout: 30_000 }
    );

    it("should categorize skills correctly", async () => {
      const registry = await compileRegistry();

      // Check that all expected categories exist
      const expectedCategories = [
        "analysis",
        "generation",
        "assembly",
        "validation",
        "search",
        "orchestration",
        "utility",
      ];

      for (const category of expectedCategories) {
        expect(registry.summary.byCategory[category]).toBeDefined();
      }
    });

    it("should mark local skills as installed", async () => {
      const registry = await compileRegistry();

      const _installedSkills = registry.skills.filter((s) => s.installed);
      const localSkills = registry.skills.filter((s) => s.source === "local");

      // All local skills should be marked as installed
      for (const skill of localSkills) {
        expect(skill.installed).toBe(true);
      }
    });
  });
});
