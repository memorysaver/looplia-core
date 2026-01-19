/**
 * Mocked tests for readKeychainToken() edge cases
 *
 * These tests use Bun's mock.module to mock execSync and test
 * keychain parsing logic without actual macOS Keychain access.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Mock child_process before importing the module under test
const mockExecSync = mock(() => "");

mock.module("node:child_process", () => ({
  execSync: mockExecSync,
}));

// Import after mocking
const { readKeychainToken } = await import(
  "../../src/claude-agent-sdk/model-provider"
);

describe("readKeychainToken (mocked)", () => {
  // Store original platform
  const originalPlatform = process.platform;

  beforeEach(() => {
    mockExecSync.mockClear();
  });

  afterEach(() => {
    // Restore platform
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
    });
  });

  describe("on macOS (darwin)", () => {
    beforeEach(() => {
      // Mock platform as darwin
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
      });
    });

    it("should parse valid keychain JSON and extract accessToken", () => {
      const validCredentials = JSON.stringify({
        claudeAiOauth: {
          accessToken: "sk-ant-oat01-test-token-12345",
          refreshToken: "sk-ant-ort01-refresh",
          expiresAt: 1_768_878_802_300,
          scopes: ["user:inference", "user:profile"],
          subscriptionType: "max",
        },
      });

      mockExecSync.mockImplementation(() => validCredentials);

      const result = readKeychainToken();

      expect(result).toBe("sk-ant-oat01-test-token-12345");
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    it("should return null when keychain password not found", () => {
      const error = new Error(
        "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain."
      );
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      const result = readKeychainToken();

      expect(result).toBeNull();
    });

    it("should return null when keychain is locked", () => {
      const error = new Error(
        "security: SecKeychainSearchCopyNext: User interaction is not allowed."
      );
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      // Capture console.error - using mock with explicit return
      const consoleSpy = mock((_msg: string) => {
        /* noop - intentionally empty spy */
      });
      const originalConsoleError = console.error;
      console.error = consoleSpy;

      const result = readKeychainToken();

      // Restore console.error
      console.error = originalConsoleError;

      expect(result).toBeNull();
      // Should log generic error for non-"not found" errors
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to access macOS Keychain. Ensure Claude Code is installed and you are logged in."
      );
    });

    it("should return null when JSON parsing fails", () => {
      mockExecSync.mockImplementation(() => "not-valid-json{{{");

      // Capture console.error - using mock with explicit return
      const consoleSpy = mock((_msg: string) => {
        /* noop - intentionally empty spy */
      });
      const originalConsoleError = console.error;
      console.error = consoleSpy;

      const result = readKeychainToken();

      // Restore console.error
      console.error = originalConsoleError;

      expect(result).toBeNull();
      // JSON parse error should trigger the generic error message
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to access macOS Keychain. Ensure Claude Code is installed and you are logged in."
      );
    });

    it("should return null when accessToken is missing from credentials", () => {
      const credentialsWithoutToken = JSON.stringify({
        claudeAiOauth: {
          refreshToken: "sk-ant-ort01-refresh",
          expiresAt: 1_768_878_802_300,
          // Note: accessToken is missing
        },
      });

      mockExecSync.mockImplementation(() => credentialsWithoutToken);

      const result = readKeychainToken();

      expect(result).toBeNull();
    });

    it("should return null when claudeAiOauth object is missing", () => {
      const credentialsWithoutOauth = JSON.stringify({
        someOtherKey: "value",
      });

      mockExecSync.mockImplementation(() => credentialsWithoutOauth);

      const result = readKeychainToken();

      expect(result).toBeNull();
    });

    it("should return null when keychain returns empty string", () => {
      mockExecSync.mockImplementation(() => "");

      const result = readKeychainToken();

      expect(result).toBeNull();
    });

    it("should return null when keychain returns whitespace only", () => {
      mockExecSync.mockImplementation(() => "   \n\t  ");

      const result = readKeychainToken();

      expect(result).toBeNull();
    });
  });

  describe("on non-macOS platforms", () => {
    it("should return null on Linux without calling execSync", () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      const result = readKeychainToken();

      expect(result).toBeNull();
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it("should return null on Windows without calling execSync", () => {
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      const result = readKeychainToken();

      expect(result).toBeNull();
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });
});
