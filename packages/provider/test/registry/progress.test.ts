import { describe, expect, it } from "bun:test";
import { createProgress, withProgress } from "../../src/registry/progress";

describe("registry/progress", () => {
  describe("createProgress", () => {
    it("should create a progress indicator", () => {
      const progress = createProgress();

      expect(progress.start).toBeDefined();
      expect(progress.succeed).toBeDefined();
      expect(progress.fail).toBeDefined();
      expect(progress.update).toBeDefined();
      expect(progress.stop).toBeDefined();
    });

    it("should not throw when calling methods", () => {
      const progress = createProgress();

      expect(() => {
        progress.start("Starting operation");
        progress.update("Updating status");
        progress.succeed("Operation complete");
      }).not.toThrow();
    });

    it("should handle fail correctly", () => {
      const progress = createProgress();

      expect(() => {
        progress.start("Starting operation");
        progress.fail("Operation failed");
      }).not.toThrow();
    });

    it("should handle stop correctly", () => {
      const progress = createProgress();

      expect(() => {
        progress.start("Starting operation");
        progress.stop();
      }).not.toThrow();
    });
  });

  describe("withProgress", () => {
    it("should wrap successful async operations", async () => {
      const result = await withProgress("Testing", async () => "success");

      expect(result).toBe("success");
    });

    it("should propagate errors from wrapped operations", async () => {
      await expect(
        withProgress("Testing", () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");
    });

    it("should support custom success/fail messages", async () => {
      const result = await withProgress("Testing", async () => "result", {
        successMessage: "Custom success",
      });

      expect(result).toBe("result");
    });
  });
});
