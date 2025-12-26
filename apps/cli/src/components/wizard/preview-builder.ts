/**
 * Preview Builder
 *
 * Client-side workflow preview generation based on answers and recommendations.
 * This allows the preview to update instantly without AI calls.
 */

import type { Answers, PreviewWorkflow, Recommendation } from "./types.js";

/** Regex for removing non-alphanumeric chars except spaces */
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9\s]/g;

/** Regex for splitting by whitespace */
const WHITESPACE_SPLIT_REGEX = /\s+/;

/** Regex for template variable replacement */
const SANDBOX_TEMPLATE_REGEX = /\$\{\{\s*sandbox\s*\}\}/;

/**
 * Build a workflow preview from user answers and skill recommendations.
 * If an agent-generated preview is available, filter it based on user selections.
 */
export function buildPreview(
  answers: Answers,
  recommendations: Recommendation[],
  description: string,
  agentPreview?: PreviewWorkflow
): PreviewWorkflow {
  // Get selected goals from answers
  const goalsAnswers = answers.goals || {};
  const selectedGoals = (goalsAnswers["primary-goal"] || []) as string[];

  // If we have agent preview, filter steps based on selected goals
  if (agentPreview) {
    const matchedRecs = recommendations.filter((r) =>
      selectedGoals.includes(r.goalId)
    );
    const matchedStepIds = new Set(matchedRecs.map((r) => r.stepId));

    // If no goals selected, show all steps
    if (matchedStepIds.size === 0) {
      return agentPreview;
    }

    return {
      name: agentPreview.name,
      steps: agentPreview.steps.filter((s) => matchedStepIds.has(s.id)),
    };
  }

  // Fallback to client-side generation (when no agent preview)
  const matchedRecommendations = recommendations.filter((r) =>
    selectedGoals.includes(r.goalId)
  );

  const activeRecommendations =
    matchedRecommendations.length > 0
      ? matchedRecommendations
      : recommendations;

  // Build steps with sequential dependencies
  const steps = activeRecommendations.map((r, i) => {
    const prevStep = i > 0 ? activeRecommendations[i - 1] : null;
    return {
      id: r.stepId,
      skill: r.skill,
      needs: prevStep ? [prevStep.stepId] : [],
      output: `$\{{ sandbox }}/outputs/${r.stepId}.json`,
    };
  });

  // Derive workflow name from description
  const name = deriveWorkflowName(description);

  return { name, steps };
}

/**
 * Derive a workflow name from a description
 */
export function deriveWorkflowName(description: string): string {
  if (!description) {
    return "workflow";
  }

  return (
    description
      .toLowerCase()
      // Remove non-alphanumeric except spaces
      .replace(NON_ALPHANUMERIC_REGEX, "")
      // Split by whitespace
      .split(WHITESPACE_SPLIT_REGEX)
      // Take first 3 words
      .slice(0, 3)
      // Join with hyphens
      .join("-") || "workflow"
  );
}

/**
 * Format a preview workflow for display
 */
export function formatPreviewWorkflow(workflow: PreviewWorkflow): string {
  const lines: string[] = [];

  lines.push(`${workflow.name} (${workflow.steps.length} steps)`);
  lines.push("");

  for (const [index, step] of workflow.steps.entries()) {
    lines.push(`${index + 1}. ${step.id}`);
    lines.push(`   skill: ${step.skill}`);
    if (step.mission) {
      // Truncate mission for display (first line, max 50 chars)
      const shortMission = step.mission.split("\n")[0]?.slice(0, 50) || "";
      lines.push(
        `   mission: ${shortMission}${shortMission.length >= 50 ? "..." : ""}`
      );
    }
    if (step.needs.length > 0) {
      lines.push(`   needs: [${step.needs.join(", ")}]`);
    }
    lines.push(
      `   output: ${step.output.replace(SANDBOX_TEMPLATE_REGEX, "sandbox")}`
    );
    if (index < workflow.steps.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Calculate workflow complexity based on answers
 */
export function calculateComplexity(
  answers: Answers
): "simple" | "standard" | "complex" {
  const goalsAnswers = answers.goals || {};
  const selectedGoals = (goalsAnswers["primary-goal"] || []) as string[];
  const depth = goalsAnswers.depth as string;

  const goalCount = selectedGoals.length;

  if (goalCount <= 1 && depth !== "deep") {
    return "simple";
  }
  if (goalCount >= 3 || depth === "deep") {
    return "complex";
  }
  return "standard";
}
