/**
 * Hook for consuming streaming query events
 */

import { useState, useEffect, useCallback } from "react";
import type { ContentItem, UserProfile, WritingKit } from "@looplia-core/core";
import type {
  StreamingEvent,
  WritingKitProvider,
} from "@looplia-core/provider";
import type { Activity } from "../components/ActivityItem.js";

type QueryState = {
  status: "idle" | "running" | "complete" | "error";
  sessionId: string;
  progress: number;
  currentStep: string;
  activities: Activity[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
  result: WritingKit | null;
  error: Error | null;
};

const INITIAL_STATE: QueryState = {
  status: "idle",
  sessionId: "",
  progress: 0,
  currentStep: "Initializing...",
  activities: [],
  usage: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0 },
  result: null,
  error: null,
};

/**
 * Hook to consume streaming events from a WritingKitProvider
 *
 * @param provider - WritingKitProvider with buildKitStreaming method
 * @param content - Content item to process
 * @param user - User profile for preferences
 * @returns QueryState with progress, activities, and final result
 */
export function useStreamingQuery(
  provider: WritingKitProvider,
  content: ContentItem,
  user: UserProfile
): QueryState {
  const [state, setState] = useState<QueryState>(INITIAL_STATE);

  const addActivity = useCallback((activity: Omit<Activity, "id">) => {
    setState((prev) => ({
      ...prev,
      activities: [
        ...prev.activities,
        { ...activity, id: `activity-${prev.activities.length}` },
      ],
    }));
  }, []);

  const updateActivityById = useCallback(
    (toolUseId: string, updates: Partial<Activity>) => {
      setState((prev) => {
        const activities = prev.activities.map((a) =>
          a.id === toolUseId ? { ...a, ...updates } : a
        );
        return { ...prev, activities };
      });
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    const toolIdMap = new Map<string, string>();

    async function runQuery() {
      setState((prev) => ({ ...prev, status: "running" }));

      try {
        const stream = provider.buildKitStreaming(content, user);

        let iterResult = await stream.next();
        while (!iterResult.done && mounted) {
          const event = iterResult.value as StreamingEvent;

          switch (event.type) {
            case "session_start":
              setState((prev) => ({
                ...prev,
                sessionId: event.sessionId,
                currentStep: "Session started",
              }));
              break;

            case "thinking":
              setState((prev) => ({
                ...prev,
                currentStep:
                  event.content.length > 60
                    ? `${event.content.slice(0, 60)}...`
                    : event.content,
              }));
              break;

            case "tool_start": {
              const activityId = `activity-${Date.now()}-${event.toolUseId}`;
              toolIdMap.set(event.toolUseId, activityId);
              addActivity({
                id: activityId,
                status: "running",
                type: event.tool === "Skill" ? "skill" : "read",
                label: formatToolStart(event),
              });
              break;
            }

            case "tool_end": {
              const activityId = toolIdMap.get(event.toolUseId);
              if (activityId) {
                updateActivityById(activityId, {
                  status: event.success ? "complete" : "error",
                  durationMs: event.durationMs,
                  detail: event.summary,
                });
                toolIdMap.delete(event.toolUseId);
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
          if (finalResult.success) {
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
  }, [provider, content, user, addActivity, updateActivityById]);

  return state;
}

function formatToolStart(event: {
  tool: string;
  input: { path?: string; skill?: string };
}): string {
  if (event.tool === "Read" && event.input.path) {
    const filename = event.input.path.split("/").pop();
    return `Reading ${filename}`;
  }
  if (event.tool === "Skill" && event.input.skill) {
    return `Running ${event.input.skill}`;
  }
  return `Using ${event.tool}`;
}
