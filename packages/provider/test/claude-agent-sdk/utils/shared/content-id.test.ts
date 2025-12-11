import { describe, expect, it } from "bun:test";

import { extractContentIdFromPrompt } from "../../../../src/claude-agent-sdk/utils/shared/content-id";

describe("utils/shared/content-id", () => {
  describe("extractContentIdFromPrompt", () => {
    it("should extract valid content ID from prompt", () => {
      const prompt = "Process contentItem/test-content-123 for analysis";
      const contentId = extractContentIdFromPrompt(prompt);

      expect(contentId).toBe("test-content-123");
    });

    it("should handle URL-encoded content IDs", () => {
      const prompt = "Process contentItem/test%2Dcontent%2D456 for analysis";
      const contentId = extractContentIdFromPrompt(prompt);

      expect(contentId).toBe("test-content-456");
    });

    it("should return null for prompts without content ID", () => {
      const prompt = "Just a regular prompt without content ID";
      const contentId = extractContentIdFromPrompt(prompt);

      expect(contentId).toBeNull();
    });

    it("should reject path traversal attempts with ..", () => {
      const prompt = "Process contentItem/../etc/passwd for analysis";
      const contentId = extractContentIdFromPrompt(prompt);

      expect(contentId).toBeNull();
    });

    it("should extract only first path segment when slashes present", () => {
      // Regex stops at first slash, extracting just "test" which is valid
      const prompt = "Process contentItem/test/path for analysis";
      const contentId = extractContentIdFromPrompt(prompt);

      expect(contentId).toBe("test");
    });

    it("should reject content IDs with backslashes", () => {
      const prompt = "Process contentItem/test\\path for analysis";
      const contentId = extractContentIdFromPrompt(prompt);

      expect(contentId).toBeNull();
    });

    it("should reject content IDs with null bytes", () => {
      const prompt = "Process contentItem/test\x00content for analysis";
      const contentId = extractContentIdFromPrompt(prompt);

      expect(contentId).toBeNull();
    });

    it("should reject content IDs with invalid characters", () => {
      const prompt = "Process contentItem/test<script> for analysis";
      const contentId = extractContentIdFromPrompt(prompt);

      expect(contentId).toBeNull();
    });

    it("should accept content IDs with valid characters (alphanumeric, dash, underscore)", () => {
      const validIds = [
        "test-123",
        "test_456",
        "TestContent789",
        "a1b2c3",
        "content-with-many-dashes",
        "content_with_underscores",
      ];

      for (const id of validIds) {
        const prompt = `Process contentItem/${id} for analysis`;
        const contentId = extractContentIdFromPrompt(prompt);
        expect(contentId).toBe(id);
      }
    });

    it("should handle malformed URL encoding", () => {
      const prompt = "Process contentItem/%ZZ for analysis";
      const contentId = extractContentIdFromPrompt(prompt);

      // Should return null if decodeURIComponent fails
      expect(contentId).toBeNull();
    });

    // Additional comprehensive path traversal tests
    describe("path traversal prevention", () => {
      it("should reject URL-encoded path traversal", () => {
        const prompt = "Process: contentItem/%2e%2e%2fetc%2fpasswd/content.md";
        expect(extractContentIdFromPrompt(prompt)).toBeNull();
      });

      it("should reject double URL-encoded path traversal", () => {
        const prompt = "Process: contentItem/%252e%252e/content.md";
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
    });

    // Valid ID format tests
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
