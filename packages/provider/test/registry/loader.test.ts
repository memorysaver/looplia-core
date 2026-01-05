import { describe, expect, it } from "bun:test";
import {
  CORE_SKILLS,
  findSkill,
  getAvailableSkills,
  getInstalledSkills,
  getSkillsByCategory,
  isCoreSkill,
  loadCompiledRegistry,
} from "../../src/registry/loader";

describe("registry/loader", () => {
  describe("loadCompiledRegistry", () => {
    it("should load or compile registry", async () => {
      const registry = await loadCompiledRegistry();

      expect(registry).toBeDefined();
      expect(registry.skills).toBeDefined();
      expect(Array.isArray(registry.skills)).toBe(true);
    });

    it("should have required summary fields", async () => {
      const registry = await loadCompiledRegistry();

      expect(registry.summary).toBeDefined();
      expect(registry.summary.totalSkills).toBeGreaterThanOrEqual(0);
      expect(registry.summary.byCategory).toBeDefined();
      expect(registry.summary.bySource).toBeDefined();
    });
  });

  describe("findSkill", () => {
    it("should find skill by name", async () => {
      const registry = await loadCompiledRegistry();

      if (registry.skills.length > 0) {
        const firstName = registry.skills[0].name;
        const found = findSkill(registry, firstName);

        expect(found).toBeDefined();
        expect(found?.name).toBe(firstName);
      }
    });

    it("should return undefined for non-existent skill", async () => {
      const registry = await loadCompiledRegistry();
      const found = findSkill(registry, "non-existent-skill-xyz");

      expect(found).toBeUndefined();
    });
  });

  describe("getInstalledSkills", () => {
    it("should return only installed skills", async () => {
      const registry = await loadCompiledRegistry();
      const installed = getInstalledSkills(registry);

      for (const skill of installed) {
        expect(skill.installed).toBe(true);
      }
    });

    it("should return array", async () => {
      const registry = await loadCompiledRegistry();
      const installed = getInstalledSkills(registry);

      expect(Array.isArray(installed)).toBe(true);
    });
  });

  describe("getAvailableSkills", () => {
    it("should return only non-installed skills", async () => {
      const registry = await loadCompiledRegistry();
      const available = getAvailableSkills(registry);

      for (const skill of available) {
        expect(skill.installed).toBe(false);
      }
    });
  });

  describe("getSkillsByCategory", () => {
    it("should filter skills by category", async () => {
      const registry = await loadCompiledRegistry();
      const analysisSkills = getSkillsByCategory(registry, "analysis");

      for (const skill of analysisSkills) {
        expect(skill.category).toBe("analysis");
      }
    });

    it("should return empty array for non-existent category", async () => {
      const registry = await loadCompiledRegistry();
      const skills = getSkillsByCategory(registry, "non-existent-category");

      expect(skills).toEqual([]);
    });
  });

  describe("CORE_SKILLS", () => {
    it("should include essential skills", () => {
      expect(CORE_SKILLS).toContain("workflow-executor");
      expect(CORE_SKILLS).toContain("workflow-validator");
      expect(CORE_SKILLS).toContain("registry-loader");
    });

    it("should have at least 4 core skills", () => {
      expect(CORE_SKILLS.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("isCoreSkill", () => {
    it("should return true for core skills", () => {
      expect(isCoreSkill("workflow-executor")).toBe(true);
      expect(isCoreSkill("workflow-validator")).toBe(true);
      expect(isCoreSkill("registry-loader")).toBe(true);
    });

    it("should return false for non-core skills", () => {
      expect(isCoreSkill("media-reviewer")).toBe(false);
      expect(isCoreSkill("random-skill")).toBe(false);
    });
  });
});
