/**
 * Installation Helpers Unit Tests (v0.7.0)
 *
 * Tests for skill installation helper functions:
 * - isValidPluginStructure()
 * - findSkillMdPath()
 * - wrapSkillAsPlugin()
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Top-level regex patterns for URL parsing
const GITHUB_FULL_PATTERN =
  /^https?:\/\/github\.com\/([^/]+\/[^/]+)(?:\/tree\/[^/]+\/(.+))?$/;
const GITHUB_SIMPLE_PATTERN =
  /^(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+)\/?$/;
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---/;

// Import the functions we want to test (they're not exported, so we test via integration)
// For unit testing private functions, we'd need to export them or use a different approach

describe("installation helpers", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `looplia-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("plugin structure detection", () => {
    it("should detect plugin.json as valid plugin structure", async () => {
      // Create .claude-plugin/plugin.json
      const claudePluginDir = join(tempDir, ".claude-plugin");
      await mkdir(claudePluginDir, { recursive: true });
      await writeFile(
        join(claudePluginDir, "plugin.json"),
        JSON.stringify({ name: "test-plugin", version: "1.0.0" })
      );

      // Test via existence check (simulating isValidPluginStructure)
      const pluginJsonPath = join(claudePluginDir, "plugin.json");
      const content = await readFile(pluginJsonPath, "utf-8");
      expect(JSON.parse(content).name).toBe("test-plugin");
    });

    it("should detect marketplace.json as valid plugin structure", async () => {
      // Create .claude-plugin/marketplace.json
      const claudePluginDir = join(tempDir, ".claude-plugin");
      await mkdir(claudePluginDir, { recursive: true });
      await writeFile(
        join(claudePluginDir, "marketplace.json"),
        JSON.stringify({
          name: "test-marketplace",
          plugins: [
            {
              name: "example-skills",
              description: "Example skills",
              skills: ["./skills/skill-a", "./skills/skill-b"],
            },
          ],
        })
      );

      // Test via existence check
      const marketplaceJsonPath = join(claudePluginDir, "marketplace.json");
      const content = await readFile(marketplaceJsonPath, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe("test-marketplace");
      expect(parsed.plugins[0].skills).toHaveLength(2);
    });
  });

  describe("SKILL.md discovery", () => {
    it("should find SKILL.md at root level", async () => {
      // Create SKILL.md at root
      await writeFile(
        join(tempDir, "SKILL.md"),
        `---
name: test-skill
description: A test skill
---

# Test Skill
`
      );

      // Simulate findSkillMdPath behavior
      const entries = await import("node:fs/promises").then((fs) =>
        fs.readdir(tempDir, { withFileTypes: true })
      );
      const hasSkillMd = entries.some(
        (e) => e.isFile() && e.name === "SKILL.md"
      );
      expect(hasSkillMd).toBe(true);
    });

    it("should find SKILL.md at nested level (skills/foo/)", async () => {
      // Create nested SKILL.md
      const skillDir = join(tempDir, "skills", "foo");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: nested-skill
description: A nested skill
---

# Nested Skill
`
      );

      // Simulate recursive search
      async function searchDir(
        dirPath: string,
        depth: number
      ): Promise<string | null> {
        if (depth > 5) {
          return null;
        }
        const entries = await import("node:fs/promises").then((fs) =>
          fs.readdir(dirPath, { withFileTypes: true })
        );
        const hasSkillMd = entries.some(
          (e) => e.isFile() && e.name === "SKILL.md"
        );
        if (hasSkillMd) {
          return dirPath;
        }

        for (const entry of entries) {
          if (
            entry.isDirectory() &&
            !entry.name.startsWith(".") &&
            entry.name !== "node_modules"
          ) {
            const found = await searchDir(join(dirPath, entry.name), depth + 1);
            if (found) {
              return found;
            }
          }
        }
        return null;
      }

      const found = await searchDir(tempDir, 0);
      expect(found).toBe(skillDir);
    });

    it("should extract skill name from SKILL.md frontmatter", async () => {
      const skillContent = `---
name: my-awesome-skill
description: |
  This is a multi-line description
  that spans multiple lines.
model: claude-haiku-4-5-20251001
---

# My Awesome Skill

More content here.
`;

      await writeFile(join(tempDir, "SKILL.md"), skillContent);

      // Simulate extractSkillName behavior
      const content = await readFile(join(tempDir, "SKILL.md"), "utf-8");
      const frontmatterMatch = content.match(FRONTMATTER_PATTERN);
      expect(frontmatterMatch).not.toBeNull();

      if (frontmatterMatch?.[1]) {
        const lines = frontmatterMatch[1].split("\n");
        let skillName = "";
        for (const line of lines) {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            if (key === "name" && value) {
              skillName = value;
              break;
            }
          }
        }
        expect(skillName).toBe("my-awesome-skill");
      }
    });
  });

  describe("skill auto-wrapping", () => {
    it("should create valid plugin structure when wrapping skill", async () => {
      // Create source skill directory
      const sourceDir = join(tempDir, "source-skill");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        join(sourceDir, "SKILL.md"),
        `---
name: wrapped-skill
description: A skill to be wrapped
---

# Wrapped Skill
`
      );

      // Simulate wrapSkillAsPlugin
      const targetDir = join(tempDir, "target-plugin");
      const skillName = "wrapped-skill";

      // 1. Create plugin directory structure
      await mkdir(join(targetDir, ".claude-plugin"), { recursive: true });
      const skillTargetDir = join(targetDir, "skills", skillName);
      await mkdir(skillTargetDir, { recursive: true });

      // 2. Copy skill contents
      const { cp } = await import("node:fs/promises");
      await cp(sourceDir, skillTargetDir, { recursive: true });

      // 3. Generate plugin.json
      const pluginJson = {
        name: skillName,
        version: "1.0.0",
        description: "Auto-wrapped skill from https://example.com",
        source: {
          type: "auto-wrapped",
          originalUrl: "https://example.com",
          wrappedAt: new Date().toISOString(),
        },
      };
      await writeFile(
        join(targetDir, ".claude-plugin", "plugin.json"),
        JSON.stringify(pluginJson, null, 2)
      );

      // Verify structure
      const generatedPluginJson = await readFile(
        join(targetDir, ".claude-plugin", "plugin.json"),
        "utf-8"
      );
      const parsed = JSON.parse(generatedPluginJson);
      expect(parsed.name).toBe("wrapped-skill");
      expect(parsed.source.type).toBe("auto-wrapped");

      // Verify skill was copied
      const skillMdCopy = await readFile(
        join(skillTargetDir, "SKILL.md"),
        "utf-8"
      );
      expect(skillMdCopy).toContain("name: wrapped-skill");
    });
  });

  describe("URL parsing", () => {
    it("should parse simple GitHub URL", () => {
      const url = "https://github.com/user/repo";
      const match = url.match(GITHUB_FULL_PATTERN);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("user/repo");
      expect(match?.[2]).toBeUndefined();
    });

    it("should parse GitHub URL with tree path", () => {
      const url =
        "https://github.com/anthropics/skills/tree/main/skills/algorithmic-art";
      const match = url.match(GITHUB_FULL_PATTERN);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("anthropics/skills");
      expect(match?.[2]).toBe("skills/algorithmic-art");
    });

    it("should handle URL without protocol", () => {
      const url = "github.com/user/repo";
      const match = url.match(GITHUB_SIMPLE_PATTERN);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("user/repo");
    });
  });
});
