import { afterEach, describe, expect, it } from "bun:test";
import {
  type BuildArgs,
  buildPrompt,
  parseArgs,
  validateEnvironment,
} from "../../src/commands/build";

describe("build command", () => {
  describe("parseArgs", () => {
    it("should parse description from positional args", () => {
      const result = parseArgs(["summarize", "articles"]);
      expect(result.description).toBe("summarize articles");
    });

    it("should parse single word description", () => {
      const result = parseArgs(["summarize"]);
      expect(result.description).toBe("summarize");
    });

    it("should parse empty args", () => {
      const result = parseArgs([]);
      expect(result.description).toBe("");
      expect(result.help).toBe(false);
      expect(result.mock).toBe(false);
      expect(result.noInteractive).toBe(false);
    });

    it("should handle --name flag", () => {
      const result = parseArgs(["--name", "my-workflow"]);
      expect(result.name).toBe("my-workflow");
    });

    it("should handle -n flag", () => {
      const result = parseArgs(["-n", "my-workflow"]);
      expect(result.name).toBe("my-workflow");
    });

    it("should handle --output flag", () => {
      const result = parseArgs(["--output", "/custom/path"]);
      expect(result.output).toBe("/custom/path");
    });

    it("should handle -o flag", () => {
      const result = parseArgs(["-o", "/custom/path"]);
      expect(result.output).toBe("/custom/path");
    });

    it("should handle --no-interactive flag", () => {
      const result = parseArgs(["--no-interactive"]);
      expect(result.noInteractive).toBe(true);
    });

    it("should handle --mock flag", () => {
      const result = parseArgs(["--mock"]);
      expect(result.mock).toBe(true);
    });

    it("should handle --help flag", () => {
      const result = parseArgs(["--help"]);
      expect(result.help).toBe(true);
    });

    it("should handle -h flag", () => {
      const result = parseArgs(["-h"]);
      expect(result.help).toBe(true);
    });

    it("should handle mixed flags and description", () => {
      const result = parseArgs([
        "analyze",
        "videos",
        "--name",
        "video-analyzer",
        "--mock",
      ]);
      expect(result.description).toBe("analyze videos");
      expect(result.name).toBe("video-analyzer");
      expect(result.mock).toBe(true);
    });

    it("should handle flags before description", () => {
      const result = parseArgs(["--mock", "summarize", "articles"]);
      expect(result.mock).toBe(true);
      expect(result.description).toBe("summarize articles");
    });

    it("should skip value after value flags", () => {
      const result = parseArgs(["--name", "my-workflow", "description"]);
      expect(result.name).toBe("my-workflow");
      expect(result.description).toBe("description");
    });

    it("should ignore unknown flags", () => {
      const result = parseArgs(["--unknown", "summarize"]);
      expect(result.description).toBe("summarize");
    });

    it("should throw error when --name flag has no value", () => {
      expect(() => parseArgs(["--name"])).toThrow("--name requires a value");
    });

    it("should throw error when --output flag has no value", () => {
      expect(() => parseArgs(["--output"])).toThrow(
        "--output requires a value"
      );
    });

    it("should throw error when value flag is followed by another flag", () => {
      expect(() => parseArgs(["--name", "--mock"])).toThrow(
        "--name requires a value"
      );
    });

    it("should handle all flags together", () => {
      const result = parseArgs([
        "create",
        "blog",
        "outline",
        "--name",
        "blog-writer",
        "--output",
        "/tmp",
        "--no-interactive",
        "--mock",
      ]);
      expect(result.description).toBe("create blog outline");
      expect(result.name).toBe("blog-writer");
      expect(result.output).toBe("/tmp");
      expect(result.noInteractive).toBe(true);
      expect(result.mock).toBe(true);
    });
  });

  describe("buildPrompt", () => {
    it("should create /build prompt from description", () => {
      const args: BuildArgs = {
        description: "summarize articles",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe("/looplia:build summarize articles");
    });

    it("should return just /build when no description", () => {
      const args: BuildArgs = {
        description: "",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe("/looplia:build");
    });

    it("should sanitize newlines from description", () => {
      const args: BuildArgs = {
        description: "analyze\nvideos and create",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe("/looplia:build analyze videos and create");
      expect(result).not.toContain("\n");
      expect(result).not.toContain("\r");
    });

    it("should replace carriage returns with spaces", () => {
      const args: BuildArgs = {
        description: "line1\rline2",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe("/looplia:build line1 line2");
    });

    it("should limit description to 500 chars", () => {
      const longDescription = "a".repeat(600);
      const args: BuildArgs = {
        description: longDescription,
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      // /looplia:build + space + 500 chars = 515 chars
      expect(result.length).toBe(515);
      expect(result).toBe(`/looplia:build ${"a".repeat(500)}`);
    });

    it("should trim whitespace from description", () => {
      const args: BuildArgs = {
        description: "  summarize articles  ",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe("/looplia:build summarize articles");
    });

    it("should handle description with only whitespace", () => {
      // Whitespace-only descriptions are sanitized to empty string
      // and not appended to the prompt
      const args: BuildArgs = {
        description: "   ",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe("/looplia:build");
    });

    it("should include --name flag in prompt when provided", () => {
      const args: BuildArgs = {
        description: "summarize articles",
        name: "article-summary",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe(
        "/looplia:build --name article-summary summarize articles"
      );
    });

    it("should include --name flag even with empty description", () => {
      const args: BuildArgs = {
        description: "",
        name: "my-workflow",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe("/looplia:build --name my-workflow");
    });

    it("should sanitize --name to safe filename characters", () => {
      const args: BuildArgs = {
        description: "test",
        name: "my workflow@#$%",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      // Special characters replaced with hyphens, consecutive hyphens collapsed
      expect(result).toBe("/looplia:build --name my-workflow test");
    });

    it("should collapse consecutive hyphens in --name", () => {
      const args: BuildArgs = {
        description: "test",
        name: "my---workflow---name",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe("/looplia:build --name my-workflow-name test");
    });

    it("should omit --name when it becomes empty after sanitization", () => {
      const args: BuildArgs = {
        description: "test",
        name: "@#$%^&*()", // All special characters, becomes empty
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      // --name should not be included since sanitized name is empty
      expect(result).toBe("/looplia:build test");
    });

    it("should limit --name to 50 characters", () => {
      const args: BuildArgs = {
        description: "test",
        name: "a".repeat(60),
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      // Name should be truncated to 50 chars
      expect(result).toBe(`/looplia:build --name ${"a".repeat(50)} test`);
    });

    it("should trim whitespace from --name", () => {
      const args: BuildArgs = {
        description: "test",
        name: "  my-workflow  ",
        noInteractive: false,
        mock: false,
        help: false,
      };
      const result = buildPrompt(args);
      expect(result).toBe("/looplia:build --name my-workflow test");
    });
  });

  describe("validateEnvironment", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("should skip validation in mock mode", () => {
      // Clear API keys
      process.env.ANTHROPIC_API_KEY = undefined;
      process.env.CLAUDE_CODE_OAUTH_TOKEN = undefined;

      // Should not throw in mock mode
      expect(() => validateEnvironment(true)).not.toThrow();
    });

    it("should pass when ANTHROPIC_API_KEY is set", () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      process.env.CLAUDE_CODE_OAUTH_TOKEN = undefined;

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = (() => {
        exitCalled = true;
      }) as never;

      validateEnvironment(false);
      expect(exitCalled).toBe(false);

      process.exit = originalExit;
    });

    it("should pass when CLAUDE_CODE_OAUTH_TOKEN is set", () => {
      process.env.ANTHROPIC_API_KEY = undefined;
      process.env.CLAUDE_CODE_OAUTH_TOKEN = "test-token";

      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = (() => {
        exitCalled = true;
      }) as never;

      validateEnvironment(false);
      expect(exitCalled).toBe(false);

      process.exit = originalExit;
    });

    it("should exit when no API key is available", () => {
      process.env.ANTHROPIC_API_KEY = undefined;
      process.env.CLAUDE_CODE_OAUTH_TOKEN = undefined;

      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code: number) => {
        exitCode = code;
      }) as never;

      validateEnvironment(false);
      expect(exitCode).toBe(1);

      process.exit = originalExit;
    });
  });
});
