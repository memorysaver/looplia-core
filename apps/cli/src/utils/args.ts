function isValueArg(arg: string | undefined): arg is string {
  return arg !== undefined && !arg.startsWith("-");
}

function extractKey(arg: string): string | null {
  if (arg.startsWith("--")) {
    return arg.slice(2);
  }
  if (arg.startsWith("-") && arg.length === 2) {
    return arg.slice(1);
  }
  return null;
}

/**
 * Parse command line arguments into a key-value object
 */
export function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (!arg) {
      i += 1;
      continue;
    }

    const key = extractKey(arg);
    if (!key) {
      i += 1;
      continue;
    }

    const nextArg = args[i + 1];
    if (isValueArg(nextArg)) {
      result[key] = nextArg;
      i += 2;
    } else {
      result[key] = true;
      i += 1;
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
  return;
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
