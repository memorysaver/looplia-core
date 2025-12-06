/**
 * Parse command line arguments into a key-value object
 */
export function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    }
  }

  return result;
}

/**
 * Get a string argument value
 */
export function getArg(
  args: Record<string, string | boolean>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

/**
 * Check if a flag is set
 */
export function hasFlag(
  args: Record<string, string | boolean>,
  ...keys: string[]
): boolean {
  for (const key of keys) {
    if (args[key] !== undefined) {
      return true;
    }
  }
  return false;
}
