import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  spyOn,
} from "bun:test";
import { runKitCommand } from "../../src/commands/kit";
import {
  cleanupTestContentItems,
  createTempDir,
  createTestFile,
  readTestFile,
} from "../utils";

// Mock process.exit to prevent test termination
const mockExit = spyOn(process, "exit").mockImplementation((() => {
  throw new Error("process.exit called");
}) as never);

describe("runKitCommand", () => {
  let tempDir: { path: string; cleanup: () => void };
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  afterAll(() => {
    // Clean up test-generated content items from ~/.looplia/contentItem/cli-*
    cleanupTestContentItems();
  });

  beforeEach(() => {
    tempDir = createTempDir();
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {
      // no-op
    });
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {
      // no-op
    });
    mockExit.mockClear();
  });

  afterEach(() => {
    tempDir.cleanup();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should display help when --help flag is provided", async () => {
    await runKitCommand(["--help"]);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("looplia kit");
    expect(output).toContain("--file");
    expect(output).toContain("--topics");
    expect(output).toContain("--tone");
    expect(output).toContain("--word-count");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should display help when -h flag is provided", async () => {
    await runKitCommand(["-h"]);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("looplia kit");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should exit with error when --file is missing", async () => {
    await expect(async () => {
      await runKitCommand([]);
    }).toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Either --file or --session-id is required")
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should build kit with all options specified", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "AI agents are transforming software development. They enable autonomous systems to make decisions and adapt to changing conditions. This represents a paradigm shift in how we build applications."
    );

    await runKitCommand([
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

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();

    // Verify WritingKit JSON output
    const output = consoleLogSpy.mock.calls.at(-1)?.[0];
    const kit = JSON.parse(output);
    expect(kit).toHaveProperty("contentId");
    expect(kit).toHaveProperty("source");
    expect(kit).toHaveProperty("summary");
    expect(kit).toHaveProperty("ideas");
    expect(kit).toHaveProperty("suggestedOutline");
    expect(kit).toHaveProperty("meta");

    // Verify nested structures
    expect(kit.summary).toHaveProperty("headline");
    expect(kit.summary).toHaveProperty("tldr");
    expect(kit.ideas).toHaveProperty("hooks");
    expect(kit.ideas).toHaveProperty("angles");
    expect(kit.ideas).toHaveProperty("questions");
    expect(Array.isArray(kit.suggestedOutline)).toBe(true);
  });

  it("should use defaults when optional args omitted", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Default configuration test. This content will use default tone and word count. More sentences to ensure validation passes."
    );

    await runKitCommand(["--file", inputFile, "--mock"]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();

    const output = consoleLogSpy.mock.calls.at(-1)?.[0];
    const kit = JSON.parse(output);
    expect(kit).toHaveProperty("summary");
    expect(kit).toHaveProperty("ideas");
  });

  it("should parse topics from comma-separated string", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Topics parsing test with ai, productivity, and software development themes. Multiple sentences included. Additional content here."
    );

    await runKitCommand([
      "--file",
      inputFile,
      "--topics",
      "ai,productivity,software",
      "--mock",
    ]);

    expect(mockExit).not.toHaveBeenCalled();
    // Topics are parsed internally, kit should be generated successfully
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("should handle topics with extra whitespace", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Whitespace handling test for topics parsing. Includes multiple sentences. More content follows."
    );

    await runKitCommand([
      "--file",
      inputFile,
      "--topics",
      " ai , productivity , software ",
      "--mock",
    ]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("should handle empty topics string", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Empty topics test content. This should work with no topics specified. More sentences here."
    );

    await runKitCommand(["--file", inputFile, "--topics", "", "--mock"]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("should handle all valid tone values", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Tone validation test content. Multiple sentences are needed. More text here."
    );

    const tones = ["beginner", "intermediate", "expert", "mixed"];

    for (const tone of tones) {
      mockExit.mockClear();
      consoleLogSpy.mockClear();

      await runKitCommand(["--file", inputFile, "--tone", tone, "--mock"]);

      expect(mockExit).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    }
  });

  it("should fallback to intermediate for invalid tone", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Invalid tone test. Should use intermediate as default fallback. Additional content here."
    );

    await runKitCommand([
      "--file",
      inputFile,
      "--tone",
      "invalid-tone",
      "--mock",
    ]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("should handle word count as number", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Word count test content. Multiple sentences for validation. More text follows."
    );

    await runKitCommand([
      "--file",
      inputFile,
      "--word-count",
      "2000",
      "--mock",
    ]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("should output markdown when --format markdown", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Markdown format test. This will be output as markdown. Additional sentences included."
    );

    await runKitCommand([
      "--file",
      inputFile,
      "--format",
      "markdown",
      "--mock",
    ]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();

    const output = consoleLogSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("#");
    expect(output).toContain("Writing Kit:");
    expect(output).toContain("Summary");
    expect(output).toContain("Writing Ideas");
  });

  it("should write output to file when --output is specified", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Output file test content. Will be written to a file. More sentences here."
    );
    const outputFile = `${tempDir.path}/kit-output.json`;

    await runKitCommand([
      "--file",
      inputFile,
      "--output",
      outputFile,
      "--mock",
    ]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Writing kit saved to: ${outputFile}`)
    );

    // Verify file was created with valid JSON
    const outputContent = readTestFile(outputFile);
    const kit = JSON.parse(outputContent);
    expect(kit).toHaveProperty("summary");
    expect(kit).toHaveProperty("ideas");
  });

  it("should handle non-existent file gracefully", async () => {
    await expect(async () => {
      await runKitCommand(["--file", "/does/not/exist.txt", "--mock"]);
    }).toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not read file")
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle validation errors for invalid content", async () => {
    const inputFile = createTestFile(tempDir.path, "test.txt", "");

    await expect(async () => {
      await runKitCommand(["--file", inputFile, "--mock"]);
    }).toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
