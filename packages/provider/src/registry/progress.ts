/**
 * Progress Indicator (v0.7.0)
 *
 * Simple progress indicator for long-running operations.
 * Uses console output for now, can be upgraded to ora spinner later.
 *
 * @see docs/DESIGN-0.7.0.md
 */

/**
 * Progress indicator interface
 */
export type ProgressIndicator = {
  start: (message: string) => void;
  succeed: (message?: string) => void;
  fail: (message?: string) => void;
  update: (message: string) => void;
  stop: () => void;
};

/**
 * Create a simple console-based progress indicator
 */
export function createProgress(): ProgressIndicator {
  let currentMessage = "";
  let isActive = false;

  return {
    start(message: string) {
      currentMessage = message;
      isActive = true;
      process.stdout.write(`⏳ ${message}...`);
    },

    succeed(message?: string) {
      if (!isActive) {
        return;
      }
      // Clear the line and write success
      process.stdout.write("\r\x1b[K"); // Clear line
      console.log(`✓ ${message ?? currentMessage}`);
      isActive = false;
    },

    fail(message?: string) {
      if (!isActive) {
        return;
      }
      // Clear the line and write failure
      process.stdout.write("\r\x1b[K"); // Clear line
      console.log(`✗ ${message ?? currentMessage}`);
      isActive = false;
    },

    update(message: string) {
      if (!isActive) {
        return;
      }
      currentMessage = message;
      process.stdout.write(`\r\x1b[K⏳ ${message}...`);
    },

    stop() {
      if (!isActive) {
        return;
      }
      process.stdout.write("\r\x1b[K"); // Clear line
      isActive = false;
    },
  };
}

/**
 * Wrap an async operation with progress indicator
 */
export async function withProgress<T>(
  message: string,
  operation: () => Promise<T>,
  options?: {
    successMessage?: string;
    failMessage?: string;
  }
): Promise<T> {
  const progress = createProgress();
  progress.start(message);

  try {
    const result = await operation();
    progress.succeed(options?.successMessage);
    return result;
  } catch (error) {
    progress.fail(
      options?.failMessage ?? `${message} failed: ${String(error)}`
    );
    throw error;
  }
}
