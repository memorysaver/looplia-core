/**
 * Display Configuration for CLI Commands
 *
 * Clean Architecture: Display concerns belong in CLI layer, not core.
 * This module provides TUI configuration for command rendering.
 */

/**
 * TUI display configuration
 */
export type DisplayConfig = {
  /** Title shown in the main TUI box header */
  title: string;
  /** Success message after completion */
  successMessage: string;
  /** Session info format (placeholder: {contentId}) */
  sessionInfoFormat?: string;
  /** Next step hint (null = no next step) */
  nextStep?: {
    description: string;
    commandTemplate: string;
  } | null;
};

/**
 * Display configurations for each command
 */
export const DISPLAY_CONFIGS: Record<string, DisplayConfig> = {
  kit: {
    title: "Writing Kit Builder",
    successMessage: "Writing kit complete",
    sessionInfoFormat: "~/.looplia/contentItem/{contentId}/writing-kit.json",
    nextStep: null,
  },
};

/**
 * Get display configuration for a command
 */
export function getDisplayConfig(
  commandName: string
): DisplayConfig | undefined {
  return DISPLAY_CONFIGS[commandName];
}
