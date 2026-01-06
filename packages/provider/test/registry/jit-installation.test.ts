/**
 * JIT (Just-In-Time) Skill Installation Tests (v0.7.0)
 *
 * Integration tests for workflow skill installation:
 * - ensureWorkflowSkills() behavior
 * - Real git clone operations using anthropics/skills repo
 * - Cleanup after each test
 *
 * Note: These tests require network access and may be slow (~5-30s each).
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  CompiledRegistry,
  CompiledSkill,
  ParsedWorkflow,
  SkillCategory,
  WorkflowDefinition,
} from "@looplia-core/core";
import { extractWorkflowSkills } from "@looplia-core/core";
import {
  addSource,
  compileRegistry,
  removeSource,
} from "../../src/registry/compiler";
import { ensureWorkflowSkills } from "../../src/registry/loader";
import { pathExists } from "../../src/utils/fs";

// Track installed skills for cleanup
let installedSkills: string[] = [];

// Top-level regex patterns
const SKILLS_PATH_PREFIX_PATTERN = /^skills\//;

// Plugins directory path
const PLUGINS_DIR = join(homedir(), ".looplia", "plugins");

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

/**
 * Create a mock registry entry for testing
 */
function createMockSkillEntry(
  name: string,
  options: {
    installed?: boolean;
    sourceType?: "builtin" | "thirdparty";
    gitUrl?: string;
    skillPath?: string;
    source?: string;
  } = {}
): CompiledSkill {
  const {
    installed = false,
    sourceType = "thirdparty",
    gitUrl,
    skillPath,
    source = sourceType === "builtin" ? "local" : "github:test/repo",
  } = options;

  return {
    name,
    title: name
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    description: `Mock skill: ${name}`,
    plugin: sourceType === "builtin" ? "looplia-core" : "test-plugin",
    category: "utility" as SkillCategory,
    capabilities: [],
    source,
    sourceType,
    installed,
    installedPath: installed ? join(PLUGINS_DIR, name) : undefined,
    gitUrl,
    skillPath,
  };
}

/**
 * Create a mock registry with specified skills
 */
function createMockRegistry(skills: CompiledSkill[]): CompiledRegistry {
  return {
    compiledAt: new Date().toISOString(),
    version: "1.0.0",
    sources: [],
    skills,
    summary: {
      totalSkills: skills.length,
      byCategory: {
        analysis: 0,
        generation: 0,
        assembly: 0,
        validation: 0,
        search: 0,
        orchestration: 0,
        utility: skills.length,
      },
      bySource: {},
    },
  };
}

/**
 * Cleanup installed skills after test
 */
async function cleanupInstalledSkills(): Promise<void> {
  for (const skillName of installedSkills) {
    const skillPath = join(PLUGINS_DIR, skillName);
    if (await pathExists(skillPath)) {
      await rm(skillPath, { recursive: true, force: true });
    }
  }
  installedSkills = [];
}

