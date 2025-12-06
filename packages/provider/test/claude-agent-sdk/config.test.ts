import { afterEach, describe, expect, it } from "bun:test";
import {
  DEFAULT_CONFIG,
  resolveConfig,
  validateConfig,
} from "../../src/claude-agent-sdk/config";

describe("config", () => {
  describe("DEFAULT_CONFIG", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_CONFIG.model).toBe("claude-haiku-4-5-20251001");
      expect(DEFAULT_CONFIG.workspace).toBe("~/.looplia");
      expect(DEFAULT_CONFIG.useFilesystemExtensions).toBe(true);
      expect(DEFAULT_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_CONFIG.timeout).toBe(60_000);
    });
  });

  describe("resolveConfig", () => {
    it("should return defaults when no config provided", () => {
      const resolved = resolveConfig();

      expect(resolved.model).toBe(DEFAULT_CONFIG.model);
      expect(resolved.workspace).toBe(DEFAULT_CONFIG.workspace);
      expect(resolved.useFilesystemExtensions).toBe(
        DEFAULT_CONFIG.useFilesystemExtensions
      );
      expect(resolved.maxRetries).toBe(DEFAULT_CONFIG.maxRetries);
      expect(resolved.timeout).toBe(DEFAULT_CONFIG.timeout);
    });

    it("should override defaults with provided values", () => {
      const resolved = resolveConfig({
        model: "claude-sonnet-4-20250514",
        workspace: "/custom/path",
        useFilesystemExtensions: false,
        maxRetries: 5,
        timeout: 120_000,
      });

      expect(resolved.model).toBe("claude-sonnet-4-20250514");
      expect(resolved.workspace).toBe("/custom/path");
      expect(resolved.useFilesystemExtensions).toBe(false);
      expect(resolved.maxRetries).toBe(5);
      expect(resolved.timeout).toBe(120_000);
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

  describe("validateConfig", () => {
    const originalApiKey = process.env.ANTHROPIC_API_KEY;

    afterEach(() => {
      // Restore original env
      if (originalApiKey) {
        process.env.ANTHROPIC_API_KEY = originalApiKey;
      } else {
        process.env.ANTHROPIC_API_KEY = undefined;
      }
    });

    it("should return valid when API key is provided in config", () => {
      process.env.ANTHROPIC_API_KEY = undefined;
      const result = validateConfig({ apiKey: "test-key" });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return valid when API key is in environment", () => {
      process.env.ANTHROPIC_API_KEY = "env-test-key";
      const result = validateConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid when no API key is available", () => {
      process.env.ANTHROPIC_API_KEY = undefined;
      const result = validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("API key");
    });

    it("should return invalid for negative timeout", () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      const result = validateConfig({ timeout: -1 });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Timeout"))).toBe(true);
    });

    it("should return invalid for negative maxRetries", () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      const result = validateConfig({ maxRetries: -1 });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("maxRetries"))).toBe(true);
    });
  });
});
