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

// Regex patterns at top level for performance
const SENTIMENT_PATTERN = /positive|neutral|negative/;
const JSON_OBJECT_PATTERN = /\{[\s\S]*\}/;
const CONTENT_ID_PATTERN = /^[a-z]+-/;

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
      expect(result.stdout).toContain("summarize");
      expect(result.stdout).toContain("kit");
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
      expect(result.stdout).toContain("looplia 0.3.4");
    });

    it("should show version with -v flag", async () => {
      const result = await execCLI(["-v"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia 0.3.4");
    });

    it("should error on unknown command", async () => {
      const result = await execCLI(["unknown-command"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown command: unknown-command");
    });
  });

  describe("Summarize Command", () => {
    it("should summarize content and output JSON to stdout", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "summarize",
        "--file",
        inputFile,
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      // Progress messages are printed to stderr, which is expected behavior
      // Verify no ERROR messages in stderr
      expect(result.stderr).not.toContain("Error:");

      // Extract JSON from stdout (metadata is printed before JSON)
      const jsonMatch = result.stdout.match(JSON_OBJECT_PATTERN);
      expect(jsonMatch).not.toBe(null);
      const summary = JSON.parse(jsonMatch?.[0] ?? "");
      expect(summary).toHaveProperty("contentId");
      expect(summary).toHaveProperty("headline");
      expect(summary).toHaveProperty("tldr");
      expect(summary).toHaveProperty("bullets");
      expect(summary).toHaveProperty("tags");
      expect(summary).toHaveProperty("sentiment");
      expect(summary).toHaveProperty("category");
      expect(summary).toHaveProperty("score");
      expect(Array.isArray(summary.bullets)).toBe(true);
      expect(Array.isArray(summary.tags)).toBe(true);
      expect(summary.sentiment).toMatch(SENTIMENT_PATTERN);
    });

    it("should use short flag -f for file input", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI(["summarize", "-f", inputFile, "--mock"]);

      expect(result.exitCode).toBe(0);
      const jsonMatch = result.stdout.match(JSON_OBJECT_PATTERN);
      expect(jsonMatch).not.toBe(null);
      const summary = JSON.parse(jsonMatch?.[0] ?? "");
      expect(summary).toHaveProperty("headline");
    });

    it("should output markdown format when specified", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "summarize",
        "--file",
        inputFile,
        "--format",
        "markdown",
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("# ");
      expect(result.stdout).toContain("## TL;DR");
      expect(result.stdout).toContain("## Key Points");
      expect(result.stdout).toContain("## Metadata");
      expect(result.stdout).toContain("- ");
    });

    it("should write output to file when --output is specified", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);
      const outputFile = join(tempDir.path, "output.json");

      const result = await execCLI([
        "summarize",
        "--file",
        inputFile,
        "--output",
        outputFile,
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Summary written to: ${outputFile}`);

      // Verify file was created with valid JSON
      const outputContent = readTestFile(outputFile);
      const summary = JSON.parse(outputContent);
      expect(summary).toHaveProperty("headline");
      expect(summary).toHaveProperty("tldr");
    });

    it("should write markdown to file with -o flag", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);
      const outputFile = join(tempDir.path, "output.md");

      const result = await execCLI([
        "summarize",
        "-f",
        inputFile,
        "--format",
        "markdown",
        "-o",
        outputFile,
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Summary written to: ${outputFile}`);

      const outputContent = readTestFile(outputFile);
      expect(outputContent).toContain("# ");
      expect(outputContent).toContain("## TL;DR");
    });

    it("should error when --file is missing", async () => {
      const result = await execCLI(["summarize"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error: --file is required");
    });

    it("should error when file does not exist", async () => {
      const result = await execCLI([
        "summarize",
        "--file",
        "/non/existent/file.txt",
        "--mock",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Could not read file");
    });

    it("should show command help with --help", async () => {
      const result = await execCLI(["summarize", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia summarize");
      expect(result.stdout).toContain("--file");
      expect(result.stdout).toContain("--format");
      expect(result.stdout).toContain("--output");
    });

    it("should handle special characters in content", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/special-chars.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "summarize",
        "--file",
        inputFile,
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      const jsonMatch = result.stdout.match(JSON_OBJECT_PATTERN);
      expect(jsonMatch).not.toBe(null);
      const summary = JSON.parse(jsonMatch?.[0] ?? "");
      expect(summary).toHaveProperty("headline");
    });

    it("should generate meaningful content ID with detected source", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      // Summarize content to generate ID
      const result = await execCLI([
        "summarize",
        "--file",
        inputFile,
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);

      // Extract summary JSON
      const jsonMatch = result.stdout.match(JSON_OBJECT_PATTERN);
      expect(jsonMatch).not.toBe(null);
      const summary = JSON.parse(jsonMatch?.[0] ?? "");

      // Verify contentId is generated and returned
      expect(summary).toHaveProperty("contentId");
      const contentId = summary.contentId;
      expect(contentId).toMatch(CONTENT_ID_PATTERN);

      // Verify summary has all required fields
      expect(summary).toHaveProperty("headline");
      expect(summary).toHaveProperty("tldr");
      expect(summary).toHaveProperty("bullets");
      expect(summary).toHaveProperty("tags");

      // Verify sessionId is displayed in output
      expect(result.stdout).toContain(`Session ID: ${contentId}`);
    });

    it("should accept --session-id flag for kit command", async () => {
      const result = await execCLI([
        "kit",
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

  describe("Kit Command", () => {
    it("should build writing kit with all options", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "kit",
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

      const result = await execCLI(["kit", "--file", inputFile, "--mock"]);

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
        "kit",
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
        "kit",
        "--file",
        inputFile,
        "--output",
        outputFile,
        "--mock",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Writing kit written to: ${outputFile}`);

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
        "kit",
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
        "kit",
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
          "kit",
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
        "kit",
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
        "kit",
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
      const result = await execCLI(["kit"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "Error: Either --file or --session-id is required"
      );
    });

    it("should error when file does not exist", async () => {
      const result = await execCLI([
        "kit",
        "--file",
        "/non/existent/file.txt",
        "--mock",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Could not read file");
    });

    it("should show command help with --help", async () => {
      const result = await execCLI(["kit", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia kit");
      expect(result.stdout).toContain("--file");
      expect(result.stdout).toContain("--topics");
      expect(result.stdout).toContain("--tone");
      expect(result.stdout).toContain("--word-count");
    });
  });
});
