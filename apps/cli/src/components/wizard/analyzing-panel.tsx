/**
 * Analyzing Panel (v0.7.1)
 *
 * Displays streaming progress during workflow description analysis.
 * Shows AgentTree with real-time progress instead of just a spinner.
 * Handles AskUserQuestion tool calls for interactive clarification.
 */

import type { StreamingEvent } from "@looplia-core/provider/claude-agent-sdk";
import { useCallback, useState } from "react";
import {
  AskUserQuestionPanel,
  type SDKQuestion,
} from "../ask-user-question-panel.js";
import { StreamingQueryUI } from "../streaming-query-ui.js";
import { analyzeDescriptionStreaming } from "./skill-analyzer.js";
import type { ClarificationResult } from "./types.js";

type Props = {
  /** User's workflow description */
  description: string;
  /** Workspace path */
  workspace: string;
  /** Called when analysis completes successfully */
  onComplete: (result: ClarificationResult) => void;
  /** Called when analysis fails */
  onError: (error: Error) => void;
};

/**
 * State for pending AskUserQuestion
 */
type PendingQuestion = {
  questions: SDKQuestion[];
  resolve: (answers: Record<string, string>) => void;
  reject: (error: Error) => void;
};

export function AnalyzingPanel({
  description,
  workspace,
  onComplete,
  onError,
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

  /**
   * Create the streaming generator for analysis.
   * Uses the interactive executor which supports AskUserQuestion.
   */
  const createStreamGenerator = useCallback(
    (): AsyncGenerator<
      StreamingEvent,
      {
        success: boolean;
        data?: ClarificationResult;
        error?: { message: string };
      }
    > => analyzeDescriptionStreaming(description, workspace, questionCallback),
    [description, workspace, questionCallback]
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

  // Show streaming progress UI
  return (
    <StreamingQueryUI<ClarificationResult>
      onComplete={onComplete}
      onError={onError}
      streamGenerator={createStreamGenerator}
      subtitle="Scanning skills and generating questions..."
      title="Analyzing Requirements"
      workspacePath={workspace}
    />
  );
}
