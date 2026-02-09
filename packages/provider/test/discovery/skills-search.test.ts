/**
 * Skills Search Tests (v0.8.0)
 *
 * Tests for:
 * - parseSkillsOutput() - all 4 format patterns, ANSI stripping, empty/malformed input
 * - deriveSkillName() - suffix/prefix removal
 * - isValidGitHubSegment() - valid/invalid segments
 * - fetchSkillContent() - validation rejects invalid inputs
 */

import { describe, expect, it } from "bun:test";
import {
  deriveSkillName,
  fetchSkillContent,
  isValidGitHubSegment,
  parseSkillsOutput,
} from "../../src/discovery/skills-search";

describe("discovery/skills-search", () => {
  describe("parseSkillsOutput", () => {
    it("should parse format 1: skill-name - Description (owner/repo)", () => {
      const output = "pdf - PDF manipulation tools (anthropics/skills)";
      const results = parseSkillsOutput(output);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        name: "pdf",
        description: "PDF manipulation tools",
        owner: "anthropics",
        repo: "skills",
        installCommand: "npx skills add anthropics/skills",
      });
    });

    it("should parse format 2: owner/repo - description", () => {
      const output = "memorysaver/pdf-skill - Create and edit PDFs";
      const results = parseSkillsOutput(output);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        name: "pdf",
        description: "Create and edit PDFs",
        owner: "memorysaver",
        repo: "pdf-skill",
        installCommand: "npx skills add memorysaver/pdf-skill",
      });
    });

    it("should parse format 3: owner/repo (no description)", () => {
      const output = "anthropics/xlsx-skill";
      const results = parseSkillsOutput(output);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        name: "xlsx",
        description: "",
        owner: "anthropics",
        repo: "xlsx-skill",
        installCommand: "npx skills add anthropics/xlsx-skill",
      });
    });

    it("should parse format 4: owner/repo@skill (skills.sh format)", () => {
      const output = "anthropics/skills@pdf";
      const results = parseSkillsOutput(output);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        name: "pdf",
        description: "",
        owner: "anthropics",
        repo: "skills",
        installCommand: "npx skills add anthropics/skills@pdf",
      });
    });

    it("should strip ANSI escape codes before parsing", () => {
      const output =
        "\x1b[32mpdf\x1b[0m - \x1b[33mPDF tools\x1b[0m (\x1b[34manthropics/skills\x1b[0m)";
      const results = parseSkillsOutput(output);

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe("pdf");
      expect(results[0]?.description).toBe("PDF tools");
      expect(results[0]?.owner).toBe("anthropics");
    });

    it("should return empty array for empty input", () => {
      expect(parseSkillsOutput("")).toEqual([]);
    });

    it("should return empty array for whitespace-only input", () => {
      expect(parseSkillsOutput("  \n  \n  ")).toEqual([]);
    });

    it("should skip malformed lines", () => {
      const output = [
        "this is not a valid skill line",
        "anthropics/skills@pdf",
        "another invalid line",
      ].join("\n");

      const results = parseSkillsOutput(output);
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe("pdf");
    });

    it("should parse multiple results", () => {
      const output = [
        "anthropics/skills@pdf",
        "memorysaver/xlsx-skill - Excel tools",
      ].join("\n");

      const results = parseSkillsOutput(output);
      expect(results).toHaveLength(2);
    });
  });

  describe("deriveSkillName", () => {
    it("should remove -skill suffix", () => {
      expect(deriveSkillName("pdf-skill")).toBe("pdf");
      expect(deriveSkillName("xlsx-skill")).toBe("xlsx");
    });

    it("should remove skill- prefix", () => {
      expect(deriveSkillName("skill-pdf")).toBe("pdf");
      expect(deriveSkillName("skill-xlsx")).toBe("xlsx");
    });

    it("should remove both prefix and suffix", () => {
      expect(deriveSkillName("skill-pdf-skill")).toBe("pdf");
    });

    it("should return unchanged if no prefix or suffix", () => {
      expect(deriveSkillName("pdf")).toBe("pdf");
      expect(deriveSkillName("my-tool")).toBe("my-tool");
    });
  });

  describe("isValidGitHubSegment", () => {
    it("should accept valid segments", () => {
      expect(isValidGitHubSegment("anthropics")).toBe(true);
      expect(isValidGitHubSegment("pdf-skill")).toBe(true);
      expect(isValidGitHubSegment("my_repo.v2")).toBe(true);
      expect(isValidGitHubSegment("user123")).toBe(true);
    });

    it("should reject empty strings", () => {
      expect(isValidGitHubSegment("")).toBe(false);
    });

    it("should reject segments with slashes", () => {
      expect(isValidGitHubSegment("owner/repo")).toBe(false);
    });

    it("should reject segments with spaces", () => {
      expect(isValidGitHubSegment("my skill")).toBe(false);
    });

    it("should reject segments with special characters", () => {
      expect(isValidGitHubSegment("skill;rm -rf")).toBe(false);
      expect(isValidGitHubSegment("skill$(whoami)")).toBe(false);
      expect(isValidGitHubSegment("skill`id`")).toBe(false);
      expect(isValidGitHubSegment("../etc")).toBe(false);
    });
  });

  describe("fetchSkillContent", () => {
    it("should reject invalid owner", async () => {
      await expect(
        fetchSkillContent("../malicious", "repo", "skill")
      ).rejects.toThrow("Invalid owner");
    });

    it("should reject invalid repo", async () => {
      await expect(
        fetchSkillContent("owner", "repo;rm -rf /", "skill")
      ).rejects.toThrow("Invalid repo");
    });

    it("should reject invalid skillName", async () => {
      await expect(
        fetchSkillContent("owner", "repo", "../../etc/passwd")
      ).rejects.toThrow("Invalid skillName");
    });

    it("should reject empty segments", async () => {
      await expect(fetchSkillContent("", "repo", "skill")).rejects.toThrow(
        "Invalid owner"
      );
      await expect(fetchSkillContent("owner", "", "skill")).rejects.toThrow(
        "Invalid repo"
      );
      await expect(fetchSkillContent("owner", "repo", "")).rejects.toThrow(
        "Invalid skillName"
      );
    });
  });
});
