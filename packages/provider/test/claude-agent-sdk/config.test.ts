import { describe, expect, it } from "bun:test";
import { DEFAULT_CONFIG, resolveConfig } from "../../src/claude-agent-sdk/config";

describe("config", () => {
  describe("DEFAULT_CONFIG", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_CONFIG.model).toBe("claude-haiku-4-5-20251001");
      expect(DEFAULT_CONFIG.workspace).toBe("~/.looplia");
      expect(DEFAULT_CONFIG.useFilesystemExtensions).toBe(true);
      expect(DEFAULT_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_CONFIG.timeout).toBe(60000);
    });
  });

  describe("resolveConfig", () => {
    it("should return defaults when no config provided", () => {
      const resolved = resolveConfig();

      expect(resolved.model).toBe(DEFAULT_CONFIG.model);
      expect(resolved.workspace).toBe(DEFAULT_CONFIG.workspace);
      expect(resolved.useFilesystemExtensions).toBe(DEFAULT_CONFIG.useFilesystemExtensions);
      expect(resolved.maxRetries).toBe(DEFAULT_CONFIG.maxRetries);
      expect(resolved.timeout).toBe(DEFAULT_CONFIG.timeout);
    });

    it("should override defaults with provided values", () => {
      const resolved = resolveConfig({
        model: "claude-sonnet-4-20250514",
        workspace: "/custom/path",
        useFilesystemExtensions: false,
        maxRetries: 5,
        timeout: 120000,
      });

      expect(resolved.model).toBe("claude-sonnet-4-20250514");
      expect(resolved.workspace).toBe("/custom/path");
      expect(resolved.useFilesystemExtensions).toBe(false);
      expect(resolved.maxRetries).toBe(5);
      expect(resolved.timeout).toBe(120000);
    });

    it("should preserve optional config values", () => {
      const resolved = resolveConfig({
        apiKey: "test-key",
        systemPrompt: "Custom prompt",
      });

      expect(resolved.apiKey).toBe("test-key");
      expect(resolved.systemPrompt).toBe("Custom prompt");
      expect(resolved.model).toBe(DEFAULT_CONFIG.model); // Default preserved
    });

    it("should handle partial overrides", () => {
      const resolved = resolveConfig({
        model: "custom-model",
      });

      expect(resolved.model).toBe("custom-model");
      expect(resolved.workspace).toBe(DEFAULT_CONFIG.workspace);
      expect(resolved.useFilesystemExtensions).toBe(true);
    });
  });
});