describe("registry/jit-installation", () => {
  afterEach(async () => {
    await cleanupInstalledSkills();
  });

  describe("ensureWorkflowSkills - all skills installed", () => {
    it(
      "should return ready: true when all skills are already installed",
      async () => {
        // Create workflow requiring builtin skills that should be installed
        const workflow = createTestWorkflow("test-workflow", [
          "workflow-executor",
        ]);

        // Use real registry which should have builtin skills installed
        const registry = await compileRegistry();

        const result = await ensureWorkflowSkills(workflow, registry);

        expect(result.ready).toBe(true);
        expect(result.installed).toHaveLength(0);
        expect(result.failed).toHaveLength(0);
      },
      { timeout: 30_000 }
    );

    it(
      "should not attempt any installations when all installed",
      async () => {
        const workflow = createTestWorkflow("test-workflow", [
          "workflow-executor",
          "workflow-validator",
        ]);

        const registry = await compileRegistry();

        const result = await ensureWorkflowSkills(workflow, registry);

        expect(result.ready).toBe(true);
        expect(result.installed).toHaveLength(0);
      },
      { timeout: 30_000 }
    );
  });

  describe("ensureWorkflowSkills - skill not in registry", () => {
    it(
      "should return ready: false for skill not in registry",
      async () => {
        const workflow = createTestWorkflow("test-workflow", [
          "non-existent-skill-xyz",
        ]);

        const registry = await compileRegistry();

        const result = await ensureWorkflowSkills(workflow, registry);

        expect(result.ready).toBe(false);
        expect(result.failed).toContain("non-existent-skill-xyz");
      },
      { timeout: 30_000 }
    );

    it(
      "should continue checking other skills after one not found",
      async () => {
        const workflow = createTestWorkflow("test-workflow", [
          "workflow-executor", // Should be found and installed
          "non-existent-abc", // Not in registry
          "workflow-validator", // Should be found and installed
        ]);

        const registry = await compileRegistry();

        const result = await ensureWorkflowSkills(workflow, registry);

        expect(result.ready).toBe(false);
        expect(result.failed).toContain("non-existent-abc");
        expect(result.failed).toHaveLength(1);
      },
      { timeout: 30_000 }
    );
  });

  describe("ensureWorkflowSkills - builtin skill missing (mock)", () => {
    it(
      "should fail when builtin skill is marked as not installed",
      async () => {
        const workflow = createTestWorkflow("test-workflow", [
          "corrupt-builtin",
        ]);

        // Create mock registry with corrupt builtin skill
        const mockRegistry = createMockRegistry([
          createMockSkillEntry("corrupt-builtin", {
            installed: false,
            sourceType: "builtin",
          }),
        ]);

        const result = await ensureWorkflowSkills(workflow, mockRegistry);

        expect(result.ready).toBe(false);
        expect(result.failed).toContain("corrupt-builtin");
      },
      { timeout: 10_000 }
    );
  });

  describe("ensureWorkflowSkills - empty workflow", () => {
    it(
      "should return ready: true for workflow with no skills",
      async () => {
        const workflow = createTestWorkflow("empty-workflow", []);

        const registry = await compileRegistry();

        const result = await ensureWorkflowSkills(workflow, registry);

        expect(result.ready).toBe(true);
        expect(result.installed).toHaveLength(0);
        expect(result.failed).toHaveLength(0);
      },
      { timeout: 30_000 }
    );
  });

  describe("extractWorkflowSkills integration", () => {
    it("should extract skills from explicit declaration", () => {
      const workflow = createTestWorkflow("explicit-skills", [
        "media-reviewer",
        "idea-synthesis",
        "writing-enhancer",
      ]);

      const skills = extractWorkflowSkills(workflow);

      expect(skills).toEqual([
        "media-reviewer",
        "idea-synthesis",
        "writing-enhancer",
      ]);
    });

    it("should fall back to step skills when no explicit declaration", () => {
      const workflow: ParsedWorkflow = {
        definition: {
          name: "implicit-skills",
          description: "Workflow without explicit skills",
          steps: [
            {
              id: "step-1",
              skill: "skill-from-step-a",
              input: "in1",
              output: "out1.json",
            },
            {
              id: "step-2",
              skill: "skill-from-step-b",
              input: "in2",
              output: "out2.json",
            },
          ],
        },
        instructions: "# Test",
      };

      const skills = extractWorkflowSkills(workflow);

      expect(skills).toContain("skill-from-step-a");
      expect(skills).toContain("skill-from-step-b");
    });

    it("should deduplicate skills from steps", () => {
      const workflow: ParsedWorkflow = {
        definition: {
          name: "dedup-skills",
          description: "Workflow with duplicate skills",
          steps: [
            {
              id: "step-1",
              skill: "same-skill",
              input: "in1",
              output: "out1.json",
            },
            {
              id: "step-2",
              skill: "same-skill",
              input: "in2",
              output: "out2.json",
            },
            {
              id: "step-3",
              skill: "same-skill",
              input: "in3",
              output: "out3.json",
            },
          ],
        },
        instructions: "# Test",
      };

      const skills = extractWorkflowSkills(workflow);

      expect(skills).toHaveLength(1);
      expect(skills).toContain("same-skill");
    });
  });

  describe("JIT installation with real git (anthropics/skills)", () => {
    // These tests use real network operations
    // They test the actual installation flow against anthropics/skills repo

    beforeEach(async () => {
      // Ensure anthropics/skills source is added
      try {
        await addSource("github.com/anthropics/skills");
      } catch {
        // Source may already exist
      }
    });

    afterEach(async () => {
      // Cleanup: Remove test source
      try {
        await removeSource("github:anthropics/skills");
      } catch {
        // May not exist
      }
    });

    it(
      "should install skill from anthropics/skills marketplace",
      async () => {
        // First compile registry with the source
        const registry = await compileRegistry();

        // Find a skill from anthropics/skills that isn't installed
        const skillToInstall = registry.skills.find(
          (s) =>
            s.source === "github:anthropics/skills" &&
            !s.installed &&
            s.skillPath
        );

        if (!skillToInstall) {
          console.warn(
            "No uninstalled skills found from anthropics/skills - skipping test"
          );
          return;
        }

        // Track for cleanup
        installedSkills.push(skillToInstall.name);

        // Create workflow requiring this skill
        const workflow = createTestWorkflow("jit-test", [skillToInstall.name]);

        // Execute JIT installation
        const result = await ensureWorkflowSkills(workflow, registry);

        // Verify
        expect(result.ready).toBe(true);
        expect(result.installed.length).toBeGreaterThanOrEqual(1);
        expect(result.installed[0].skill).toBe(skillToInstall.name);
        expect(result.installed[0].status).toBe("installed");

        // Verify skill directory was created
        const skillPath = join(PLUGINS_DIR, skillToInstall.name);
        expect(await pathExists(skillPath)).toBe(true);
      },
      { timeout: 60_000 }
    );

    it(
      "should use skillPath for selective extraction",
      async () => {
        const registry = await compileRegistry();

        // Find a skill with skillPath
        const marketplaceSkill = registry.skills.find(
          (s) =>
            s.skillPath &&
            !s.installed &&
            s.source === "github:anthropics/skills"
        );

        if (!marketplaceSkill) {
          console.warn("No marketplace skill with skillPath found - skipping");
          return;
        }

        // Verify skillPath is set
        expect(marketplaceSkill.skillPath).toBeDefined();
        expect(marketplaceSkill.skillPath).toMatch(SKILLS_PATH_PREFIX_PATTERN);

        // Track for cleanup
        installedSkills.push(marketplaceSkill.name);

        const workflow = createTestWorkflow("skillpath-test", [
          marketplaceSkill.name,
        ]);

        const result = await ensureWorkflowSkills(workflow, registry);

        expect(result.ready).toBe(true);
      },
      { timeout: 60_000 }
    );
  });

  describe("git clone failure handling (mock)", () => {
    it(
      "should return failed status when gitUrl is invalid",
      async () => {
        const workflow = createTestWorkflow("fail-test", ["invalid-skill"]);

        // Create mock registry with invalid git URL
        const mockRegistry = createMockRegistry([
          createMockSkillEntry("invalid-skill", {
            installed: false,
            sourceType: "thirdparty",
            gitUrl: "https://github.com/invalid-user/non-existent-repo-xyz",
          }),
        ]);

        const result = await ensureWorkflowSkills(workflow, mockRegistry);

        expect(result.ready).toBe(false);
        expect(result.failed).toContain("invalid-skill");
      },
      { timeout: 60_000 }
    );

    it(
      "should return failed when skill has no gitUrl",
      async () => {
        const workflow = createTestWorkflow("no-url-test", ["no-url-skill"]);

        // Create mock registry with missing gitUrl
        const mockRegistry = createMockRegistry([
          createMockSkillEntry("no-url-skill", {
            installed: false,
            sourceType: "thirdparty",
            // gitUrl intentionally omitted
          }),
        ]);

        const result = await ensureWorkflowSkills(workflow, mockRegistry);

        expect(result.ready).toBe(false);
        expect(result.failed).toContain("no-url-skill");
      },
      { timeout: 10_000 }
    );
  });

  describe("mixed scenarios", () => {
    it(
      "should handle mix of installed, missing, and unknown skills",
      async () => {
        const workflow = createTestWorkflow("mixed-workflow", [
          "workflow-executor", // Installed builtin
          "unknown-skill-xyz", // Not in registry
        ]);

        const registry = await compileRegistry();

        const result = await ensureWorkflowSkills(workflow, registry);

        // Should fail because of unknown skill
        expect(result.ready).toBe(false);
        expect(result.failed).toContain("unknown-skill-xyz");
        // Should not have installed anything new
        expect(result.installed).toHaveLength(0);
      },
      { timeout: 30_000 }
    );

    it(
      "should report all failures at once",
      async () => {
        const workflow = createTestWorkflow("all-fail-workflow", [
          "unknown-1",
          "unknown-2",
          "unknown-3",
        ]);

        const registry = await compileRegistry();

        const result = await ensureWorkflowSkills(workflow, registry);

        expect(result.ready).toBe(false);
        expect(result.failed).toHaveLength(3);
        expect(result.failed).toContain("unknown-1");
        expect(result.failed).toContain("unknown-2");
        expect(result.failed).toContain("unknown-3");
      },
      { timeout: 30_000 }
    );
  });
});
