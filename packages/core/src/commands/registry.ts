/**
 * Command Registry
 *
 * Central registry for all command definitions.
 * Single source of truth for command configuration.
 */

import type { CommandDefinition } from "./types";

/**
 * Registry of all available commands
 */
const commands = new Map<string, CommandDefinition>();

/**
 * Register a command definition
 */
export function registerCommand<T>(definition: CommandDefinition<T>): void {
  if (commands.has(definition.name)) {
    throw new Error(`Command "${definition.name}" is already registered`);
  }
  commands.set(definition.name, definition as CommandDefinition);
}

/**
 * Get a command definition by name
 */
export function getCommand<T = unknown>(
  name: string
): CommandDefinition<T> | undefined {
  return commands.get(name) as CommandDefinition<T> | undefined;
}

/**
 * Get all registered command names
 */
export function getCommandNames(): string[] {
  return Array.from(commands.keys());
}

/**
 * Check if a command is registered
 */
export function hasCommand(name: string): boolean {
  return commands.has(name);
}

/**
 * Clear all registered commands (for testing)
 */
export function clearCommands(): void {
  commands.clear();
}
