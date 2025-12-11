import { afterEach, describe, expect, it } from "bun:test";
import {
  getTerminalSize,
  isInteractive,
  supportsColor,
} from "../../src/utils/terminal";

describe("terminal utilities", () => {
  // Store original values to restore after tests
  const originalStdout = { ...process.stdout };
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("isInteractive", () => {
    it("should return false when stdout is not a TTY", () => {
      // Mock process.stdout.isTTY
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
        configurable: true,
      });

      const result = isInteractive();
      expect(result).toBe(false);

      // Restore
      Object.defineProperty(process.stdout, "isTTY", {
        value: originalStdout.isTTY,
        writable: true,
        configurable: true,
      });
    });

    it("should return false when CI=true", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.CI = "true";

      const result = isInteractive();
      expect(result).toBe(false);

      Object.defineProperty(process.stdout, "isTTY", {
        value: originalStdout.isTTY,
        writable: true,
        configurable: true,
      });
    });

    it("should return false when CI=1", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.CI = "1";

      const result = isInteractive();
      expect(result).toBe(false);

      Object.defineProperty(process.stdout, "isTTY", {
        value: originalStdout.isTTY,
        writable: true,
        configurable: true,
      });
    });

    it("should return false when TERM=dumb", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.CI = undefined;
      process.env.TERM = "dumb";

      const result = isInteractive();
      expect(result).toBe(false);

      Object.defineProperty(process.stdout, "isTTY", {
        value: originalStdout.isTTY,
        writable: true,
        configurable: true,
      });
    });

    it("should return true when all conditions are met", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.CI = undefined;
      process.env.TERM = "xterm-256color";

      const result = isInteractive();
      expect(result).toBe(true);

      Object.defineProperty(process.stdout, "isTTY", {
        value: originalStdout.isTTY,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("getTerminalSize", () => {
    it("should return current terminal dimensions", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 100,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "rows", {
        value: 50,
        writable: true,
        configurable: true,
      });

      const size = getTerminalSize();
      expect(size.columns).toBe(100);
      expect(size.rows).toBe(50);

      // Restore
      Object.defineProperty(process.stdout, "columns", {
        value: originalStdout.columns,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "rows", {
        value: originalStdout.rows,
        writable: true,
        configurable: true,
      });
    });

    it("should return default dimensions when not available", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "rows", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const size = getTerminalSize();
      expect(size.columns).toBe(80);
      expect(size.rows).toBe(24);

      // Restore
      Object.defineProperty(process.stdout, "columns", {
        value: originalStdout.columns,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "rows", {
        value: originalStdout.rows,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("supportsColor", () => {
    it("should return false when NO_COLOR=1", () => {
      process.env.NO_COLOR = "1";

      const result = supportsColor();
      expect(result).toBe(false);
    });

    it("should return false when NO_COLOR=true", () => {
      process.env.NO_COLOR = "true";

      const result = supportsColor();
      expect(result).toBe(false);
    });

    it("should return true when FORCE_COLOR=1", () => {
      process.env.NO_COLOR = undefined;
      process.env.FORCE_COLOR = "1";

      const result = supportsColor();
      expect(result).toBe(true);
    });

    it("should return true when FORCE_COLOR=true", () => {
      process.env.NO_COLOR = undefined;
      process.env.FORCE_COLOR = "true";

      const result = supportsColor();
      expect(result).toBe(true);
    });

    it("should return false when stdout is not TTY", () => {
      process.env.NO_COLOR = undefined;
      process.env.FORCE_COLOR = undefined;
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
        configurable: true,
      });

      const result = supportsColor();
      expect(result).toBe(false);

      Object.defineProperty(process.stdout, "isTTY", {
        value: originalStdout.isTTY,
        writable: true,
        configurable: true,
      });
    });

    it("should return false when TERM=dumb", () => {
      process.env.NO_COLOR = undefined;
      process.env.FORCE_COLOR = undefined;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.TERM = "dumb";

      const result = supportsColor();
      expect(result).toBe(false);

      Object.defineProperty(process.stdout, "isTTY", {
        value: originalStdout.isTTY,
        writable: true,
        configurable: true,
      });
    });

    it("should return true when TTY and TERM is not dumb", () => {
      process.env.NO_COLOR = undefined;
      process.env.FORCE_COLOR = undefined;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.TERM = "xterm-256color";

      const result = supportsColor();
      expect(result).toBe(true);

      Object.defineProperty(process.stdout, "isTTY", {
        value: originalStdout.isTTY,
        writable: true,
        configurable: true,
      });
    });
  });
});
