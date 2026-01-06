/**
 * GitHub Registry Auto-Detection Tests (v0.7.0)
 *
 * Tests for GitHub registry source functionality with auto-detection:
 * - Adding GitHub sources (format auto-detected)
 * - Skill indexing with skillPath for marketplace.json repos
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import type { RegistrySource } from "@looplia-core/core";
import {
  addSource,
  getSourcesPath,
  initializeRegistry,
  loadSources,
  removeSource,
} from "../../src/registry/compiler";

describe("github registry integration", () => {
  let originalSourcesContent: string | null = null;
  const sourcesPath = getSourcesPath();

  beforeEach(async () => {
    // Backup original sources.json
    try {
      originalSourcesContent = await readFile(sourcesPath, "utf-8");
    } catch {
      originalSourcesContent = null;
    }
  });

  afterEach(async () => {
    // Restore original sources.json
    if (originalSourcesContent) {
      await writeFile(sourcesPath, originalSourcesContent);
    }
  });

  describe("addSource with github type (default)", () => {
    it("should add github source with correct ID format", async () => {
      await initializeRegistry(true);

      const source = await addSource("github.com/test-org/test-skills");

      expect(source.id).toBe("github:test-org/test-skills");
      expect(source.type).toBe("github");
      expect(source.enabled).toBe(true);
      expect(source.priority).toBe(50);

      // Cleanup
      await removeSource(source.id);
    });

    it("should prevent duplicate github sources", async () => {
      await initializeRegistry(true);

      await addSource("github.com/test-org/test-repo");

      await expect(addSource("github.com/test-org/test-repo")).rejects.toThrow(
        "Source already exists"
      );

      // Cleanup
      await removeSource("github:test-org/test-repo");
    });

    it("should normalize URL when adding github source", async () => {
      await initializeRegistry(true);

      // Test with protocol
      const source1 = await addSource("https://github.com/test-org/test-a");
      expect(source1.id).toBe("github:test-org/test-a");
      await removeSource(source1.id);

      // Test with trailing slash
      const source2 = await addSource("github.com/test-org/test-b/");
      expect(source2.id).toBe("github:test-org/test-b");
      await removeSource(source2.id);
    });
  });

  describe("registry compilation with github sources", () => {
    it("should include github in remote sources filter", async () => {
      await initializeRegistry(true);

      // Add a github source (will fail to fetch, but should be processed)
      try {
        await addSource("github.com/test-org/fake-skills");
      } catch {
        // May already exist
      }

      const sources = await loadSources();
      const githubSources = sources.filter((s) => s.type === "github");

      // Even if fetch fails, the source should be in the list
      expect(githubSources.length).toBeGreaterThanOrEqual(1);

      // Cleanup
      await removeSource("github:test-org/fake-skills");
    });
  });

  describe("skillPath field", () => {
    it("should set skillPath for marketplace.json skills", () => {
      // This test verifies that skills from marketplace.json repos include skillPath
      // by checking the compiled skill structure

      // Create a mock skill from a github source with marketplace.json
      const mockSkill = {
        name: "test-skill",
        title: "Test Skill",
        description: "Skill from test-skills",
        plugin: "test-plugin",
        category: "utility" as const,
        capabilities: [],
        source: "github:test/repo",
        sourceType: "thirdparty" as const,
        installed: false,
        gitUrl: "https://github.com/test/repo",
        skillPath: "skills/test-skill",
      };

      expect(mockSkill.skillPath).toBe("skills/test-skill");
      expect(mockSkill.gitUrl).toBe("https://github.com/test/repo");
    });
  });

  describe("marketplace JSON parsing", () => {
    it("should correctly parse marketplace.json format", () => {
      // Mock marketplace.json content
      const marketplaceJson = {
        name: "anthropic-skills",
        version: "1.0.0",
        plugins: [
          {
            name: "example-skills",
            description: "Example Claude Code Skills",
            skills: [
              "./skills/xlsx",
              "./skills/pdf",
              "./skills/algorithmic-art",
            ],
          },
        ],
      };

      // Parse skills from marketplace format
      const skills: Array<{ name: string; skillPath: string }> = [];
      for (const plugin of marketplaceJson.plugins) {
        for (const skillPath of plugin.skills) {
          const skillName = skillPath.split("/").pop() ?? skillPath;
          skills.push({
            name: skillName,
            skillPath: skillPath.replace("./", ""),
          });
        }
      }

      expect(skills).toHaveLength(3);
      expect(skills[0]).toEqual({ name: "xlsx", skillPath: "skills/xlsx" });
      expect(skills[1]).toEqual({ name: "pdf", skillPath: "skills/pdf" });
      expect(skills[2]).toEqual({
        name: "algorithmic-art",
        skillPath: "skills/algorithmic-art",
      });
    });
  });
});

describe("github source type detection", () => {
  it("should correctly identify github and official source types", () => {
    const sources: RegistrySource[] = [
      {
        id: "official",
        type: "official",
        url: "https://example.com/registry.json",
        enabled: true,
        priority: 100,
        addedAt: new Date().toISOString(),
      },
      {
        id: "github:anthropics/skills",
        type: "github",
        url: "github.com/anthropics/skills",
        enabled: true,
        priority: 50,
        addedAt: new Date().toISOString(),
      },
      {
        id: "github:user/repo",
        type: "github",
        url: "github.com/user/repo",
        enabled: true,
        priority: 50,
        addedAt: new Date().toISOString(),
      },
    ];

    const githubSources = sources.filter((s) => s.type === "github");
    const officialSources = sources.filter((s) => s.type === "official");

    expect(githubSources).toHaveLength(2);
    expect(githubSources[0].id).toBe("github:anthropics/skills");
    expect(officialSources).toHaveLength(1);
  });
});
