import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * QueryLogger - One query = One log file
 *
 * Creates a unique log file per SDK query using timestamp.
 * Log files are stored in contentItem/{contentId}/logs/
 * Never overwrites existing logs.
 */
export type QueryLogger = {
  /**
   * Initialize a new log file for this query
   * @param contentId - Content ID from prompt (for folder location)
   * @returns Log file path
   */
  init(contentId: string): string;

  /**
   * Log a message from SDK
   * @param message - SDK message object
   */
  log(message: Record<string, unknown>): void;

  /**
   * Close the logger (no-op, but included for interface completeness)
   */
  close(): void;

  /**
   * Get the current log file path
   */
  getLogPath(): string | null;
};

/**
 * Generate a unique log filename with timestamp
 */
function generateLogFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `query-${timestamp}.log`;
}

/**
 * Create a QueryLogger instance for a workspace
 *
 * @param workspace - Base workspace path (e.g., ~/.looplia)
 * @returns QueryLogger instance
 *
 * @example
 * ```typescript
 * const logger = createQueryLogger("~/.looplia");
 * const logPath = logger.init("my-content-id");
 * logger.log({ type: "prompt", content: "..." });
 * logger.log({ type: "result", ... });
 * logger.close();
 * ```
 */
export function createQueryLogger(workspace: string): QueryLogger {
  let logPath: string | null = null;

  return {
    init(contentId: string): string {
      // Create logs directory if it doesn't exist
      const logsDir = join(workspace, "contentItem", contentId, "logs");
      mkdirSync(logsDir, { recursive: true });

      // Generate unique filename
      const filename = generateLogFilename();
      logPath = join(logsDir, filename);

      // Write header
      const timestamp = new Date().toISOString();
      writeFileSync(
        logPath,
        `Agent SDK Execution Log - ${timestamp}\n${"=".repeat(60)}\n\n`
      );

      return logPath;
    },

    log(message: Record<string, unknown>): void {
      if (!logPath) {
        return;
      }
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${JSON.stringify(message, null, 2)}\n\n`;
      appendFileSync(logPath, logEntry);
    },

    close(): void {
      // No-op - file handles are managed by Node.js
      // Included for interface completeness
    },

    getLogPath(): string | null {
      return logPath;
    },
  };
}
