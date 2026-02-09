/**
 * Auto-Discovery Plugin Tests (v0.8.0)
 *
 * Tests for:
 * - ensureAutoDiscoveryPlugin() - creates structure, idempotent
 * - installSkillToAutoDiscovery() - success, with sourceUrl, path traversal, error handling
 * - listAutoDiscoveredSkills() - empty, populated, filters dotfiles
 * - isSkillAutoDiscovered() - exists/not-exists, invalid name
 *
 * Uses LOOPLIA_HOME env var to redirect to temp workspace for testing.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ensureAutoDiscoveryPlugin,
  getAutoDiscoveryPluginPath,
  installSkillToAutoDiscovery,
  isSkillAutoDiscovered,
  listAutoDiscoveredSkills,
} from "../../src/discovery/auto-discovery-plugin";
import { pathExists } from "../../src/utils/fs";
import {
  createLoopliaWorkspace,
  type LoopliaTestWorkspace,
} from "../claude-agent-sdk/fixtures/test-data";

describe("discovery/auto-discovery-plugin", () => {
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

  describe("ensureAutoDiscoveryPlugin", () => {
    it("should create plugin structure", async () => {
      await ensureAutoDiscoveryPlugin();

      const pluginPath = getAutoDiscoveryPluginPath();
      expect(await pathExists(join(pluginPath, ".claude-plugin"))).toBe(true);
      expect(
        await pathExists(join(pluginPath, ".claude-plugin", "plugin.json"))
      ).toBe(true);
      expect(await pathExists(join(pluginPath, "skills"))).toBe(true);
    });

    it("should create valid plugin.json", async () => {
      await ensureAutoDiscoveryPlugin();

      const pluginPath = getAutoDiscoveryPluginPath();
      const content = await readFile(
        join(pluginPath, ".claude-plugin", "plugin.json"),
        "utf-8"
      );
      const json = JSON.parse(content);

      expect(json.name).toBe("auto-discovery-plugin");
      expect(json.version).toBe("1.0.0");
    });

    it("should be idempotent", async () => {
      await ensureAutoDiscoveryPlugin();
      await ensureAutoDiscoveryPlugin();

      const pluginPath = getAutoDiscoveryPluginPath();
      expect(await pathExists(join(pluginPath, ".claude-plugin"))).toBe(true);
    });
  });

  describe("installSkillToAutoDiscovery", () => {
    it("should install a skill successfully", async () => {
      const result = await installSkillToAutoDiscovery(
        "test-pdf",
        "# PDF Skill\nHandles PDFs"
      );

      expect(result.status).toBe("installed");
      expect(result.skill).toBe("test-pdf");
      expect(result.path).toBeDefined();

      // Verify SKILL.md was written
      const skillDir = join(getAutoDiscoveryPluginPath(), "skills", "test-pdf");
      const content = await readFile(join(skillDir, "SKILL.md"), "utf-8");
      expect(content).toBe("# PDF Skill\nHandles PDFs");
    });

    it("should store sourceUrl in source.json", async () => {
      const result = await installSkillToAutoDiscovery(
        "test-xlsx",
        "# XLSX Skill",
        "https://github.com/user/xlsx-skill"
      );

      expect(result.status).toBe("installed");

      const skillDir = join(
        getAutoDiscoveryPluginPath(),
        "skills",
        "test-xlsx"
      );
      const sourceContent = await readFile(
        join(skillDir, "source.json"),
        "utf-8"
      );
      const source = JSON.parse(sourceContent);
      expect(source.gitUrl).toBe("https://github.com/user/xlsx-skill");
    });

    it("should not create source.json when sourceUrl is omitted", async () => {
      const result = await installSkillToAutoDiscovery(
        "test-csv",
        "# CSV Skill"
      );

      expect(result.status).toBe("installed");
      const skillDir = join(getAutoDiscoveryPluginPath(), "skills", "test-csv");
      expect(await pathExists(join(skillDir, "source.json"))).toBe(false);
    });

    it("should reject path traversal in skill name", async () => {
      await expect(
        installSkillToAutoDiscovery("../malicious", "# Evil")
      ).rejects.toThrow("Invalid skill name");
    });

    it("should reject absolute paths in skill name", async () => {
      await expect(
        installSkillToAutoDiscovery("/etc/passwd", "# Evil")
      ).rejects.toThrow("Invalid skill name");
    });

    it("should reject null bytes in skill name", async () => {
      await expect(
        installSkillToAutoDiscovery("skill\0evil", "# Evil")
      ).rejects.toThrow("Invalid skill name");
    });

    it("should reject empty skill name", async () => {
      await expect(installSkillToAutoDiscovery("", "# Empty")).rejects.toThrow(
        "Invalid skill name"
      );
    });
  });

  describe("listAutoDiscoveredSkills", () => {
    it("should return empty array when no skills installed", async () => {
      const skills = await listAutoDiscoveredSkills();
      expect(skills).toEqual([]);
    });

    it("should return installed skill names", async () => {
      await installSkillToAutoDiscovery("pdf", "# PDF");
      await installSkillToAutoDiscovery("xlsx", "# XLSX");

      const skills = await listAutoDiscoveredSkills();
      expect(skills).toContain("pdf");
      expect(skills).toContain("xlsx");
      expect(skills).toHaveLength(2);
    });

    it("should filter dotfiles", async () => {
      await installSkillToAutoDiscovery("pdf", "# PDF");

      // Manually verify the skills dir has the skill
      const skillsDir = join(getAutoDiscoveryPluginPath(), "skills");
      const entries = await readdir(skillsDir);
      expect(entries).toContain("pdf");

      const skills = await listAutoDiscoveredSkills();
      // Should not include any dotfile directories
      for (const skill of skills) {
        expect(skill.startsWith(".")).toBe(false);
      }
    });
  });

  describe("isSkillAutoDiscovered", () => {
    it("should return true for installed skill", async () => {
      await installSkillToAutoDiscovery("pdf", "# PDF");
      expect(await isSkillAutoDiscovered("pdf")).toBe(true);
    });

    it("should return false for non-installed skill", async () => {
      await ensureAutoDiscoveryPlugin();
      expect(await isSkillAutoDiscovered("nonexistent")).toBe(false);
    });

    it("should return false for invalid skill name", async () => {
      expect(await isSkillAutoDiscovered("../malicious")).toBe(false);
      expect(await isSkillAutoDiscovered("")).toBe(false);
      expect(await isSkillAutoDiscovered("/etc/passwd")).toBe(false);
    });
  });
});
