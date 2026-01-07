/**
 * Registry Compilation Output Validation Tests (v0.7.0)
 *
 * Integration tests for verifying:
 * - skill-catalog.json is written to disk correctly
 * - CompiledSkill entries have all required fields
 * - Summary statistics are accurate
 *
 * Uses real compileRegistry() against local plugins.
 */

import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import type {
  CompiledRegistry,
  CompiledSkill,
  SkillCategory,
} from "@looplia-core/core";
import {
  compileRegistry,
  getCompiledRegistryPath,
} from "../../src/registry/compiler";
import { pathExists } from "../../src/utils/fs";

/**
 * Required fields for a CompiledSkill
 */
const REQUIRED_SKILL_FIELDS = [
  "name",
  "title",
  "description",
  "plugin",
  "category",
  "capabilities",
  "source",
  "sourceType",
  "installed",
] as const;

/**
 * All valid skill categories
 */
const ALL_CATEGORIES: SkillCategory[] = [
  "analysis",
  "generation",
  "assembly",
  "validation",
  "search",
  "orchestration",
  "utility",
];

/**
 * Calculate category counts from skills array
 */
function calculateByCategory(
  skills: CompiledSkill[]
): Record<SkillCategory, number> {
  const byCategory: Record<SkillCategory, number> = {
    analysis: 0,
    generation: 0,
    assembly: 0,
    validation: 0,
    search: 0,
    orchestration: 0,
    utility: 0,
  };

  for (const skill of skills) {
    byCategory[skill.category] += 1;
  }

  return byCategory;
}

/**
 * Calculate source counts from skills array
 */
function calculateBySource(skills: CompiledSkill[]): Record<string, number> {
  const bySource: Record<string, number> = {};

  for (const skill of skills) {
    bySource[skill.source] = (bySource[skill.source] ?? 0) + 1;
  }

  return bySource;
}

describe("registry/compilation-output", () => {
  describe("skill-catalog.json file output", () => {
    it(
      "should write skill-catalog.json to disk",
      async () => {
        // Act: Compile registry
        await compileRegistry();

        // Assert: File exists
        const catalogPath = getCompiledRegistryPath();
        const exists = await pathExists(catalogPath);

        expect(exists).toBe(true);
      },
      { timeout: 30_000 }
    );

    it(
      "should have valid ISO timestamp in compiledAt",
      async () => {
        // Act
        const registry = await compileRegistry();

        // Assert: Valid ISO 8601 format
        const parsed = new Date(registry.compiledAt);
        expect(parsed.toISOString()).toBe(registry.compiledAt);
        expect(Number.isNaN(parsed.getTime())).toBe(false);
      },
      { timeout: 30_000 }
    );

    it(
      "should persist and reload correctly from disk",
      async () => {
        // Act: Compile and write to disk
        const original = await compileRegistry();

        // Read back from disk
        const catalogPath = getCompiledRegistryPath();
        const content = await readFile(catalogPath, "utf-8");
        const reloaded = JSON.parse(content) as CompiledRegistry;

        // Assert: Key fields match
        expect(reloaded.version).toBe(original.version);
        expect(reloaded.compiledAt).toBe(original.compiledAt);
        expect(reloaded.skills.length).toBe(original.skills.length);
        expect(reloaded.summary.totalSkills).toBe(original.summary.totalSkills);
      },
      { timeout: 30_000 }
    );
  });

  describe("CompiledSkill field validation", () => {
    it(
      "should have all required fields for each skill",
      async () => {
        const registry = await compileRegistry();

        // Skip if no skills (unlikely in real setup)
        if (registry.skills.length === 0) {
          console.warn("No skills found - skipping field validation");
          return;
        }

        for (const skill of registry.skills) {
          for (const field of REQUIRED_SKILL_FIELDS) {
            expect(
              skill[field],
              `Skill "${skill.name}" missing field "${field}"`
            ).toBeDefined();
          }
        }
      },
      { timeout: 30_000 }
    );

    it(
      "should have valid category for each skill",
      async () => {
        const registry = await compileRegistry();

        for (const skill of registry.skills) {
          expect(
            ALL_CATEGORIES,
            `Skill "${skill.name}" has invalid category "${skill.category}"`
          ).toContain(skill.category);
        }
      },
      { timeout: 30_000 }
    );

    it(
      "should have installedPath when installed is true",
      async () => {
        const registry = await compileRegistry();

        const installedSkills = registry.skills.filter((s) => s.installed);

        for (const skill of installedSkills) {
          expect(
            skill.installedPath,
            `Installed skill "${skill.name}" missing installedPath`
          ).toBeDefined();
        }
      },
      { timeout: 30_000 }
    );

    it(
      "should have gitUrl for third-party skills",
      async () => {
        const registry = await compileRegistry();

        const thirdPartySkills = registry.skills.filter(
          (s) => s.sourceType === "thirdparty"
        );

        for (const skill of thirdPartySkills) {
          expect(
            skill.gitUrl,
            `Third-party skill "${skill.name}" missing gitUrl`
          ).toBeDefined();
        }
      },
      { timeout: 30_000 }
    );

    it(
      "should have valid sourceType for each skill",
      async () => {
        const registry = await compileRegistry();

        for (const skill of registry.skills) {
          expect(
            ["builtin", "thirdparty"],
            `Skill "${skill.name}" has invalid sourceType "${skill.sourceType}"`
          ).toContain(skill.sourceType);
        }
      },
      { timeout: 30_000 }
    );
  });

  describe("summary statistics validation", () => {
    it(
      "should have totalSkills matching skills.length",
      async () => {
        const registry = await compileRegistry();

        expect(registry.summary.totalSkills).toBe(registry.skills.length);
      },
      { timeout: 30_000 }
    );

    it(
      "should have byCategory counts matching actual distribution",
      async () => {
        const registry = await compileRegistry();

        const calculated = calculateByCategory(registry.skills);

        for (const category of ALL_CATEGORIES) {
          expect(
            registry.summary.byCategory[category],
            `Category "${category}" count mismatch`
          ).toBe(calculated[category]);
        }
      },
      { timeout: 30_000 }
    );

    it(
      "should have bySource counts matching actual distribution",
      async () => {
        const registry = await compileRegistry();

        const calculated = calculateBySource(registry.skills);

        for (const [source, count] of Object.entries(calculated)) {
          expect(
            registry.summary.bySource[source],
            `Source "${source}" count mismatch`
          ).toBe(count);
        }
      },
      { timeout: 30_000 }
    );

    it(
      "should initialize all category counts (including zero)",
      async () => {
        const registry = await compileRegistry();

        for (const category of ALL_CATEGORIES) {
          expect(
            registry.summary.byCategory[category],
            `Category "${category}" not initialized`
          ).toBeDefined();
          expect(typeof registry.summary.byCategory[category]).toBe("number");
        }
      },
      { timeout: 30_000 }
    );
  });
});
