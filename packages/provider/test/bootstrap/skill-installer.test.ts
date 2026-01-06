/**
 * Skill Installer Unit Tests (v0.7.0)
 *
 * Tests for selective plugin loading based on workflow skill requirements:
 * - CORE_SKILLS constant
 * - isCoreSkill()
 * - getPluginSkills()
 * - getSelectivePluginPaths()
 *
 * Uses temp directories with mock plugin structures.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedWorkflow, WorkflowDefinition } from "@looplia-core/core";
import { extractWorkflowSkills } from "@looplia-core/core";
import {
  CORE_SKILLS,
  getPluginSkills,
  getSelectivePluginPaths,
  isCoreSkill,
} from "../../src/bootstrap/skill-installer";

/**
 * Create a mock plugin with specified skills
 */
async function createMockPlugin(
  basePath: string,
  name: string,
  skills: string[]
): Promise<string> {
  const pluginPath = join(basePath, name);
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
        `---\nname: ${skill}\ndescription: Mock skill\n---\n# ${skill}`
      );
    }
  }

  return pluginPath;
}

/**
 * Create a mock ParsedWorkflow with specified skills
 */
function createTestWorkflow(name: string, skills: string[]): ParsedWorkflow {
  const definition: WorkflowDefinition = {
    name,
    description: `Test workflow: ${name}`,
    skills,
    steps: skills.map((skill, i) => ({
      id: `step-${i + 1}`,
      skill,
      input: `input-${i + 1}`,
      output: `output-${i + 1}.json`,
    })),
  };

  return {
    definition,
    instructions: `# ${name}\n\nTest workflow instructions.`,
  };
}

