/**
 * Unified Agent Logger
 *
 * Provides structured logging for all agent/streaming operations.
 * Enabled via LOOPLIA_DEBUG=1 environment variable.
 * Logs are written to ~/.looplia/logs/{context}/
 *
 * Contexts:
 * - build: Workflow build operations
 * - run: Workflow run operations
 * - query: Ad-hoc queries
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StreamingEvent } from "@looplia-core/core";

/** Log context types */
export type LogContext = "build" | "run" | "query";

/** Check if debug logging is enabled */
export const isDebugEnabled = () => process.env.LOOPLIA_DEBUG === "1";

/** Get the logs directory path for a context */
const getLogsDir = (context: LogContext) =>
  join(homedir(), ".looplia", "logs", context);

/** Ensure logs directory exists */
function ensureLogsDir(context: LogContext): string {
  const logsDir = getLogsDir(context);
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

/** Generate a session ID for correlating logs */
export function generateSessionId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Get log file path for a session */
function getLogPath(context: LogContext, sessionId: string): string {
  const logsDir = ensureLogsDir(context);
  const date = new Date().toISOString().split("T")[0];
  return join(logsDir, `${context}-${date}-${sessionId}.jsonl`);
}

type LogEntry = {
  timestamp: string;
  sessionId: string;
  event: string;
  data: Record<string, unknown>;
};

/**
 * Agent Logger class for unified logging across all agent operations
 */
export class AgentLogger {
  private readonly context: LogContext;
  private readonly sessionId: string;
  private readonly logPath: string;
  private readonly enabled: boolean;

  constructor(context: LogContext, sessionId?: string) {
    this.context = context;
    this.sessionId = sessionId ?? generateSessionId();
    this.enabled = isDebugEnabled();
    this.logPath = getLogPath(context, this.sessionId);
  }

  /** Get the session ID */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Get the log file path */
  getLogPath(): string {
    return this.logPath;
  }

  /** Write a log entry */
  private write(event: string, data: Record<string, unknown>): void {
    if (!this.enabled) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      event,
      data,
    };

    try {
      appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, "utf-8");
    } catch {
      // Silently fail - don't break the app for logging
    }
  }

  // ============================================
  // Build-specific logging
  // ============================================

  /** Log wizard description submission */
  logDescriptionSubmit(description: string): void {
    this.write("description-submit", {
      description,
      length: description.length,
    });
  }

  /** Log analysis start */
  logAnalysisStart(description: string): void {
    this.write("analysis-start", { description });
  }

  /** Log analysis result */
  logAnalysisResult(result: {
    sections?: unknown[];
    recommendations?: unknown[];
    error?: string;
  }): void {
    this.write("analysis-result", {
      sectionCount: result.sections?.length ?? 0,
      recommendationCount: result.recommendations?.length ?? 0,
      error: result.error,
    });
  }

  /** Log wizard answers */
  logWizardAnswers(answers: Record<string, Record<string, unknown>>): void {
    this.write("wizard-answers", { answers });
  }

  /** Log generation start with enriched prompt */
  logGenerationStart(data: {
    workflowName: string;
    enrichedPrompt: string;
    description: string;
  }): void {
    this.write("generation-start", {
      workflowName: data.workflowName,
      enrichedPromptLength: data.enrichedPrompt.length,
      enrichedPrompt: data.enrichedPrompt,
      description: data.description,
    });
  }

  // ============================================
  // Run-specific logging
  // ============================================

  /** Log workflow run start */
  logRunStart(data: {
    workflowId: string;
    workflowPath: string;
    inputs?: Record<string, string>;
  }): void {
    this.write("run-start", data);
  }

  /** Log step execution start */
  logStepStart(stepId: string, skill: string, mission: string): void {
    this.write("step-start", { stepId, skill, mission });
  }

  /** Log step execution complete */
  logStepComplete(stepId: string, success: boolean, durationMs: number): void {
    this.write("step-complete", { stepId, success, durationMs });
  }

  // ============================================
  // Streaming event logging (universal)
  // ============================================

  /** Log a streaming event from the agent */
  logStreamingEvent(event: StreamingEvent): void {
    // Extract key info based on event type
    const eventData: Record<string, unknown> = { type: event.type };

    switch (event.type) {
      case "session_start":
        eventData.agentSessionId = event.sessionId;
        eventData.model = event.model;
        break;
      case "text":
        eventData.contentLength = event.content.length;
        eventData.content = event.content;
        break;
      case "text_delta":
        eventData.deltaLength = event.text.length;
        break;
      case "thinking":
        eventData.contentLength = event.content.length;
        break;
      case "thinking_delta":
        eventData.deltaLength = event.thinking.length;
        break;
      case "tool_start":
        eventData.toolUseId = event.toolUseId;
        eventData.tool = event.tool;
        eventData.input = event.input;
        break;
      case "tool_end":
        eventData.toolUseId = event.toolUseId;
        eventData.tool = event.tool;
        eventData.success = event.success;
        eventData.durationMs = event.durationMs;
        eventData.summary = event.summary;
        break;
      case "progress":
        eventData.step = event.step;
        eventData.percent = event.percent;
        eventData.message = event.message;
        break;
      case "usage":
        eventData.inputTokens = event.inputTokens;
        eventData.outputTokens = event.outputTokens;
        break;
      case "error":
        eventData.code = event.code;
        eventData.message = event.message;
        eventData.recoverable = event.recoverable;
        break;
      case "complete":
        eventData.subtype = event.subtype;
        eventData.usage = event.usage;
        eventData.metrics = event.metrics;
        break;
      default:
        // Handle any unknown event types
        break;
    }

    this.write("streaming-event", eventData);
  }

  // ============================================
  // Completion logging (universal)
  // ============================================

  /** Log successful completion */
  logComplete(result: Record<string, unknown>): void {
    this.write("complete", { success: true, result });
  }

  /** Log error */
  logError(error: Error | string): void {
    const errorData =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: error };
    this.write("error", { success: false, ...errorData });
  }

  // ============================================
  // Summary logging
  // ============================================

  /** Write a final summary to a separate .summary.json file */
  writeSummary(summary: Record<string, unknown>): void {
    if (!this.enabled) {
      return;
    }

    const summaryPath = this.logPath.replace(".jsonl", ".summary.json");
    try {
      writeFileSync(
        summaryPath,
        JSON.stringify(
          {
            sessionId: this.sessionId,
            context: this.context,
            createdAt: new Date().toISOString(),
            ...summary,
          },
          null,
          2
        ),
        "utf-8"
      );
    } catch {
      // Silently fail
    }
  }
}

/**
 * Create a logger for the build context
 */
export function createBuildLogger(sessionId?: string): AgentLogger {
  return new AgentLogger("build", sessionId);
}

/**
 * Create a logger for the run context
 */
export function createRunLogger(sessionId?: string): AgentLogger {
  return new AgentLogger("run", sessionId);
}

/**
 * Create a logger for the query context
 */
export function createQueryLogger(sessionId?: string): AgentLogger {
  return new AgentLogger("query", sessionId);
}

/**
 * Create a logging wrapper for streaming generators
 * This intercepts all events and logs them while passing through
 */
export function createLoggingStreamWrapper<TResult>(
  logger: AgentLogger,
  stream: AsyncGenerator<StreamingEvent, TResult>
): AsyncGenerator<StreamingEvent, TResult> {
  return (async function* () {
    let result: TResult;

    while (true) {
      const iterResult = await stream.next();

      if (iterResult.done) {
        result = iterResult.value;
        break;
      }

      // Log the event
      logger.logStreamingEvent(iterResult.value);

      // Pass through
      yield iterResult.value;
    }

    // Log completion
    logger.logComplete(result as Record<string, unknown>);

    return result;
  })();
}
