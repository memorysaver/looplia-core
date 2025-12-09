import { describe, expect, it } from "bun:test";

import { extractContentIdFromPrompt } from "../../src/claude-agent-sdk/utils/query-wrapper";

describe("query-wrapper", () => {
  describe("extractContentIdFromPrompt", () => {
    it("should extract valid content ID from prompt", () => {
      const prompt = "Process: contentItem/abc123/content.md";
      expect(extractContentIdFromPrompt(prompt)).toBe("abc123");
    });

    it("should extract ID with hyphens", () => {
      const prompt = "Process: contentItem/cli-1234567890/content.md";
      expect(extractContentIdFromPrompt(prompt)).toBe("cli-1234567890");
    });

    it("should extract ID with underscores", () => {
      const prompt = "Process: contentItem/session_abc_123/content.md";
      expect(extractContentIdFromPrompt(prompt)).toBe("session_abc_123");
    });

    it("should return null for prompt without content ID", () => {
      const prompt = "Just a regular prompt without content path";
      expect(extractContentIdFromPrompt(prompt)).toBeNull();
    });

    // Path traversal prevention tests
    describe("path traversal prevention", () => {
      it("should reject .. path traversal", () => {
        const prompt = "Process: contentItem/../etc/passwd/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should only extract first path segment (regex stops at slash)", () => {
        // Regex captures up to first slash, so "path/to/file" extracts "path"
        // This is safe because "path" passes whitelist validation
        const prompt = "Process: contentItem/path/to/file/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBe("path");
      });

      it("should reject backslash in ID", () => {
        const prompt = "Process: contentItem/path\\to\\file/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should reject URL-encoded path traversal", () => {
        const prompt = "Process: contentItem/%2e%2e%2fetc%2fpasswd/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should reject double URL-encoded path traversal", () => {
        const prompt = "Process: contentItem/%252e%252e/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should reject null bytes", () => {
        const prompt = "Process: contentItem/valid%00malicious/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should reject special characters not in whitelist", () => {
        const prompt = "Process: contentItem/id;rm -rf/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should only extract up to space (regex stops at whitespace)", () => {
        // Regex captures up to first space, so "id with spaces" extracts "id"
        // "id" passes whitelist validation - this is safe behavior
        const prompt = "Process: contentItem/id with spaces/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBe("id");
      });

      it("should reject dots (except in valid patterns)", () => {
        const prompt = "Process: contentItem/file.txt/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should reject invalid URL encoding", () => {
        const prompt = "Process: contentItem/%GG/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });
    });

    // Valid ID tests
    describe("valid content IDs", () => {
      it("should accept alphanumeric IDs", () => {
        expect(
          extractContentIdFromPrompt("contentItem/abc123/content.md")
        ).toBe("abc123");
      });

      it("should accept IDs with hyphens", () => {
        expect(
          extractContentIdFromPrompt("contentItem/my-content-id/content.md")
        ).toBe("my-content-id");
      });

      it("should accept IDs with underscores", () => {
        expect(
          extractContentIdFromPrompt("contentItem/my_content_id/content.md")
        ).toBe("my_content_id");
      });

      it("should accept mixed case", () => {
        expect(
          extractContentIdFromPrompt("contentItem/MyContentID/content.md")
        ).toBe("MyContentID");
      });

      it("should accept URL-encoded valid characters", () => {
        // %2D is hyphen, should be decoded and accepted
        expect(
          extractContentIdFromPrompt("contentItem/my%2Did/content.md")
        ).toBe("my-id");
      });
    });
  });
});
