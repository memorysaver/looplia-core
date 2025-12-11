/**
 * Generic streaming query UI component
 *
 * Works with any provider that returns an AsyncGenerator<StreamingEvent>.
 * Shows real-time progress, agent output, tool invocations, and usage stats.
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │ Workspace: ~/.looplia                   │
 * │ Session:   ~/.looplia/contentItem/abc   │
 * ├─────────────────────────────────────────┤
 * │ ┌─ Agent ──────────────────────────────┐│
 * │ │ ▶ Agent                              ││
 * │ │   Agent text output...               ││
 * │ │   ├─ ✦ content-analyzer (complete)   ││
 * │ │   └─ ✦ summarizer (running)          ││
 * │ └──────────────────────────────────────┘│
 * │ Tokens: 1,234 (800 in / 434 out) | $0.02│
 * └─────────────────────────────────────────┘
 */

import type { StreamingEvent } from "@looplia-core/provider/claude-agent-sdk";
import { Box, render, Text } from "ink";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialState,
  type EventHandlerContext,
  generateActivityId,
  processStreamingGenerator,
  type StreamingState,
} from "../utils/streaming-state";
import type { Activity } from "./activity-item";
import { type AgentNode, AgentTree } from "./agent-tree";
import { BoxedArea } from "./boxed-area";
import { TokenStats } from "./token-stats";
import { WorkspaceHeader } from "./workspace-header";

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
  /** Workspace path to display */
  workspacePath?: string;
  /** Session path to display */
  sessionPath?: string;
  /** Command prompt to display in top box */
  commandPrompt?: string;
};

/**
 * Map activity status to agent node status
 */
function mapActivityStatus(status: Activity["status"]): AgentNode["status"] {
  if (status === "complete") {
    return "complete";
  }
  if (status === "error") {
    return "error";
  }
  return "running";
}

/**
 * Convert activities to agent tree nodes
 */
function activitiesToNodes(activities: Activity[]): AgentNode[] {
  return activities.map((activity) => ({
    id: activity.id,
    type: activity.type === "skill" ? "skill" : "tool",
    name: activity.label,
    status: mapActivityStatus(activity.status),
    detail: activity.detail,
    durationMs: activity.durationMs,
  }));
}

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
  streamGenerator,
  onComplete,
  onError,
  formatResult,
  workspacePath,
  sessionPath,
  commandPrompt,
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

  const isRunning = state.status === "running";
  const isComplete = state.status === "complete";
  const isError = state.status === "error";

  // Convert activities to tree nodes
  const treeNodes = activitiesToNodes(state.activities);

  // Determine border color based on status
  const borderColor = useMemo(() => {
    if (isError) {
      return "red";
    }
    if (isComplete) {
      return "green";
    }
    return "cyan";
  }, [isError, isComplete]);

  // Check if we should show result section
  const showResult = isComplete && state.result !== undefined;
  const showError = isError && state.error !== undefined;

  return (
    <Box flexDirection="column" padding={1}>
      {/* 1. Workspace Header */}
      <WorkspaceHeader
        sessionPath={sessionPath || state.sessionId}
        workspacePath={workspacePath}
      />

      {/* 2. Command Prompt (from props or state) */}
      {commandPrompt || state.commandPrompt ? (
        <BoxedArea borderColor="gray" title="Command Prompt">
          <Text color="white">{commandPrompt || state.commandPrompt}</Text>
        </BoxedArea>
      ) : null}

      {/* 3. Main Display Area (Boxed) */}
      <BoxedArea borderColor={borderColor} title={title}>
        <AgentTree
          agentText={state.agentText}
          maxTextLines={4}
          nodes={treeNodes}
          thinkingText={state.agentThinking}
        />
      </BoxedArea>

      {/* 4. Token Stats (below the box) */}
      <TokenStats isRunning={isRunning} usage={state.usage} />

      {/* 5. Result formatter (if provided) */}
      {showResult === true && formatResult !== undefined ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>{formatResult(state.result as T)}</Text>
        </Box>
      ) : null}

      {showError ? (
        <Box marginTop={1}>
          <Text color="red">Error: {state.error?.message}</Text>
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
