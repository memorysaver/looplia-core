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
      expect(result.stdout).toContain("looplia 0.6.8");
    });

    it("should show version with -v flag", async () => {
      const result = await execCLI(["-v"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia 0.6.8");
    });

    it("should error on unknown command", async () => {
      const result = await execCLI(["unknown-command"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown command: unknown-command");
    });
  });

  describe("Init Command", () => {
    it("should show init help with --help flag", async () => {
      const result = await execCLI(["init", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia init");
      expect(result.stdout).toContain("--yes");
      expect(result.stdout).toContain("Initialize looplia plugin");
    });

    it("should show init help with -h flag", async () => {
      const result = await execCLI(["init", "-h"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia init");
    });

    // Note: Testing `looplia init` without --yes would hang waiting for stdin input.
    // Testing `looplia init --yes` would destructively modify ~/.looplia/.
    // These cases require integration test environment with isolated HOME.
  });

  describe("Config Command", () => {
    it("should show config help with --help flag", async () => {
      const result = await execCLI(["config", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia config");
      expect(result.stdout).toContain("topics");
      expect(result.stdout).toContain("style");
      expect(result.stdout).toContain("show");
    });

    it("should show config help with -h flag", async () => {
      const result = await execCLI(["config", "-h"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia config");
    });

    it("should show config help when no subcommand provided", async () => {
      const result = await execCLI(["config"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia config");
      expect(result.stdout).toContain("Subcommands:");
    });

    it("should error on unknown config subcommand", async () => {
      const result = await execCLI(["config", "unknown-subcommand"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown subcommand: unknown-subcommand");
    });

    it("should error when topics subcommand has no arguments", async () => {
      const result = await execCLI(["config", "topics"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error: Topics required");
    });
  });

  describe("Run Command", () => {
    it("should execute workflow in mock mode", async () => {
      const content = readFileSync(
        join(__dirname, "../fixtures/sample-article.txt"),
        "utf-8"
      );
      const inputFile = createTestFile(tempDir.path, "input.txt", content);

      const result = await execCLI([
        "run",
        "writing-kit",
        "--file",
        inputFile,
        "--mock",
      ]);

      // Log diagnostic info on failure
      if (result.exitCode !== 0) {
        console.error("Mock mode test failed:");
        console.error("stdout:", result.stdout);
        console.error("stderr:", result.stderr);
      }

      expect(result.exitCode).toBe(0);
      // Mock mode outputs to stdout
      expect(result.stdout).toContain("Workflow completed successfully");
    });

    it("should error when workflow ID is missing", async () => {
      const result = await execCLI(["run"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error: workflow-id is required");
    });

    it("should error when --file is missing", async () => {
      const result = await execCLI(["run", "writing-kit"]);

      expect(result.exitCode).toBe(1);
      // v0.6.3: Updated error message to include --input option
      expect(result.stderr).toContain(
        "Either --file, --input, or --sandbox-id is required"
      );
    });

    it("should show command help with --help", async () => {
      const result = await execCLI(["run", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia run");
      expect(result.stdout).toContain("<workflow-id>");
      expect(result.stdout).toContain("--file");
      expect(result.stdout).toContain("--sandbox");
      expect(result.stdout).toContain("--mock");
    });

    it("should show command help with -h", async () => {
      const result = await execCLI(["run", "-h"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("looplia run");
    });
  });
});
