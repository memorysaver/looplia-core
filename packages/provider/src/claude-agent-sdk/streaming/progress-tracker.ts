/**
 * Progress Tracker
 *
 * Infers pipeline progress from skill invocations and emits progress events.
 */

import type { ProgressEvent, ToolStartEvent } from "./types";

/** Map skill names to pipeline steps */
const SKILL_TO_STEP: Record<string, ProgressEvent["step"]> = {
  "content-analyzer": "analyzing",
  "idea-generator": "generating_ideas",
  "writing-kit-builder": "building_outline",
};

/** Progress percentages for each step */
const STEP_PERCENTAGES: Record<ProgressEvent["step"], number> = {
  initializing: 5,
  analyzing: 25,
  generating_ideas: 50,
  building_outline: 75,
  assembling_kit: 90,
};

/** Human-readable messages for each step */
const STEP_MESSAGES: Record<ProgressEvent["step"], string> = {
  initializing: "Initializing session...",
  analyzing: "Analyzing content...",
  generating_ideas: "Generating writing ideas...",
  building_outline: "Building suggested outline...",
  assembling_kit: "Assembling writing kit...",
};

/**
 * Progress tracker for streaming UI
 */
export class ProgressTracker {
  private currentStep: ProgressEvent["step"] = "initializing";
  private percent = 0;

  /**
   * Handle tool start event and emit progress if applicable
   */
  onToolStart(
    tool: string,
    input: ToolStartEvent["input"]
  ): ProgressEvent | null {
    if (tool !== "Skill" || !input.skill) return null;

    const step = SKILL_TO_STEP[input.skill];
    if (step) {
      this.currentStep = step;
      this.percent = STEP_PERCENTAGES[step];

      return {
        type: "progress",
        step,
        percent: this.percent,
        message: STEP_MESSAGES[step],
        timestamp: Date.now(),
      };
    }
    return null;
  }

  /**
   * Emit final progress event on completion
   */
  onComplete(): ProgressEvent {
    return {
      type: "progress",
      step: "assembling_kit",
      percent: 100,
      message: "Writing kit complete!",
      timestamp: Date.now(),
    };
  }

  /**
   * Get current step
   */
  getCurrentStep(): ProgressEvent["step"] {
    return this.currentStep;
  }

  /**
   * Get current percentage
   */
  getPercent(): number {
    return this.percent;
  }
}
