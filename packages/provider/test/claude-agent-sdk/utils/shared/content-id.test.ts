import { describe, expect, it } from "bun:test";

import { extractContentIdFromPrompt } from "../../../../src/claude-agent-sdk/utils/shared/content-id";

describe("utils/shared/content-id", () => {
  describe("extractContentIdFromPrompt", () => {
    it("should extract valid sandbox ID from prompt", () => {
      const prompt = "Process sandbox/test-sandbox-123 for analysis";
      const sandboxId = extractContentIdFromPrompt(prompt);

      expect(sandboxId).toBe("test-sandbox-123");
    });

    it("should handle URL-encoded sandbox IDs", () => {
      const prompt = "Process sandbox/test%2Dsandbox%2D456 for analysis";
      const sandboxId = extractContentIdFromPrompt(prompt);

      expect(sandboxId).toBe("test-sandbox-456");
    });

    it("should return null for prompts without sandbox ID", () => {
      const prompt = "Just a regular prompt without sandbox ID";
      const sandboxId = extractContentIdFromPrompt(prompt);

      expect(sandboxId).toBeNull();
    });

    it("should reject path traversal attempts with ..", () => {
      const prompt = "Process sandbox/../etc/passwd for analysis";
      const sandboxId = extractContentIdFromPrompt(prompt);

      expect(sandboxId).toBeNull();
    });

    it("should extract only first path segment when slashes present", () => {
      // Regex stops at first slash, extracting just "test" which is valid
      const prompt = "Process sandbox/test/path for analysis";
      const sandboxId = extractContentIdFromPrompt(prompt);

      expect(sandboxId).toBe("test");
    });

    it("should reject sandbox IDs with backslashes", () => {
      const prompt = "Process sandbox/test\\path for analysis";
      const sandboxId = extractContentIdFromPrompt(prompt);

      expect(sandboxId).toBeNull();
    });

    it("should reject sandbox IDs with null bytes", () => {
      const prompt = "Process sandbox/test\x00sandbox for analysis";
      const sandboxId = extractContentIdFromPrompt(prompt);

      expect(sandboxId).toBeNull();
    });

    it("should reject sandbox IDs with invalid characters", () => {
      const prompt = "Process sandbox/test<script> for analysis";
      const sandboxId = extractContentIdFromPrompt(prompt);

      expect(sandboxId).toBeNull();
    });

    it("should accept sandbox IDs with valid characters (alphanumeric, dash, underscore)", () => {
      const validIds = [
        "test-123",
        "test_456",
        "TestSandbox789",
        "a1b2c3",
        "sandbox-with-many-dashes",
        "sandbox_with_underscores",
      ];

      for (const id of validIds) {
        const prompt = `Process sandbox/${id} for analysis`;
        const sandboxId = extractContentIdFromPrompt(prompt);
        expect(sandboxId).toBe(id);
      }
    });

    it("should handle malformed URL encoding", () => {
      const prompt = "Process sandbox/%ZZ for analysis";
      const sandboxId = extractContentIdFromPrompt(prompt);

      // Should return null if decodeURIComponent fails
      expect(sandboxId).toBeNull();
    });

    // Additional comprehensive path traversal tests
    describe("path traversal prevention", () => {
      it("should reject URL-encoded path traversal", () => {
        const prompt = "Process: sandbox/%2e%2e%2fetc%2fpasswd/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should reject double URL-encoded path traversal", () => {
        const prompt = "Process: sandbox/%252e%252e/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should reject special characters not in whitelist", () => {
        const prompt = "Process: sandbox/id;rm -rf/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should only extract up to space (regex stops at whitespace)", () => {
        // Regex captures up to first space, so "id with spaces" extracts "id"
        // "id" passes whitelist validation - this is safe behavior
        const prompt = "Process: sandbox/id with spaces/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBe("id");
      });

      it("should reject dots (except in valid patterns)", () => {
        const prompt = "Process: sandbox/file.txt/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });
    });

    // CLI argument format tests
    describe("CLI argument formats", () => {
      it("should extract sandbox ID from --sandbox-id argument", () => {
        const prompt =
          "/run writing-kit --file /path/to/file.md --sandbox-id text-2025-12-18-ai-healthcare";
        expect(extractContentIdFromPrompt(prompt)).toBe(
          "text-2025-12-18-ai-healthcare"
        );
      });

      it("should extract sandbox ID from --sandbox argument (resume)", () => {
        const prompt = "/run writing-kit --sandbox my-existing-sandbox";
        expect(extractContentIdFromPrompt(prompt)).toBe("my-existing-sandbox");
      });

      it("should handle --sandbox-id with multiple spaces", () => {
        const prompt = "/run writing-kit --sandbox-id   spaced-id";
        expect(extractContentIdFromPrompt(prompt)).toBe("spaced-id");
      });

      it("should prefer sandbox/ path over --sandbox-id argument", () => {
        // sandbox/ path should take precedence
        const prompt = "Process sandbox/path-id and --sandbox-id arg-id";
        expect(extractContentIdFromPrompt(prompt)).toBe("path-id");
      });

      it("should reject invalid IDs from --sandbox-id argument", () => {
        const prompt = "/run writing-kit --sandbox-id invalid<id>";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });
    });

    // Legacy contentItem/ support
    describe("legacy contentItem format", () => {
      it("should accept legacy contentItem/ path", () => {
        const prompt = "Process contentItem/legacy-id/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBe("legacy-id");
      });

      it("should prefer sandbox/ over contentItem/", () => {
        const prompt =
          "Process sandbox/new-id and contentItem/old-id/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBe("new-id");
      });
    });

    // Valid ID format tests
    describe("valid sandbox IDs", () => {
      it("should accept alphanumeric IDs", () => {
        expect(extractContentIdFromPrompt("sandbox/abc123/content.md")).toBe(
          "abc123"
        );
      });

      it("should accept IDs with hyphens", () => {
        expect(
          extractContentIdFromPrompt("sandbox/my-sandbox-id/content.md")
        ).toBe("my-sandbox-id");
      });

      it("should accept IDs with underscores", () => {
        expect(
          extractContentIdFromPrompt("sandbox/my_sandbox_id/content.md")
        ).toBe("my_sandbox_id");
      });

      it("should accept mixed case", () => {
        expect(
          extractContentIdFromPrompt("sandbox/MySandboxID/content.md")
        ).toBe("MySandboxID");
      });

      it("should accept URL-encoded valid characters", () => {
        // %2D is hyphen, should be decoded and accepted
        expect(extractContentIdFromPrompt("sandbox/my%2Did/content.md")).toBe(
          "my-id"
        );
      });
    });
  });
});
