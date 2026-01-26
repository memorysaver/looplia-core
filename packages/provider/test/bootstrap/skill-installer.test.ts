/**
 * Skill Installer Unit Tests (v0.7.0)
 *
 * Tests for selective plugin loading based on workflow skill requirements:
 * - CORE_SKILLS constant
 * - isCoreSkill()
 * - getPluginSkills()
 * - getSelectivePluginPaths() with test workspace
 *
 * Uses LOOPLIA_HOME env var to redirect to temp workspace for integration tests.
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
import {
  createLoopliaWorkspace,
  createMockPluginInWorkspace,
  type LoopliaTestWorkspace,
} from "../claude-agent-sdk/fixtures/test-data";

/**
 * Create a mock plugin with specified skills (for unit tests with custom temp dir)
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

    it("should include workflow-validator", () => {
      expect(CORE_SKILLS).toContain("workflow-validator");
    });

    it("should include registry-loader", () => {
      expect(CORE_SKILLS).toContain("registry-loader");
    });

    it("should have exactly 3 core skills", () => {
      expect(CORE_SKILLS).toHaveLength(3);
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

  describe("getSelectivePluginPaths() - backward compatibility", () => {
    it("should return all plugins when requiredSkills is undefined", async () => {
      const result = await getSelectivePluginPaths(undefined);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return all plugins when requiredSkills is empty array", async () => {
      const result = await getSelectivePluginPaths([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle unknown skills gracefully", async () => {
      const result = await getSelectivePluginPaths(["non-existent-skill-xyz"]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getSelectivePluginPaths() - with test workspace", () => {
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

    it("should filter to plugins containing required skills", async () => {
      // Setup: Create plugins with different skills
      await createMockPluginInWorkspace(workspace, "plugin-a", [
        "skill-a",
        "skill-b",
      ]);
      await createMockPluginInWorkspace(workspace, "plugin-b", [
        "skill-c",
        "workflow-executor", // Core skill
      ]);
      await createMockPluginInWorkspace(workspace, "plugin-c", ["skill-d"]);

      // Act: Request only skill-a
      const result = await getSelectivePluginPaths(["skill-a"]);
      const paths = result.map((p) => p.path);

      // Assert: plugin-a (has skill-a) and plugin-b (has core skill) should be included
      expect(paths.some((p) => p.includes("plugin-a"))).toBe(true);
      expect(paths.some((p) => p.includes("plugin-b"))).toBe(true);
      // plugin-c (only has skill-d) should NOT be included
      expect(paths.some((p) => p.includes("plugin-c"))).toBe(false);
    });

    it("should always include plugins with core skills", async () => {
      // Setup: One plugin with core skill, one without
      await createMockPluginInWorkspace(workspace, "core-plugin", [
        "workflow-executor",
        "workflow-validator",
      ]);
      await createMockPluginInWorkspace(workspace, "non-core-plugin", [
        "custom-skill",
      ]);

      // Act: Request a non-existent skill (no direct match)
      const result = await getSelectivePluginPaths(["non-existent-xyz"]);
      const paths = result.map((p) => p.path);

      // Assert: core-plugin should still be included due to core skills
      expect(paths.some((p) => p.includes("core-plugin"))).toBe(true);
      // non-core-plugin should NOT be included (no match)
      expect(paths.some((p) => p.includes("non-core-plugin"))).toBe(false);
    });

    it("should deduplicate plugins when multiple required skills are in same plugin", async () => {
      // Setup: Single plugin with multiple skills
      await createMockPluginInWorkspace(workspace, "multi-skill-plugin", [
        "skill-a",
        "skill-b",
        "skill-c",
      ]);

      // Act: Request multiple skills from same plugin
      const result = await getSelectivePluginPaths([
        "skill-a",
        "skill-b",
        "skill-c",
      ]);
      const paths = result.map((p) => p.path);

      // Assert: Plugin appears only once
      const multiSkillCount = paths.filter((p) =>
        p.includes("multi-skill-plugin")
      ).length;
      expect(multiSkillCount).toBe(1);
    });

    it("should return empty when no plugins exist and no required skills", async () => {
      // Workspace is empty (no plugins created)
      const result = await getSelectivePluginPaths(["some-skill"]);

      expect(result).toHaveLength(0);
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

    it("should correctly chain workflow extraction to plugin filtering", async () => {
      // Setup: Create plugins
      await createMockPluginInWorkspace(workspace, "xlsx-plugin", ["xlsx"]);
      await createMockPluginInWorkspace(workspace, "pdf-plugin", ["pdf"]);
      await createMockPluginInWorkspace(workspace, "unused-plugin", [
        "unused-skill",
      ]);

      // Given: A workflow with specific skills
      const workflow = createTestWorkflow("chain-test", ["xlsx", "pdf"]);

      // When: Extract skills and filter plugins
      const skills = extractWorkflowSkills(workflow);
      const plugins = await getSelectivePluginPaths(skills);
      const paths = plugins.map((p) => p.path);

      // Then: Skills match workflow definition
      expect(skills).toEqual(["xlsx", "pdf"]);

      // And: Only needed plugins are loaded
      expect(paths.some((p) => p.includes("xlsx-plugin"))).toBe(true);
      expect(paths.some((p) => p.includes("pdf-plugin"))).toBe(true);
      expect(paths.some((p) => p.includes("unused-plugin"))).toBe(false);
    });

    it("should include core skills plugin even when not in workflow", async () => {
      // Setup: Create core plugin and custom plugin
      await createMockPluginInWorkspace(workspace, "core-plugin", [
        "workflow-executor",
        "workflow-validator",
        "registry-loader",
      ]);
      await createMockPluginInWorkspace(workspace, "custom-plugin", [
        "my-skill",
      ]);

      // Given: A workflow with only custom skills (no core skills)
      const workflow = createTestWorkflow("no-core-test", ["my-skill"]);

      const skills = extractWorkflowSkills(workflow);

      // Verify workflow doesn't include core skills
      expect(skills).not.toContain("workflow-executor");
      expect(skills).not.toContain("workflow-validator");

      // When: Filter plugins
      const plugins = await getSelectivePluginPaths(skills);
      const paths = plugins.map((p) => p.path);

      // Then: Core plugin is included (because it has core skills)
      expect(paths.some((p) => p.includes("core-plugin"))).toBe(true);
      // And: Custom plugin is included (because it has required skill)
      expect(paths.some((p) => p.includes("custom-plugin"))).toBe(true);
    });
  });
});
