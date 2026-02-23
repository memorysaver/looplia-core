/**
 * CLI Constants
 *
 * Centralized constants for command prefixes and other CLI configuration.
 */

/**
 * Prompt prefixes for looplia CLI commands (natural-language prompts)
 * v0.6.5: Used a looplia: prefix on slash commands to avoid conflict with built-in commands
 * v0.8.1: Switched from /looplia:* slash commands to natural-language prompts (SDK does not recognize /looplia:* commands)
 */
export const COMMANDS = {
  BUILD: "Create a looplia workflow from the following description:",
  RUN: "Execute the workflow:",
} as const;
