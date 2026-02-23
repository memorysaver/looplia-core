/**
 * CLI Constants
 *
 * Centralized constants for command prefixes and other CLI configuration.
 */

/**
 * Command prefixes for looplia slash commands
 * v0.6.5: Use looplia: prefix to avoid conflict with built-in commands
 * v0.8.1: Changed to natural language prompts - SDK doesn't recognize /looplia:* commands
 */
export const COMMANDS = {
  BUILD: "Create a looplia workflow from the following description:",
  RUN: "Execute the workflow:",
} as const;
