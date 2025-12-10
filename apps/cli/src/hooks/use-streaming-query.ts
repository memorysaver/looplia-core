/**
 * Hook for consuming streaming query events
 *
 * Specialized hook for WritingKitProvider with typed inputs.
 * Uses shared streaming-state utilities for event handling.
 */

import type { ContentItem, UserProfile, WritingKit } from "@looplia-core/core";
import type { WritingKitProvider } from "@looplia-core/provider/claude-agent-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Activity } from "../components/activity-item";
import {
  createInitialState,
  type EventHandlerContext,
  generateActivityId,
  processStreamingGenerator,
  type StreamingState,
} from "../utils/streaming-state";

/**
 * Hook to consume streaming events from a WritingKitProvider
 *
 * @param provider - WritingKitProvider with buildKitStreaming method
 * @param content - Content item to process
 * @param user - User profile for preferences
 * @returns StreamingState with progress, activities, and final result
 */
export function useStreamingQuery(
  provider: WritingKitProvider,
  content: ContentItem,
  user: UserProfile
): StreamingState<WritingKit> {
  const [state, setState] = useState<StreamingState<WritingKit>>(
    createInitialState<WritingKit>
  );
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

    const applyUpdate = (update: Partial<StreamingState<WritingKit>>) => {
      setState((prev) => ({ ...prev, ...update }));
    };

    async function runQuery() {
      setState((prev) => ({ ...prev, status: "running" }));

      try {
        await processStreamingGenerator({
          stream: provider.buildKitStreaming(content, user),
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
  }, [provider, content, user, addActivity, updateActivity]);

  return state;
}
