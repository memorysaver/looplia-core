/**
 * Generic streaming query UI component
 *
 * Works with any provider that returns an AsyncGenerator<StreamingEvent>.
 * Shows real-time progress, agent output, tool invocations, and usage stats.
 */

import type { StreamingEvent } from "@looplia-core/provider";
import { Box, render, Text } from "ink";
import React, { useCallback, useEffect, useState } from "react";
import type { Activity } from "./ActivityItem.js";
import { ActivityLog } from "./ActivityLog.js";
import { AgentOutput } from "./AgentOutput.js";
import { Header } from "./Header.js";
import { ProgressSection } from "./ProgressSection.js";
import { UsageStats } from "./UsageStats.js";

type QueryState<T> = {
  status: "idle" | "running" | "complete" | "error";
  sessionId: string;
  progress: number;
  currentStep: string;
  activities: Activity[];
  agentText: string;
  agentThinking: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
  result: T | null;
  error: Error | null;
};

type Props<T> = {
  /** Title for the header */
  title: string;
  /** Optional subtitle (e.g., content title) */
  subtitle?: string;
  /** The streaming generator to consume */
  streamGenerator: () => AsyncGenerator<
    StreamingEvent,
    {
      success: boolean;
      data?: T;
      error?: { message: string };
      usage?: {
        inputTokens: number;
        outputTokens: number;
        totalCostUsd: number;
      };
    }
  >;
  /** Called when query completes successfully */
  onComplete?: (result: T) => void;
  /** Called when query fails */
  onError?: (error: Error) => void;
  /** Optional result formatter for display */
  formatResult?: (result: T) => string;
};

function formatToolStart(event: {
  tool: string;
  input: { path?: string; skill?: string; pattern?: string };
}): string {
  if (event.tool === "Read" && event.input.path) {
    const filename = event.input.path.split("/").pop();
    return `Reading ${filename}`;
  }
  if (event.tool === "Skill" && event.input.skill) {
    return `Running ${event.input.skill}`;
  }
  if ((event.tool === "Glob" || event.tool === "Grep") && event.input.pattern) {
    return `Searching: ${event.input.pattern}`;
  }
  return `Using ${event.tool}`;
}

function StreamingQueryUIInner<T>({
  title,
  subtitle,
  streamGenerator,
  onComplete,
  onError,
  formatResult,
}: Props<T>): React.ReactElement {
  const [state, setState] = useState<QueryState<T>>({
    status: "idle",
    sessionId: "",
    progress: 0,
    currentStep: "Initializing...",
    activities: [],
    agentText: "",
    agentThinking: "",
    usage: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0 },
    result: null,
    error: null,
  });

  const toolIdMap = React.useRef(new Map<string, string>());

  const addActivity = useCallback((activity: Omit<Activity, "id">) => {
    const id = `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setState((prev) => ({
      ...prev,
      activities: [...prev.activities, { ...activity, id }],
    }));
    return id;
  }, []);

  const updateActivityById = useCallback(
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

    async function runQuery() {
      setState((prev) => ({ ...prev, status: "running" }));

      try {
        const stream = streamGenerator();

        let iterResult = await stream.next();
        while (!iterResult.done && mounted) {
          const event = iterResult.value;

          switch (event.type) {
            case "session_start":
              setState((prev) => ({
                ...prev,
                sessionId: event.sessionId,
                currentStep: "Session started",
                progress: 5,
              }));
              break;

            case "thinking":
              setState((prev) => ({
                ...prev,
                agentThinking: event.content,
              }));
              break;

            case "thinking_delta":
              setState((prev) => ({
                ...prev,
                agentThinking: prev.agentThinking + event.thinking,
              }));
              break;

            case "text":
              setState((prev) => ({
                ...prev,
                agentText: event.content,
              }));
              break;

            case "text_delta":
              setState((prev) => ({
                ...prev,
                agentText: prev.agentText + event.text,
              }));
              break;

            case "tool_start": {
              const activityId = addActivity({
                status: "running",
                type: event.tool === "Skill" ? "skill" : "read",
                label: formatToolStart(event),
              });
              toolIdMap.current.set(event.toolUseId, activityId);
              break;
            }

            case "tool_end": {
              const activityId = toolIdMap.current.get(event.toolUseId);
              if (activityId) {
                updateActivityById(activityId, {
                  status: event.success ? "complete" : "error",
                  durationMs: event.durationMs,
                  detail: event.summary,
                });
                toolIdMap.current.delete(event.toolUseId);
              }
              break;
            }

            case "progress":
              setState((prev) => ({
                ...prev,
                progress: event.percent,
                currentStep: event.message,
              }));
              break;

            case "error":
              if (!event.recoverable) {
                setState((prev) => ({
                  ...prev,
                  status: "error",
                  error: new Error(event.message),
                }));
              }
              break;
          }

          iterResult = await stream.next();
        }

        // Get the final result from the generator return value
        if (iterResult.done && mounted) {
          const finalResult = iterResult.value;
          if (finalResult.success && finalResult.data) {
            setState((prev) => ({
              ...prev,
              status: "complete",
              progress: 100,
              currentStep: "Complete!",
              result: finalResult.data,
              usage: finalResult.usage ?? prev.usage,
            }));
          } else {
            setState((prev) => ({
              ...prev,
              status: "error",
              error: new Error(
                finalResult.error?.message ?? "Unknown error occurred"
              ),
              usage: finalResult.usage ?? prev.usage,
            }));
          }
        }
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
    // Run only once on mount. Parent component should memoize streamGenerator if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle completion callbacks
  useEffect(() => {
    if (state.status === "complete" && state.result && onComplete) {
      onComplete(state.result);
    }
    if (state.status === "error" && state.error && onError) {
      onError(state.error);
    }
  }, [state.status, state.result, state.error, onComplete, onError]);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Header contentTitle={subtitle} sessionId={state.sessionId} />

      {/* Progress */}
      {state.status !== "complete" && state.status !== "error" && (
        <ProgressSection
          isRunning={state.status === "running"}
          percent={state.progress}
          step={state.currentStep}
        />
      )}

      {/* Agent Output */}
      {(state.agentText || state.agentThinking) &&
        state.status === "running" && (
          <AgentOutput
            maxLines={2}
            text={state.agentText}
            thinking={state.agentThinking}
          />
        )}

      {/* Activity Log */}
      <ActivityLog activities={state.activities} maxVisible={8} />

      {/* Usage Stats */}
      <UsageStats usage={state.usage} />

      {/* Result */}
      {state.status === "complete" && state.result && (
        <Box flexDirection="column" marginTop={1}>
          <Box marginBottom={1}>
            <Text bold color="green">
              {"\u2713"} {title} Complete
            </Text>
          </Box>
          {formatResult && <Text>{formatResult(state.result)}</Text>}
        </Box>
      )}

      {/* Error */}
      {state.status === "error" && state.error && (
        <Box marginTop={1}>
          <Text color="red">Error: {state.error.message}</Text>
        </Box>
      )}
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
