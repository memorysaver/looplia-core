/**
 * Review Panel component
 *
 * Shows summary of answers and live workflow preview.
 */

import { Box, Text, useInput } from "ink";
import React from "react";
import { buildPreview } from "./preview-builder.js";
import type {
  Answers,
  PreviewWorkflow,
  Question,
  QuestionOption,
  Recommendation,
  Section,
} from "./types.js";

/** Regex for template variable replacement */
const SANDBOX_TEMPLATE_REGEX = /\$\{\{\s*sandbox\s*\}\}/;

/**
 * Find option label by id
 */
function findOptionLabel(
  options: QuestionOption[] | undefined,
  id: string
): string {
  return options?.find((o) => o.id === id)?.label || id;
}

/**
 * Format answer value for multi-select
 */
function formatMultiSelectValue(
  answer: string[],
  options: QuestionOption[] | undefined
): string {
  const labels = answer.map((id) => findOptionLabel(options, id)).join(", ");
  return labels || "None selected";
}

/**
 * Format answer value for single-select or text
 */
function formatSingleValue(
  answer: string,
  options: QuestionOption[] | undefined
): string {
  const option = options?.find((o) => o.id === answer);
  return option?.label || answer || "Not answered";
}

/**
 * Format an answer value for display
 */
function formatAnswerValue(
  answer: string | string[] | undefined | null,
  question: Question
): string {
  if (answer === undefined || answer === null) {
    return "Not answered";
  }

  if (Array.isArray(answer)) {
    return formatMultiSelectValue(answer, question.options);
  }

  if (typeof answer === "string") {
    return formatSingleValue(answer, question.options);
  }

  return "Not answered";
}

/**
 * Check if section should be skipped in summary
 */
function shouldSkipSection(section: Section): boolean {
  return section.id === "review" || section.questions.length === 0;
}

type Props = {
  /** All sections */
  sections: Section[];
  /** All answers */
  answers: Answers;
  /** Skill recommendations */
  recommendations: Recommendation[];
  /** Original description */
  description: string;
  /** Agent-generated preview workflow (from workflow-schema-composer) */
  agentPreview?: PreviewWorkflow;
  /** Called when user confirms (Enter) */
  onConfirm: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether this panel is active */
  isActive?: boolean;
};

export function ReviewPanel({
  sections,
  answers,
  recommendations,
  description,
  agentPreview,
  onConfirm,
  onCancel,
  isActive = true,
}: Props) {
  useInput(
    (_input, key) => {
      if (!isActive) {
        return;
      }

      if (key.return) {
        onConfirm();
      } else if (key.escape) {
        onCancel();
      }
    },
    { isActive }
  );

  // Memoize preview workflow to avoid recalculating on every render
  const preview = React.useMemo(
    () => buildPreview(answers, recommendations, description, agentPreview),
    [answers, recommendations, description, agentPreview]
  );

  return (
    <Box flexDirection="column">
      {/* Summary of answers */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold underline>
          Your Answers
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {renderAnswersSummary(sections, answers)}
        </Box>
      </Box>

      {/* Workflow preview */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold underline>
          Workflow Preview
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {renderWorkflowPreview(preview)}
        </Box>
      </Box>

      {/* Controls */}
      <Box marginTop={2}>
        <Text dimColor>[Enter] Generate [Tab] Edit Sections [Esc] Cancel</Text>
      </Box>
    </Box>
  );
}

function renderAnswersSummary(sections: Section[], answers: Answers) {
  const summaryItems: { label: string; value: string }[] = [];

  for (const section of sections) {
    if (shouldSkipSection(section)) {
      continue;
    }

    const sectionAnswers = answers[section.id] || {};

    for (const question of section.questions) {
      const answer = sectionAnswers[question.id];
      summaryItems.push({
        label: section.title,
        value: formatAnswerValue(answer, question),
      });
    }
  }

  if (summaryItems.length === 0) {
    return <Text dimColor>No answers provided.</Text>;
  }

  return (
    <>
      {summaryItems.map((item, i) => (
        <Box key={`${item.label}-${i}`}>
          <Text color="cyan">{item.label}:</Text>
          <Text> {item.value}</Text>
        </Box>
      ))}
    </>
  );
}

function renderWorkflowPreview(preview: PreviewWorkflow) {
  if (preview.steps.length === 0) {
    return <Text dimColor>No workflow steps defined yet.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold color="green">
        {preview.name} ({preview.steps.length} steps)
      </Text>
      <Box flexDirection="column" marginLeft={1} marginTop={1}>
        {preview.steps.map((step, index) => (
          <Box flexDirection="column" key={step.id} marginBottom={1}>
            <Text>
              {index + 1}. <Text bold>{step.id}</Text>
            </Text>
            <Text dimColor>
              {"   "}skill: {step.skill}
            </Text>
            {step.needs.length > 0 && (
              <Text dimColor>
                {"   "}needs: [{step.needs.join(", ")}]
              </Text>
            )}
            <Text dimColor>
              {"   "}output:{" "}
              {step.output.replace(SANDBOX_TEMPLATE_REGEX, "sandbox")}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
