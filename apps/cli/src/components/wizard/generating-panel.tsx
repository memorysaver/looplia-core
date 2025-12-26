/**
 * Generating Panel Component
 *
 * Displays the tree-based streaming TUI during workflow generation.
 * Wraps StreamingQueryUI for use within the build wizard.
 */

import type { StreamingEvent } from "@looplia-core/core";
import type { BuildResult } from "../../commands/build.js";
import { executeStreamingBatch } from "../../commands/build.js";
import { StreamingQueryUI } from "../streaming-query-ui.js";

type StreamingResult = {
  success: boolean;
  data?: BuildResult;
  error?: { message: string };
};

type Props = {
  /** Name of the workflow being built */
  workflowName: string;
  /** Enriched prompt to execute */
  enrichedPrompt: string;
  /** Workspace path */
  workspace: string;
  /** Called when generation completes successfully */
  onComplete: (result: BuildResult) => void;
  /** Called when generation fails */
  onError: (error: Error) => void;
};

/**
 * GeneratingPanel renders the streaming TUI during workflow generation.
 * Uses the same tree-based display as the `run` command.
 */
export function GeneratingPanel({
  workflowName,
  enrichedPrompt,
  workspace,
  onComplete,
  onError,
}: Props) {
  // Create stream generator that wraps executeStreamingBatch
  const createStreamGenerator = () => {
    const generator = executeStreamingBatch(enrichedPrompt, workspace);

    // Wrap to match expected return type
    return generator as AsyncGenerator<StreamingEvent, StreamingResult>;
  };

  // Handle completion - extract BuildResult from StreamingResult
  const handleComplete = (result: BuildResult) => {
    onComplete(result);
  };

  return (
    <StreamingQueryUI<BuildResult>
      onComplete={handleComplete}
      onError={onError}
      streamGenerator={createStreamGenerator}
      subtitle={`Building: ${workflowName}`}
      title="Workflow Builder"
      workspacePath={workspace}
    />
  );
}
