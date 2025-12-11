/**
 * Post-Completion Display Utility
 *
 * Shared utility for displaying success message, session info, and next step hints
 * after command execution completes.
 *
 * Uses DisplayConfig from core (Clean Architecture).
 */

import type { DisplayConfig } from "@looplia-core/core";

/**
 * Display post-completion information
 *
 * Centralizes the success message, session info, and next step display logic.
 */
export function displayPostCompletion(
  config: DisplayConfig,
  contentId: string | undefined
): void {
  // Use stderr for status messages so stdout can be pure JSON/data
  console.error("");
  console.error(`\x1b[32m✓\x1b[0m ${config.successMessage}`);

  if (contentId) {
    console.error(`  \x1b[90mSession:\x1b[0m ${contentId}`);

    if (config.sessionInfoFormat) {
      const savedTo = config.sessionInfoFormat.replace(
        "{contentId}",
        contentId
      );
      console.error(`  \x1b[90mSaved to:\x1b[0m ${savedTo}`);
    }

    if (config.nextStep) {
      console.error("");
      const command = config.nextStep.commandTemplate.replace(
        "{contentId}",
        contentId
      );
      console.error(`\x1b[36m${config.nextStep.description}\x1b[0m ${command}`);
    }

    console.error("");
  }
}
