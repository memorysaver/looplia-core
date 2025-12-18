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
 * Display configurations for commands
 *
 * Note: Workflow titles are derived from workflow definitions,
 * not from this config. This is used for legacy commands only.
 */
export const DISPLAY_CONFIGS: Record<string, DisplayConfig> = {
  workflow: {
    title: "Workflow Executor",
    successMessage: "Workflow complete",
    sessionInfoFormat: "~/.looplia/sandbox/{contentId}/",
    nextStep: null,
  },
  kit: {
    title: "Writing Kit Builder",
    successMessage: "Writing kit complete",
    sessionInfoFormat:
      "~/.looplia/sandbox/{contentId}/outputs/writing-kit.json",
    nextStep: null,
  },
  summarize: {
    title: "Content Summarizer",
    successMessage: "Summary complete",
    sessionInfoFormat: "~/.looplia/sandbox/{contentId}/outputs/summary.json",
    nextStep: null,
  },
};

/**
 * Get display configuration for a command
 *
 * Note: For workflows, the title is overridden by the workflow definition name.
 * This provides a fallback for legacy command execution.
 */
export function getDisplayConfig(commandName: string): DisplayConfig {
  return (
    DISPLAY_CONFIGS[commandName] ?? {
      title: commandName,
      successMessage: "Complete",
      sessionInfoFormat: "~/.looplia/sandbox/{contentId}/",
      nextStep: null,
    }
  );
}
