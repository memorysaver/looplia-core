/**
 * Shared streaming state management utilities
 *
 * Provides reusable event handling for streaming query UIs
 */

import type { StreamingEvent } from "@looplia-core/provider/claude-agent-sdk";
import type { Activity } from "../components/activity-item";

/**
 * Core state for streaming queries
 */
export type StreamingState<T = unknown> = {
  status: "idle" | "running" | "complete" | "error";
  sessionId: string;
  progress: number;
  currentStep: string;
  activities: Activity[];
  agentText: string;
  agentThinking: string;
  commandPrompt: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
  result: T | null;
  error: Error | null;
};

/**
 * Create initial streaming state
 */
export function createInitialState<T>(): StreamingState<T> {
  return {
    status: "idle",
    sessionId: "",
    progress: 0,
    currentStep: "Initializing...",
    activities: [],
    agentText: "",
    agentThinking: "",
    commandPrompt: "",
    usage: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0 },
    result: null,
    error: null,
  };
}

/**
 * Generate a unique activity ID
 */
export function generateActivityId(): string {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Format tool start event for display
 */
export function formatToolLabel(event: {
  tool: string;
  input: { path?: string; skill?: string; pattern?: string };
}): string {
  const { tool, input } = event;

  if (tool === "Read" && input.path) {
    return `Reading ${input.path.split("/").pop()}`;
  }
  if (tool === "Skill" && input.skill) {
    return `Running ${input.skill}`;
  }
  if ((tool === "Glob" || tool === "Grep") && input.pattern) {
    return `Searching: ${input.pattern}`;
  }
  return `Using ${tool}`;
}

/**
 * Context for event handlers
 */
export type EventHandlerContext = {
  toolIdMap: Map<string, string>;
  addActivity: (activity: Omit<Activity, "id">) => string;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
};

/**
 * Process a streaming event and return state updates
 */
export function processStreamingEvent<T>(
  event: StreamingEvent,
  state: StreamingState<T>,
  context: EventHandlerContext
): Partial<StreamingState<T>> | null {
  switch (event.type) {
    case "prompt":
      return handlePrompt(event) as Partial<StreamingState<T>>;

    case "session_start":
      return handleSessionStart(event) as Partial<StreamingState<T>>;

    case "thinking":
      return handleThinking(event) as Partial<StreamingState<T>>;

    case "thinking_delta":
      return handleThinkingDelta(event, state) as Partial<StreamingState<T>>;

    case "text":
      return handleText(event) as Partial<StreamingState<T>>;

    case "text_delta":
      return handleTextDelta(event, state) as Partial<StreamingState<T>>;

    case "tool_start":
      handleToolStart(event, context);
      return null; // Activity added via callback

    case "tool_end":
      handleToolEnd(event, context);
      return null; // Activity update handled via callback

    case "progress":
      return handleProgress(event) as Partial<StreamingState<T>>;

    case "usage":
      return handleUsage(event) as Partial<StreamingState<T>>;

    case "error":
      return handleError(event) as Partial<StreamingState<T>>;

    default:
      return null;
  }
}

function handlePrompt(event: { content: string }): Partial<StreamingState> {
  return { commandPrompt: event.content };
}

function handleSessionStart(event: {
  sessionId: string;
}): Partial<StreamingState> {
  return {
    sessionId: event.sessionId,
    currentStep: "Session started",
    progress: 5,
  };
}

function handleThinking(event: { content: string }): Partial<StreamingState> {
  return { agentThinking: event.content };
}

function handleThinkingDelta<T>(
  event: { thinking: string },
  state: StreamingState<T>
): Partial<StreamingState<T>> {
  return { agentThinking: state.agentThinking + event.thinking };
}

function handleText(event: { content: string }): Partial<StreamingState> {
  return { agentText: event.content };
}

function handleTextDelta<T>(
  event: { text: string },
  state: StreamingState<T>
): Partial<StreamingState<T>> {
  return { agentText: state.agentText + event.text };
}

function handleToolStart(
  event: {
    toolUseId: string;
    tool: string;
    input: { path?: string; skill?: string; pattern?: string };
  },
  context: EventHandlerContext
): null {
  const activityId = context.addActivity({
    status: "running",
    type: event.tool === "Skill" ? "skill" : "read",
    label: formatToolLabel(event),
  });
  context.toolIdMap.set(event.toolUseId, activityId);
  return null; // Activity added via callback
}

function handleToolEnd(
  event: {
    toolUseId: string;
    success: boolean;
    durationMs: number;
    summary?: string;
  },
  context: EventHandlerContext
): void {
  const activityId = context.toolIdMap.get(event.toolUseId);
  if (activityId) {
    context.updateActivity(activityId, {
      status: event.success ? "complete" : "error",
      durationMs: event.durationMs,
      detail: event.summary,
    });
    context.toolIdMap.delete(event.toolUseId);
  }
}

function handleProgress(event: {
  percent: number;
  message: string;
}): Partial<StreamingState> {
  return {
    progress: event.percent,
    currentStep: event.message,
  };
}

function handleUsage(event: {
  inputTokens: number;
  outputTokens: number;
}): Partial<StreamingState> {
  return {
    usage: {
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      totalCostUsd: 0, // Cost is calculated at the end in the complete event
    },
  };
}

function handleError(event: {
  recoverable: boolean;
  message: string;
}): Partial<StreamingState> | null {
  if (!event.recoverable) {
    return {
      status: "error",
      error: new Error(event.message),
    };
  }
  return null;
}

/**
 * Process final result from generator
 */
export function processResult<T>(
  result: {
    success: boolean;
    data?: T;
    error?: { message: string };
    usage?: { inputTokens: number; outputTokens: number; totalCostUsd: number };
  },
  currentUsage: StreamingState<T>["usage"]
): Partial<StreamingState<T>> {
  if (result.success && result.data !== undefined) {
    return {
      status: "complete",
      progress: 100,
      currentStep: "Complete!",
      result: result.data,
      usage: result.usage ?? currentUsage,
    };
  }

  return {
    status: "error",
    error: new Error(result.error?.message ?? "Unknown error occurred"),
    usage: result.usage ?? currentUsage,
  };
}

type StreamingResult<T> = {
  success: boolean;
  data?: T;
  error?: { message: string };
  usage?: { inputTokens: number; outputTokens: number; totalCostUsd: number };
};

/**
 * Options for processStreamingGenerator
 */
export type StreamingGeneratorOptions<T> = {
  stream: AsyncGenerator<StreamingEvent, StreamingResult<T>>;
  context: EventHandlerContext;
  stateRef: { current: StreamingState<T> };
  applyUpdate: (update: Partial<StreamingState<T>>) => void;
  isMounted: () => boolean;
};

/**
 * Process events from a streaming generator
 * Returns state updates via the applyUpdate callback
 */
export async function processStreamingGenerator<T>(
  options: StreamingGeneratorOptions<T>
): Promise<void> {
  const { stream, context, stateRef, applyUpdate, isMounted } = options;
  let iterResult = await stream.next();

  while (!iterResult.done && isMounted()) {
    const stateUpdate = processStreamingEvent(
      iterResult.value,
      stateRef.current,
      context
    );

    if (stateUpdate && isMounted()) {
      applyUpdate(stateUpdate);
    }

    iterResult = await stream.next();
  }

  if (iterResult.done && isMounted()) {
    const resultUpdate = processResult(
      iterResult.value,
      stateRef.current.usage
    );
    applyUpdate(resultUpdate);
  }
}