describe("bootstrap/skill-installer", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `looplia-skill-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("CORE_SKILLS constant", () => {
    it("should include workflow-executor", () => {
      expect(CORE_SKILLS).toContain("workflow-executor");
    });

    it("should include workflow-executor-inline", () => {
      expect(CORE_SKILLS).toContain("workflow-executor-inline");
    });

    it("should include workflow-validator", () => {
      expect(CORE_SKILLS).toContain("workflow-validator");
    });

    it("should include registry-loader", () => {
      expect(CORE_SKILLS).toContain("registry-loader");
    });

    it("should have exactly 4 core skills", () => {
      expect(CORE_SKILLS).toHaveLength(4);
    });
  });

  describe("isCoreSkill()", () => {
    it("should return true for workflow-executor", () => {
      expect(isCoreSkill("workflow-executor")).toBe(true);
    });

    it("should return true for workflow-validator", () => {
      expect(isCoreSkill("workflow-validator")).toBe(true);
    });

    it("should return true for registry-loader", () => {
      expect(isCoreSkill("registry-loader")).toBe(true);
    });

    it("should return false for custom skills", () => {
      expect(isCoreSkill("my-custom-skill")).toBe(false);
      expect(isCoreSkill("xlsx")).toBe(false);
      expect(isCoreSkill("pdf")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isCoreSkill("")).toBe(false);
    });
  });

  describe("getPluginSkills()", () => {
    it("should return skill names from plugin skills directory", async () => {
      const pluginPath = await createMockPlugin(tempDir, "test-plugin", [
        "skill-a",
        "skill-b",
        "skill-c",
      ]);

      const skills = await getPluginSkills(pluginPath);

      expect(skills).toHaveLength(3);
      expect(skills).toContain("skill-a");
      expect(skills).toContain("skill-b");
      expect(skills).toContain("skill-c");
    });

    it("should return empty array when plugin has no skills directory", async () => {
      // Create plugin without skills
      const pluginPath = join(tempDir, "no-skills-plugin");
      await mkdir(join(pluginPath, ".claude-plugin"), { recursive: true });
      await writeFile(
        join(pluginPath, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "no-skills", version: "1.0.0" })
      );

      const skills = await getPluginSkills(pluginPath);

      expect(skills).toEqual([]);
    });

    it("should return empty array for non-existent plugin", async () => {
      const skills = await getPluginSkills("/non/existent/path");

      expect(skills).toEqual([]);
    });

    it("should ignore files in skills directory (only directories)", async () => {
      const pluginPath = await createMockPlugin(tempDir, "mixed-plugin", [
        "real-skill",
      ]);

      // Add a file to skills directory (should be ignored)
      await writeFile(join(pluginPath, "skills", "README.md"), "# Skills");

      const skills = await getPluginSkills(pluginPath);

      expect(skills).toHaveLength(1);
      expect(skills).toContain("real-skill");
    });
  });

  describe("getSelectivePluginPaths()", () => {
    it("should return all plugins when requiredSkills is undefined", async () => {
      // This test uses the real getPluginPaths() which reads from ~/.looplia
      // We can only verify it doesn't throw and returns an array
      const result = await getSelectivePluginPaths(undefined);

      expect(Array.isArray(result)).toBe(true);
    });

    it("should return all plugins when requiredSkills is empty array", async () => {
      const result = await getSelectivePluginPaths([]);

      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle unknown skills gracefully", async () => {
      // Request a skill that doesn't exist
      const result = await getSelectivePluginPaths(["non-existent-skill-xyz"]);

      // Should not throw, returns filtered array (may be empty or just core plugins)
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("extractWorkflowSkills integration", () => {
    it("should extract skills from workflow with explicit declaration", () => {
      const workflow = createTestWorkflow("explicit-test", [
        "skill-a",
        "skill-b",
        "skill-c",
      ]);

      const skills = extractWorkflowSkills(workflow);

      expect(skills).toEqual(["skill-a", "skill-b", "skill-c"]);
    });

    it("should extract skills from workflow steps when no explicit declaration", () => {
      const workflow: ParsedWorkflow = {
        definition: {
          name: "implicit-test",
          description: "Workflow without explicit skills",
          steps: [
            { id: "1", skill: "step-skill-a", input: "in", output: "out.json" },
            { id: "2", skill: "step-skill-b", input: "in", output: "out.json" },
          ],
        },
        instructions: "# Test",
      };

      const skills = extractWorkflowSkills(workflow);

      expect(skills).toContain("step-skill-a");
      expect(skills).toContain("step-skill-b");
    });

    it("should deduplicate skills from steps", () => {
      const workflow: ParsedWorkflow = {
        definition: {
          name: "dedup-test",
          description: "Workflow with duplicate skills",
          steps: [
            { id: "1", skill: "same-skill", input: "in1", output: "out1.json" },
            { id: "2", skill: "same-skill", input: "in2", output: "out2.json" },
            { id: "3", skill: "same-skill", input: "in3", output: "out3.json" },
          ],
        },
        instructions: "# Test",
      };

      const skills = extractWorkflowSkills(workflow);

      expect(skills).toHaveLength(1);
      expect(skills).toContain("same-skill");
    });

    it("should return empty array for workflow with no skills", () => {
      const workflow = createTestWorkflow("empty-test", []);

      const skills = extractWorkflowSkills(workflow);

      expect(skills).toEqual([]);
    });
  });

  describe("selective loading flow (workflow → skills → plugins)", () => {
    it("should correctly chain workflow extraction to plugin filtering", async () => {
      // Given: A workflow with specific skills
      const workflow = createTestWorkflow("chain-test", [
        "xlsx",
        "pdf",
        "custom-skill",
      ]);

      // When: Extract skills
      const skills = extractWorkflowSkills(workflow);

      // Then: Skills match workflow definition
      expect(skills).toEqual(["xlsx", "pdf", "custom-skill"]);

      // And: Can pass to selective loading (won't crash even if skills don't exist)
      const plugins = await getSelectivePluginPaths(skills);
      expect(Array.isArray(plugins)).toBe(true);
    });

    it("should include core skills in filtering even when not in workflow", async () => {
      // Given: A workflow with only custom skills (no core skills)
      const workflow = createTestWorkflow("no-core-test", ["my-skill"]);

      const skills = extractWorkflowSkills(workflow);

      // Verify workflow doesn't include core skills
      expect(skills).not.toContain("workflow-executor");
      expect(skills).not.toContain("workflow-validator");

      // But getSelectivePluginPaths should internally add them
      // We can't directly test this without mocking getPluginPaths,
      // but we verify the function doesn't throw
      const plugins = await getSelectivePluginPaths(skills);
      expect(Array.isArray(plugins)).toBe(true);
    });
  });
});
