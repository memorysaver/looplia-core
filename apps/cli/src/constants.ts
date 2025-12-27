/**
 * CLI Constants
 *
 * Centralized constants for command prefixes and other CLI configuration.
 */

/**
 * Command prefixes for looplia slash commands
 * v0.6.5: Use looplia: prefix to avoid conflict with built-in commands
 */
export const COMMANDS = {
  BUILD: "/looplia:build",
  RUN: "/looplia:run",
} as const;
