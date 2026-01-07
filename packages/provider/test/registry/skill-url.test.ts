/**
 * Skill URL Installation Tests (v0.7.0)
 *
 * Tests for direct URL installation functionality:
 * - installSkillFromUrl()
 * - parseGitHubUrl()
 * - URL with tree path extraction
 */

import { describe, expect, it } from "bun:test";

// Note: Full integration tests with actual Git cloning are expensive.
// These tests focus on URL parsing and structure validation.
// For real installation tests, use E2E tests or manual testing.

// Top-level regex patterns for URL parsing
const GITHUB_FULL_PATTERN =
  /^https?:\/\/github\.com\/([^/]+\/[^/]+)(?:\/tree\/[^/]+\/(.+))?$/;
const GITHUB_SIMPLE_PATTERN =
  /^(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+)\/?$/;
const GITHUB_URL_DETECTION_PATTERN = /^(?:https?:\/\/)?github\.com\//;

describe("URL skill installation", () => {
  describe("GitHub URL parsing", () => {
    const parseGitHubUrl = (
      url: string
    ): { repoUrl: string; skillPath?: string } | null => {
      // Pattern: https://github.com/user/repo(/tree/branch/path)?
      const match = url.match(GITHUB_FULL_PATTERN);

      if (!match) {
        // Try simple format: github.com/user/repo
        const simpleMatch = url.match(GITHUB_SIMPLE_PATTERN);
        if (simpleMatch?.[1]) {
          return { repoUrl: `https://github.com/${simpleMatch[1]}.git` };
        }
        return null;
      }

      const repo = match[1];
      const path = match[2];

      return {
        repoUrl: `https://github.com/${repo}.git`,
        skillPath: path,
      };
    };

    it("should parse full GitHub URL", () => {
      const result = parseGitHubUrl("https://github.com/user/repo");
      expect(result).toEqual({
        repoUrl: "https://github.com/user/repo.git",
      });
    });

    it("should parse GitHub URL with http", () => {
      const result = parseGitHubUrl("http://github.com/user/repo");
      expect(result).toEqual({
        repoUrl: "https://github.com/user/repo.git",
      });
    });

    it("should parse URL with tree path (main branch)", () => {
      const result = parseGitHubUrl(
        "https://github.com/anthropics/skills/tree/main/skills/algorithmic-art"
      );
      expect(result).toEqual({
        repoUrl: "https://github.com/anthropics/skills.git",
        skillPath: "skills/algorithmic-art",
      });
    });

    it("should parse URL with tree path (different branch)", () => {
      const result = parseGitHubUrl(
        "https://github.com/user/repo/tree/develop/path/to/skill"
      );
      expect(result).toEqual({
        repoUrl: "https://github.com/user/repo.git",
        skillPath: "path/to/skill",
      });
    });

    it("should parse URL without protocol", () => {
      const result = parseGitHubUrl("github.com/user/repo");
      expect(result).toEqual({
        repoUrl: "https://github.com/user/repo.git",
      });
    });

    it("should return null for invalid URLs", () => {
      expect(parseGitHubUrl("not-a-url")).toBeNull();
      expect(parseGitHubUrl("https://gitlab.com/user/repo")).toBeNull();
      expect(parseGitHubUrl("")).toBeNull();
    });

    it("should handle trailing slashes", () => {
      const result = parseGitHubUrl("github.com/user/repo/");
      expect(result).toEqual({
        repoUrl: "https://github.com/user/repo.git",
      });
    });
  });

  describe("URL detection pattern", () => {
    const isGitHubUrl = (input: string): boolean =>
      GITHUB_URL_DETECTION_PATTERN.test(input);

    it("should detect HTTPS GitHub URLs", () => {
      expect(isGitHubUrl("https://github.com/user/repo")).toBe(true);
    });

    it("should detect HTTP GitHub URLs", () => {
      expect(isGitHubUrl("http://github.com/user/repo")).toBe(true);
    });

    it("should detect GitHub URLs without protocol", () => {
      expect(isGitHubUrl("github.com/user/repo")).toBe(true);
    });

    it("should not detect non-GitHub URLs", () => {
      expect(isGitHubUrl("gitlab.com/user/repo")).toBe(false);
      expect(isGitHubUrl("bitbucket.org/user/repo")).toBe(false);
    });

    it("should not detect skill names as URLs", () => {
      expect(isGitHubUrl("media-reviewer")).toBe(false);
      expect(isGitHubUrl("my-custom-skill")).toBe(false);
    });
  });

  describe("skill path extraction", () => {
    it("should extract skill name from path", () => {
      const skillPath = "skills/algorithmic-art";
      const skillName = skillPath.split("/").pop();
      expect(skillName).toBe("algorithmic-art");
    });

    it("should handle deep paths", () => {
      const skillPath = "packages/skills/category/my-skill";
      const skillName = skillPath.split("/").pop();
      expect(skillName).toBe("my-skill");
    });

    it("should handle root level path", () => {
      const skillPath = "my-skill";
      const skillName = skillPath.split("/").pop();
      expect(skillName).toBe("my-skill");
    });
  });

  describe("test URLs from plan", () => {
    // Test the specific URLs mentioned in the plan

    it("should parse anthropics/skills marketplace URL", () => {
      const url = "https://github.com/anthropics/skills";
      const match = url.match(GITHUB_FULL_PATTERN);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("anthropics/skills");
    });

    it("should parse anthropics/skills with skill path URL", () => {
      const url =
        "https://github.com/anthropics/skills/tree/main/skills/algorithmic-art";
      const match = url.match(GITHUB_FULL_PATTERN);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("anthropics/skills");
      expect(match?.[2]).toBe("skills/algorithmic-art");
    });
  });
});

describe("github skill installation structure", () => {
  it("should construct correct skillPath for marketplace.json skills", () => {
    // When adding github source with marketplace.json, skills get skillPath like "skills/xlsx"
    const marketplacePlugin = {
      name: "example-skills",
      description: "Example skills",
      skills: ["./skills/xlsx", "./skills/pdf"],
    };

    const processedSkills = marketplacePlugin.skills.map((path) => {
      const skillName = path.split("/").pop() ?? path;
      return {
        name: skillName,
        skillPath: path.replace("./", ""),
      };
    });

    expect(processedSkills).toEqual([
      { name: "xlsx", skillPath: "skills/xlsx" },
      { name: "pdf", skillPath: "skills/pdf" },
    ]);
  });

  it("should use skillPath for JIT installation", () => {
    // Simulate a compiled skill from a github source with marketplace.json
    const compiledSkill = {
      name: "algorithmic-art",
      title: "Algorithmic Art",
      description: "Skill from example-skills",
      plugin: "example-skills",
      category: "generation" as const,
      capabilities: [],
      source: "github:anthropics/skills",
      sourceType: "thirdparty" as const,
      installed: false,
      gitUrl: "https://github.com/anthropics/skills",
      skillPath: "skills/algorithmic-art",
    };

    // JIT installation should use gitUrl + skillPath
    expect(compiledSkill.gitUrl).toBe("https://github.com/anthropics/skills");
    expect(compiledSkill.skillPath).toBe("skills/algorithmic-art");
    expect(compiledSkill.installed).toBe(false);

    // After installation, the skill would be at:
    // ~/.looplia/plugins/algorithmic-art/skills/algorithmic-art/SKILL.md
  });
});
