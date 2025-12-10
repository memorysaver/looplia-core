/**
 * Generic streaming query UI component
 *
 * Works with any provider that returns an AsyncGenerator<StreamingEvent>.
 * Shows real-time progress, agent output, tool invocations, and usage stats.
 */

import type { StreamingEvent } from "@looplia-core/provider/claude-agent-sdk";
import { Box, render, Text } from "ink";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInitialState,
  type EventHandlerContext,
  generateActivityId,
  processStreamingGenerator,
  type StreamingState,
} from "../utils/streaming-state";
import type { Activity } from "./activity-item";
import { ActivityLog } from "./activity-log";
import { AgentOutput } from "./agent-output";
import { Header } from "./header";
import { ProgressSection } from "./progress-section";
import { UsageStats } from "./usage-stats";

type StreamingResult<T> = {
  success: boolean;
  data?: T;
  error?: { message: string };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
};

type Props<T> = {
  /** Title for the header */
  title: string;
  /** Optional subtitle (e.g., content title) */
  subtitle?: string;
  /** The streaming generator to consume */
  streamGenerator: () => AsyncGenerator<StreamingEvent, StreamingResult<T>>;
  /** Called when query completes successfully */
  onComplete?: (result: T) => void;
  /** Called when query fails */
  onError?: (error: Error) => void;
  /** Optional result formatter for display */
  formatResult?: (result: T) => string;
};

/**
 * Hook to consume streaming events with simplified state management
 */
function useStreamingState<T>(
  streamGenerator: () => AsyncGenerator<StreamingEvent, StreamingResult<T>>
): StreamingState<T> {
  const [state, setState] = useState<StreamingState<T>>(createInitialState<T>);
  const toolIdMap = useRef(new Map<string, string>());
  const stateRef = useRef(state);

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const addActivity = useCallback((activity: Omit<Activity, "id">) => {
    const id = generateActivityId();
    setState((prev) => ({
      ...prev,
      activities: [...prev.activities, { ...activity, id }],
    }));
    return id;
  }, []);

  const updateActivity = useCallback(
    (activityId: string, updates: Partial<Activity>) => {
      setState((prev) => ({
        ...prev,
        activities: prev.activities.map((a) =>
          a.id === activityId ? { ...a, ...updates } : a
        ),
      }));
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    const context: EventHandlerContext = {
      toolIdMap: toolIdMap.current,
      addActivity,
      updateActivity,
    };

    const applyUpdate = (update: Partial<StreamingState<T>>) => {
      setState((prev) => ({ ...prev, ...update }));
    };

    async function runQuery() {
      setState((prev) => ({ ...prev, status: "running" }));

      try {
        await processStreamingGenerator({
          stream: streamGenerator(),
          context,
          stateRef,
          applyUpdate,
          isMounted: () => mounted,
        });
      } catch (err) {
        if (mounted) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    }

    runQuery();

    return () => {
      mounted = false;
    };
  }, [addActivity, streamGenerator, updateActivity]);

  return state;
}

function StreamingQueryUIInner<T>({
  title,
  subtitle,
  streamGenerator,
  onComplete,
  onError,
  formatResult,
}: Props<T>): React.ReactElement {
  const state = useStreamingState(streamGenerator);

  // Handle completion callbacks
  useEffect(() => {
    if (state.status === "complete" && state.result && onComplete) {
      onComplete(state.result);
    }
    if (state.status === "error" && state.error && onError) {
      onError(state.error);
    }
  }, [state.status, state.result, state.error, onComplete, onError]);

  const showProgress = state.status !== "complete" && state.status !== "error";
  const showAgentOutput =
    (state.agentText || state.agentThinking) && state.status === "running";

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Header contentTitle={subtitle} sessionId={state.sessionId} />

      {/* Progress */}
      {showProgress ? (
        <ProgressSection
          isRunning={state.status === "running"}
          percent={state.progress}
          step={state.currentStep}
        />
      ) : null}

      {/* Agent Output */}
      {showAgentOutput ? (
        <AgentOutput
          maxLines={2}
          text={state.agentText}
          thinking={state.agentThinking}
        />
      ) : null}

      {/* Activity Log */}
      <ActivityLog activities={state.activities} maxVisible={8} />

      {/* Usage Stats */}
      <UsageStats usage={state.usage} />

      {/* Result */}
      {state.status === "complete" && state.result ? (
        <Box flexDirection="column" marginTop={1}>
          <Box marginBottom={1}>
            <Text bold color="green">
              {"\u2713"} {title} Complete
            </Text>
          </Box>
          {formatResult ? <Text>{formatResult(state.result)}</Text> : null}
        </Box>
      ) : null}

      {/* Error */}
      {state.status === "error" && state.error ? (
        <Box marginTop={1}>
          <Text color="red">Error: {state.error.message}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

// Wrapper component to handle generic type
export function StreamingQueryUI<T>(props: Props<T>): React.ReactElement {
  return <StreamingQueryUIInner {...props} />;
}

/**
 * Render the streaming UI and return a promise that resolves when complete
 */
export function renderStreamingQuery<T>(
  props: Omit<Props<T>, "onComplete" | "onError">
): Promise<{ result?: T; error?: Error }> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <StreamingQueryUI
        {...props}
        onComplete={(result) => {
          setTimeout(() => {
            unmount();
            resolve({ result });
          }, 100);
        }}
        onError={(error) => {
          setTimeout(() => {
            unmount();
            resolve({ error });
          }, 100);
        }}
      />
    );
  });
}
