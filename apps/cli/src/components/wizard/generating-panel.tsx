/**
 * Generating Panel Component
 *
 * Displays the tree-based streaming TUI during workflow generation.
 * Wraps StreamingQueryUI for use within the build wizard.
 */

import type { StreamingEvent } from "@looplia-core/core";
import type { BuildResult } from "../../commands/build.js";
import { executeStreamingBatch } from "../../commands/build.js";
import type { AgentLogger } from "../../utils/agent-logger.js";
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
  /** Logger for debug logging (optional) */
  logger?: AgentLogger;
};

/**
 * Format the build result for display in the TUI
 */
function formatBuildResult(result: BuildResult): string {
  if (result.status !== "success") {
    return result.error ?? "Build failed";
  }

  const lines: string[] = [];

  if (result.workflowPath) {
    lines.push(`Saved to: ${result.workflowPath}`);
  }

  if (result.workflowName) {
    lines.push(`Run with: looplia run ${result.workflowName}`);
  }

  return lines.join("\n");
}

/**
 * Create a logging wrapper for the stream generator
 * Logs each streaming event while passing them through
 */
function createLoggingWrapper(
  generator: AsyncGenerator<StreamingEvent, StreamingResult>,
  logger?: AgentLogger
): AsyncGenerator<StreamingEvent, StreamingResult> {
  if (!logger) {
    return generator;
  }

  return (async function* () {
    let result: StreamingResult;

    while (true) {
      let iterResult: IteratorResult<StreamingEvent, StreamingResult>;

      try {
        iterResult = await generator.next();
      } catch (error) {
        // Log the error and rethrow
        logger.logError(
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }

      if (iterResult.done) {
        result = iterResult.value;
        break;
      }

      // Log the streaming event
      logger.logStreamingEvent(iterResult.value);

      // Pass through
      yield iterResult.value;
    }

    return result;
  })();
}

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
  logger,
}: Props) {
  // Create stream generator that wraps executeStreamingBatch
  const createStreamGenerator = () => {
    const generator = executeStreamingBatch(enrichedPrompt, workspace);

    // Wrap with logging if logger provided
    const wrappedGenerator = createLoggingWrapper(
      generator as AsyncGenerator<StreamingEvent, StreamingResult>,
      logger
    );

    return wrappedGenerator;
  };

  // Handle completion - extract BuildResult from StreamingResult
  const handleComplete = (result: BuildResult) => {
    logger?.logComplete(result as unknown as Record<string, unknown>);
    onComplete(result);
  };

  // Handle error
  const handleError = (error: Error) => {
    logger?.logError(error);
    onError(error);
  };

  return (
    <StreamingQueryUI<BuildResult>
      formatResult={formatBuildResult}
      onComplete={handleComplete}
      onError={handleError}
      streamGenerator={createStreamGenerator}
      subtitle={`Building: ${workflowName}`}
      title="Workflow Builder"
      workspacePath={workspace}
    />
  );
}
