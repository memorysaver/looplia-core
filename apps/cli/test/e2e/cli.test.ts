import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanupTestContentItems,
  createTempDir,
  createTestFile,
  execCLI,
  readTestFile,
} from "../utils";

describe("CLI E2E Tests", () => {
  let tempDir: { path: string; cleanup: () => void };

  afterAll(() => {
    // Clean up test-generated content items from ~/.looplia/contentItem/cli-*
    cleanupTestContentItems();
  });

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    tempDir.cleanup();
  });

  describe("Global Commands", () => {
    it("should show help when no arguments provided", async () => {
      const result = await execCLI([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia - Content intelligence CLI");
      expect(result.stdout).toContain("Commands:");
      expect(result.stdout).toContain("init");
      expect(result.stdout).toContain("run");
    });

    it("should show help with --help flag", async () => {
      const result = await execCLI(["--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia - Content intelligence CLI");
      expect(result.stdout).toContain("Commands:");
    });

    it("should show help with -h flag", async () => {
      const result = await execCLI(["-h"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia - Content intelligence CLI");
    });

    it("should show version with --version flag", async () => {
      const result = await execCLI(["--version"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia 0.5.0");
    });

    it("should show version with -v flag", async () => {
      const result = await execCLI(["-v"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia 0.5.0");
    });

    it("should error on unknown command", async () => {
      const result = await execCLI(["unknown-command"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown command: unknown-command");
    });
  });

  describe("Run Command", () => {
    it("should build writing kit with all options", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "run",
        "--file",
        inputFile,
        "--topics",
        "ai,agents,software",
        "--tone",
        "expert",
        "--word-count",
        "1500",
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      // stderr may contain status messages like "✓ Content written" and "⏳ Processing"
      expect(result.stderr).not.toContain("Error");

      // Parse and validate WritingKit JSON
      const kit = JSON.parse(result.stdout);
      expect(kit).toHaveProperty("contentId");
      expect(kit).toHaveProperty("source");
      expect(kit).toHaveProperty("summary");
      expect(kit).toHaveProperty("ideas");
      expect(kit).toHaveProperty("suggestedOutline");
      expect(kit).toHaveProperty("meta");

      // Validate nested structures
      expect(kit.summary).toHaveProperty("headline");
      expect(kit.summary).toHaveProperty("tldr");
      expect(kit.ideas).toHaveProperty("hooks");
      expect(kit.ideas).toHaveProperty("angles");
      expect(kit.ideas).toHaveProperty("questions");
      expect(Array.isArray(kit.ideas.hooks)).toBe(true);
      expect(Array.isArray(kit.ideas.angles)).toBe(true);
      expect(Array.isArray(kit.ideas.questions)).toBe(true);
      expect(Array.isArray(kit.suggestedOutline)).toBe(true);
      expect(kit.suggestedOutline.length).toBeGreaterThan(0);
    });

    it("should use defaults when optional args omitted", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI(["run", "--file", inputFile, "--mock"]);

      expect(result.exitCode).toBe(0);
      const kit = JSON.parse(result.stdout);
      expect(kit).toHaveProperty("summary");
      expect(kit).toHaveProperty("ideas");
      expect(kit).toHaveProperty("suggestedOutline");
    });

    it("should output markdown format for kit", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "run",
        "--file",
        inputFile,
        "--format",
        "markdown",
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("# Writing Kit:");
      expect(result.stdout).toContain("## Summary");
      expect(result.stdout).toContain("## Writing Ideas");
      expect(result.stdout).toContain("### Hooks");
      expect(result.stdout).toContain("### Angles");
      expect(result.stdout).toContain("### Questions");
      expect(result.stdout).toContain("## Suggested Outline");
    });

    it("should write kit output to file", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);
      const outputFile = join(tempDir.path, "kit.json");

      const result = await execCLI([
        "run",
        "--file",
        inputFile,
        "--output",
        outputFile,
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Writing kit saved to: ${outputFile}`);

      const outputContent = readTestFile(outputFile);
      const kit = JSON.parse(outputContent);
      expect(kit).toHaveProperty("summary");
      expect(kit).toHaveProperty("ideas");
    });

    it("should parse topics correctly", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "run",
        "--file",
        inputFile,
        "--topics",
        "ai,productivity,startup",
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      const kit = JSON.parse(result.stdout);
      expect(kit).toHaveProperty("ideas");
    });

    it("should handle topics with whitespace", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "run",
        "--file",
        inputFile,
        "--topics",
        " ai , productivity , startup ",
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      const kit = JSON.parse(result.stdout);
      expect(kit).toHaveProperty("ideas");
    });

    it("should handle all valid tone values", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const tones = ["beginner", "intermediate", "expert", "mixed"];

      for (const tone of tones) {
        const result = await execCLI([
          "run",
          "--file",
          inputFile,
          "--tone",
          tone,
          "--mock",
        ]);

        expect(result.exitCode).toBe(0);
        const kit = JSON.parse(result.stdout);
        expect(kit).toHaveProperty("ideas");
      }
    });

    it("should use intermediate tone for invalid value", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "run",
        "--file",
        inputFile,
        "--tone",
        "invalid-tone",
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      const kit = JSON.parse(result.stdout);
      expect(kit).toHaveProperty("ideas");
    });

    it("should handle custom word count", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "run",
        "--file",
        inputFile,
        "--word-count",
        "2000",
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      const kit = JSON.parse(result.stdout);
      expect(kit).toHaveProperty("suggestedOutline");
    });

    it("should error when --file is missing", async () => {
      const result = await execCLI(["run"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "Error: Either --file or --session-id is required"
      );
    });

    it("should error when file does not exist", async () => {
      const result = await execCLI([
        "run",
        "--file",
        "/non/existent/file.txt",
        "--mock",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Could not read file");
    });

    it("should show command help with --help", async () => {
      const result = await execCLI(["run", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia kit");
      expect(result.stdout).toContain("--file");
      expect(result.stdout).toContain("--topics");
      expect(result.stdout).toContain("--tone");
      expect(result.stdout).toContain("--word-count");
    });

    it("should accept --session-id flag", async () => {
      const result = await execCLI([
        "run",
        "--session-id",
        "nonexistent-id",
        "--mock",
      ]);

      // Should fail because session doesn't exist, but --session-id should be recognized
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Error: Session "nonexistent-id" not found'
      );
    });
  });
});
