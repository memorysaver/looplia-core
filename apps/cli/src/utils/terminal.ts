/**
 * Terminal detection utilities
 */

/**
 * Check if running in an interactive terminal
 *
 * Returns false for:
 * - Piped output (stdout not a TTY)
 * - CI environments
 * - Dumb terminals
 */
export function isInteractive(): boolean {
  // Check if stdout is a TTY
  if (!process.stdout.isTTY) {
    return false;
  }

  // Check for CI environments
  if (process.env.CI === "true" || process.env.CI === "1") {
    return false;
  }

  // Check for common non-interactive indicators
  if (process.env.TERM === "dumb") {
    return false;
  }

  return true;
}

/**
 * Get terminal dimensions
 */
export function getTerminalSize(): { columns: number; rows: number } {
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

/**
 * Check if colors are supported
 */
export function supportsColor(): boolean {
  // Force colors off
  if (process.env.NO_COLOR === "1" || process.env.NO_COLOR === "true") {
    return false;
  }

  // Force colors on
  if (process.env.FORCE_COLOR === "1" || process.env.FORCE_COLOR === "true") {
    return true;
  }

  // TTY with TERM that isn't dumb
  return process.stdout.isTTY && process.env.TERM !== "dumb";
}
