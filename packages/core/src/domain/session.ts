/**
 * Session Domain Types
 *
 * Defines the session manifest for tracking pipeline progress.
 * Agent manages this file. TypeScript only provides types.
 */

/**
 * Session Manifest - minimal step tracking
 *
 * Design decisions:
 * - Binary "done" status (no pending/in_progress - agent handles those)
 * - No content hashes (file existence suffices)
 * - No provider-side updates (agent manages state)
 *
 * @see docs/DESIGN-0.5.0.md
 */
export type SessionManifest = {
  /** Manifest format version */
  version: 1;
  /** Content ID / Session ID */
  contentId: string;
  /** Pipeline name (e.g., "writing-kit") */
  pipeline: string;
  /** Desired output artifact name */
  desiredOutput: string;
  /** Last update timestamp (ISO format) */
  updatedAt: string;
  /** Step completion status - only "done" or absent */
  steps: Partial<Record<string, "done">>;
};
