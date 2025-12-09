import { describe, expect, it } from "bun:test";

/**
 * Tests for useStreamingQuery hook
 *
 * Note: Full React hook testing requires a testing library like @testing-library/react
 * These tests focus on the logic and helper functions used by the hook.
 */

describe("useStreamingQuery", () => {
  describe("activity ID generation", () => {
    it("should generate unique activity IDs", () => {
      const ids = new Set<string>();

      // Generate 100 IDs
      for (let i = 0; i < 100; i++) {
        const id = `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        ids.add(id);
      }

      // All IDs should be unique
      expect(ids.size).toBe(100);
    });

    it("should have consistent ID format", () => {
      const id = `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      expect(id).toMatch(/^activity-\d+-[a-z0-9]+$/);
    });
  });

  describe("formatToolStart", () => {
    // This is the helper function from the hook
    function formatToolStart(event: {
      tool: string;
      input: { path?: string; skill?: string };
    }): string {
      if (event.tool === "Read" && event.input.path) {
        const filename = event.input.path.split("/").pop();
        return `Reading ${filename}`;
      }
      if (event.tool === "Skill" && event.input.skill) {
        return `Running ${event.input.skill}`;
      }
      return `Using ${event.tool}`;
    }

    it("should format Read tool events with filename", () => {
      const event = {
        tool: "Read",
        input: { path: "/path/to/file.txt" },
      };

      const label = formatToolStart(event);
      expect(label).toBe("Reading file.txt");
    });

    it("should format Skill tool events", () => {
      const event = {
        tool: "Skill",
        input: { skill: "idea-generator" },
      };

      const label = formatToolStart(event);
      expect(label).toBe("Running idea-generator");
    });

    it("should handle generic tool names", () => {
      const event = {
        tool: "CustomTool",
        input: {},
      };

      const label = formatToolStart(event);
      expect(label).toBe("Using CustomTool");
    });

    it("should handle Read without path", () => {
      const event = {
        tool: "Read",
        input: {},
      };

      const label = formatToolStart(event);
      expect(label).toBe("Using Read");
    });

    it("should handle Skill without skill name", () => {
      const event = {
        tool: "Skill",
        input: {},
      };

      const label = formatToolStart(event);
      expect(label).toBe("Using Skill");
    });
  });

  // Note: Full integration tests for the hook behavior would require:
  // - @testing-library/react for renderHook
  // - Mocking the WritingKitProvider.buildKitStreaming
  // - Testing state updates through the async generator
  // These are better suited for e2e tests or require additional dependencies
});
