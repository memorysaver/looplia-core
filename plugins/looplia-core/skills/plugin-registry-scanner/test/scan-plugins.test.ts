import { describe, expect, it } from "bun:test";
import {
  CAPABILITY_PATTERNS,
  extractFrontmatter,
  inferCapabilities,
  scanPlugins,
} from "../scripts/scan-plugins";

describe("scan-plugins", () => {
  describe("extractFrontmatter", () => {
    it("should extract valid YAML frontmatter", () => {
      const content = `---
name: test-skill
description: A test skill
tools: Read, Write
---

# Test Skill

This is the body.`;

      const result = extractFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("test-skill");
      expect(result?.description).toBe("A test skill");
      expect(result?.tools).toBe("Read, Write");
    });

    it("should extract multiline description with pipe syntax", () => {
      const content = `---
name: multi-line
description: |
  This is a multiline
  description with details.
model: claude-haiku-4-5-20251001
---

# Skill`;

      const result = extractFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("multi-line");
      expect(result?.description).toContain("multiline");
      expect(result?.model).toBe("claude-haiku-4-5-20251001");
    });

    it("should return null for content without frontmatter", () => {
      const content = `# Just a heading

No frontmatter here.`;

      const result = extractFrontmatter(content);
      expect(result).toBeNull();
    });

    it("should return null for invalid YAML", () => {
      const content = `---
name: test
invalid: yaml: syntax: here
---

# Test`;

      const result = extractFrontmatter(content);
      expect(result).toBeNull();
    });

    it("should return null for unclosed frontmatter", () => {
      const content = `---
name: unclosed
description: Missing closing delimiter

# Content`;

      const result = extractFrontmatter(content);
      expect(result).toBeNull();
    });
  });

  describe("inferCapabilities", () => {
    it("should infer content analysis capability", () => {
      const result = inferCapabilities("Deep content analysis for videos");
      expect(result).toContain("content analysis");
    });

    it("should infer theme extraction capability", () => {
      const result = inferCapabilities("Extract key themes from documents");
      expect(result).toContain("theme extraction");
    });

    it("should infer idea generation capability", () => {
      const result = inferCapabilities("Generate creative ideas and hooks");
      expect(result).toContain("idea generation");
    });

    it("should infer multiple capabilities from description", () => {
      const result = inferCapabilities(
        "Analyze content, generate ideas, and create outlines"
      );
      expect(result).toContain("content analysis");
      expect(result).toContain("idea generation");
      expect(result).toContain("outline creation");
    });

    it("should infer validation capability", () => {
      const result = inferCapabilities("Validate workflow outputs");
      expect(result).toContain("validation");
    });

    it("should infer personalization capability", () => {
      const result = inferCapabilities("Read user profile for context");
      expect(result).toContain("personalization");
    });

    it("should infer structured output capability", () => {
      const result = inferCapabilities("Generate structured JSON documents");
      expect(result).toContain("structured output");
    });

    it("should infer content assembly capability", () => {
      const result = inferCapabilities("Assemble and combine content pieces");
      expect(result).toContain("content assembly");
    });

    it("should return general processing for unknown descriptions", () => {
      const result = inferCapabilities("Something completely different");
      expect(result).toContain("general processing");
      expect(result.length).toBe(1);
    });

    it("should be case-insensitive", () => {
      const result = inferCapabilities("ANALYZE CONTENT");
      expect(result).toContain("content analysis");
    });

    it("should not duplicate capabilities", () => {
      // "analyze" and "analysis" should not create duplicate entries
      const result = inferCapabilities("Analyze using analysis techniques");
      const analysisCount = result.filter(
        (c) => c === "content analysis"
      ).length;
      expect(analysisCount).toBe(1);
    });
  });

  describe("CAPABILITY_PATTERNS", () => {
    it("should have expected patterns defined", () => {
      const patterns = CAPABILITY_PATTERNS.map(([p]) => p);
      expect(patterns).toContain("analy");
      expect(patterns).toContain("valid");
      expect(patterns).toContain("generat");
      expect(patterns).toContain("theme");
    });

    it("should map patterns to capabilities", () => {
      const patternMap = Object.fromEntries(CAPABILITY_PATTERNS);
      expect(patternMap.analy).toBe("content analysis");
      expect(patternMap.valid).toBe("validation");
      expect(patternMap.outline).toBe("outline creation");
    });
  });

  describe("scanPlugins", () => {
    it("should discover looplia-core skills", async () => {
      const result = await scanPlugins("plugins");
      const corePlugin = result.plugins.find((p) => p.name === "looplia-core");

      expect(corePlugin).toBeDefined();
      expect(corePlugin?.skills.length).toBeGreaterThan(0);

      const skillNames = corePlugin?.skills.map((s) => s.name) ?? [];
      expect(skillNames).toContain("plugin-registry-scanner");
      expect(skillNames).toContain("workflow-executor");
      expect(skillNames).toContain("skill-capability-matcher");
    });

    it("should discover looplia-writer skills", async () => {
      const result = await scanPlugins("plugins");
      const writerPlugin = result.plugins.find(
        (p) => p.name === "looplia-writer"
      );

      expect(writerPlugin).toBeDefined();
      expect(writerPlugin?.skills.length).toBeGreaterThan(0);

      const skillNames = writerPlugin?.skills.map((s) => s.name) ?? [];
      expect(skillNames).toContain("media-reviewer");
      expect(skillNames).toContain("idea-synthesis");
      expect(skillNames).toContain("writing-kit-assembler");
    });

    it("should return valid registry JSON schema", async () => {
      const result = await scanPlugins("plugins");

      // Check top-level structure
      expect(result).toHaveProperty("plugins");
      expect(result).toHaveProperty("summary");
      expect(Array.isArray(result.plugins)).toBe(true);

      // Check summary
      expect(result.summary).toHaveProperty("totalPlugins");
      expect(result.summary).toHaveProperty("totalSkills");
      expect(typeof result.summary.totalPlugins).toBe("number");
      expect(typeof result.summary.totalSkills).toBe("number");

      // Check skill structure
      const firstSkill = result.plugins[0]?.skills[0];
      if (firstSkill) {
        expect(firstSkill).toHaveProperty("name");
        expect(firstSkill).toHaveProperty("description");
        expect(firstSkill).toHaveProperty("capabilities");
        expect(Array.isArray(firstSkill.capabilities)).toBe(true);
      }
    });

    it("should include tools and model when specified", async () => {
      const result = await scanPlugins("plugins");
      const corePlugin = result.plugins.find((p) => p.name === "looplia-core");
      const scanner = corePlugin?.skills.find(
        (s) => s.name === "plugin-registry-scanner"
      );

      expect(scanner?.tools).toBeDefined();
      expect(scanner?.tools).toContain("Bash");
      expect(scanner?.model).toBe("claude-haiku-4-5-20251001");
    });

    it("should handle non-existent plugins directory gracefully", async () => {
      const result = await scanPlugins("non-existent-dir");

      expect(result.plugins).toEqual([]);
      expect(result.summary.totalPlugins).toBe(0);
      expect(result.summary.totalSkills).toBe(0);
    });

    it("should calculate correct totals", async () => {
      const result = await scanPlugins("plugins");

      const calculatedTotal = result.plugins.reduce(
        (sum, p) => sum + p.skills.length,
        0
      );

      expect(result.summary.totalSkills).toBe(calculatedTotal);
      expect(result.summary.totalPlugins).toBe(result.plugins.length);
    });

    it("should discover exactly 13 skills after adding search skill", async () => {
      const result = await scanPlugins("plugins");

      // After adding search skill, we should have all 13 skills
      expect(result.summary.totalSkills).toBe(13);
      expect(result.summary.totalPlugins).toBe(2);
    });
  });
});
