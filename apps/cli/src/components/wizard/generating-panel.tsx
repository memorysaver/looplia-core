/**
 * Generating Panel Component (v0.7.1)
 *
 * Displays the tree-based streaming TUI during workflow generation.
 * Wraps StreamingQueryUI for use within the build wizard.
 * Supports AskUserQuestion tool for interactive clarification.
 */

import type { StreamingEvent } from "@looplia-core/core";
import { useCallback, useState } from "react";
import type { BuildResult } from "../../commands/build.js";
import { executeInteractiveStreamingBatch } from "../../commands/build.js";
import type { AgentLogger } from "../../utils/agent-logger.js";
import { AskUserQuestionPanel } from "../ask-user-question-panel.js";
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
 * State for pending AskUserQuestion
 */
type PendingQuestion = {
  questions: SDKQuestion[];
  resolve: (answers: Record<string, string>) => void;
  reject: (error: Error) => void;
};

/**
 * SDK Question type matching AskUserQuestion tool
 */
type SDKQuestion = {
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
};

/**
 * GeneratingPanel renders the streaming TUI during workflow generation.
 * Uses the same tree-based display as the `run` command.
 * Supports AskUserQuestion tool for interactive clarification (v0.7.1).
 */
export function GeneratingPanel({
  workflowName,
  enrichedPrompt,
  workspace,
  onComplete,
  onError,
  logger,
}: Props) {
  // State for AskUserQuestion handling
  const [pendingQuestion, setPendingQuestion] =
    useState<PendingQuestion | null>(null);

  /**
   * Question callback passed to the interactive executor.
   * Returns a Promise that resolves when user answers the questions.
   */
  const questionCallback = useCallback(
    async (questions: SDKQuestion[]): Promise<Record<string, string>> =>
      new Promise((resolve, reject) => {
        setPendingQuestion({ questions, resolve, reject });
      }),
    []
  );

  // Create stream generator that wraps executeInteractiveStreamingBatch
  const createStreamGenerator = useCallback(() => {
    const generator = executeInteractiveStreamingBatch(
      enrichedPrompt,
      workspace,
      questionCallback
    );

    // Wrap with logging if logger provided
    const wrappedGenerator = createLoggingWrapper(
      generator as AsyncGenerator<StreamingEvent, StreamingResult>,
      logger
    );

    return wrappedGenerator;
  }, [enrichedPrompt, workspace, questionCallback, logger]);

  // Handle completion - extract BuildResult from StreamingResult
  const handleComplete = useCallback(
    (result: BuildResult) => {
      logger?.logComplete(result as unknown as Record<string, unknown>);
      onComplete(result);
    },
    [logger, onComplete]
  );

  // Handle error
  const handleError = useCallback(
    (error: Error) => {
      logger?.logError(error);
      onError(error);
    },
    [logger, onError]
  );

  /**
   * Handle user completing the questions
   */
  const handleQuestionComplete = useCallback(
    (answers: Record<string, string>) => {
      if (pendingQuestion) {
        pendingQuestion.resolve(answers);
        setPendingQuestion(null);
      }
    },
    [pendingQuestion]
  );

  /**
   * Handle user canceling the questions
   */
  const handleQuestionCancel = useCallback(() => {
    if (pendingQuestion) {
      pendingQuestion.reject(new Error("User cancelled"));
      setPendingQuestion(null);
    }
  }, [pendingQuestion]);

  // Show question panel when AskUserQuestion is invoked
  if (pendingQuestion) {
    return (
      <AskUserQuestionPanel
        onCancel={handleQuestionCancel}
        onComplete={handleQuestionComplete}
        questions={pendingQuestion.questions}
      />
    );
  }

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
