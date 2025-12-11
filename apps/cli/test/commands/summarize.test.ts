import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  spyOn,
} from "bun:test";
import { runSummarizeCommand } from "../../src/commands/summarize";
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

describe("runSummarizeCommand", () => {
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
    await runSummarizeCommand(["--help"]);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("looplia summarize");
    expect(output).toContain("--file");
    expect(output).toContain("--format");
    expect(output).toContain("--output");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should display help when -h flag is provided", async () => {
    await runSummarizeCommand(["-h"]);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("looplia summarize");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should exit with error when --file is missing", async () => {
    await expect(async () => {
      await runSummarizeCommand([]);
    }).toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("--file is required")
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should process file and show completion message", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "This is test content with enough text to summarize properly. It has multiple sentences to ensure validation passes."
    );

    await runSummarizeCommand(["--file", inputFile, "--mock"]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Verify completion message is shown on stderr (not JSON dump)
    const output = consoleErrorSpy.mock.calls
      .map((c) => c.join(" "))
      .join("\n");
    expect(output).toContain("Summary complete");
    expect(output).toContain("Session:");
    expect(output).toContain("Saved to:");
    expect(output).toContain("Next step:");
  });

  it("should process file with short flag -f", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Test content for short flag. Multiple sentences here. And more content."
    );

    await runSummarizeCommand(["-f", inputFile, "--mock"]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should show completion message with --format markdown", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Content for markdown test. This has multiple sentences. Here is more text."
    );

    await runSummarizeCommand([
      "--file",
      inputFile,
      "--format",
      "markdown",
      "--mock",
    ]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Now only shows completion message on stderr, not markdown dump
    const output = consoleErrorSpy.mock.calls
      .map((c) => c.join(" "))
      .join("\n");
    expect(output).toContain("Summary complete");
    expect(output).toContain("Session:");
  });

  it("should write output to file when --output is specified", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Content for output file test. Multiple sentences are included. More text here."
    );
    const outputFile = `${tempDir.path}/output.json`;

    await runSummarizeCommand([
      "--file",
      inputFile,
      "--output",
      outputFile,
      "--mock",
    ]);

    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Also written to:")
    );

    // Verify file was created with valid JSON
    const outputContent = readTestFile(outputFile);
    const summary = JSON.parse(outputContent);
    expect(summary).toHaveProperty("headline");
  });

  it("should write output to file with short flag -o", async () => {
    const inputFile = createTestFile(
      tempDir.path,
      "test.txt",
      "Content for short output flag. More sentences follow. Additional content here."
    );
    const outputFile = `${tempDir.path}/output.json`;

    await runSummarizeCommand(["-f", inputFile, "-o", outputFile, "--mock"]);

    expect(mockExit).not.toHaveBeenCalled();

    const outputContent = readTestFile(outputFile);
    const summary = JSON.parse(outputContent);
    expect(summary).toHaveProperty("headline");
  });

  it("should handle non-existent file gracefully", async () => {
    await expect(async () => {
      await runSummarizeCommand(["--file", "/does/not/exist.txt", "--mock"]);
    }).toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not read file")
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle validation errors for invalid content", async () => {
    // Create a file with content that's too short to pass validation
    const inputFile = createTestFile(tempDir.path, "test.txt", "");

    await expect(async () => {
      await runSummarizeCommand(["--file", inputFile, "--mock"]);
    }).toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
