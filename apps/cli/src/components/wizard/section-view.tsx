/**
 * Section View component
 *
 * Renders a single question (1 question per tab).
 */

import { Box, Text } from "ink";
import { QuestionCard } from "./question-card.js";
import type { Question, Section } from "./types.js";

type Props = {
  /** Section to render (contains exactly 1 question) */
  section: Section;
  /** Current answers for this section */
  answers: Record<string, string | string[]>;
  /** Called when an answer changes */
  onAnswerChange: (questionId: string, value: string | string[]) => void;
  /** Called when user confirms answer (advance to next tab) */
  onComplete?: () => void;
  /** Whether this section view is active */
  isActive?: boolean;
};

export function SectionView({
  section,
  answers,
  onAnswerChange,
  onComplete,
  isActive = true,
}: Props) {
  const question = section.questions[0];

  // Handle empty section (e.g., Review section)
  if (!question) {
    return (
      <Box flexDirection="column">
        <Text dimColor>Press Enter to continue...</Text>
      </Box>
    );
  }

  const answer = answers[question.id];
  const currentValue = answer ?? getDefaultValue(question);

  // Save current value (including defaults) before completing section
  const handleComplete = () => {
    // Ensure the current value is saved even if user didn't explicitly change it
    if (answer === undefined && currentValue !== undefined) {
      onAnswerChange(question.id, currentValue);
    }
    onComplete?.();
  };

  return (
    <Box flexDirection="column">
      <QuestionCard
        isActive={isActive}
        onChange={(value) => onAnswerChange(question.id, value)}
        onSubmit={handleComplete}
        question={question}
        value={currentValue}
      />
      <Box marginTop={1}>
        <Text dimColor>
          {question.type === "multi-select"
            ? "[↑/↓] Navigate [Space] Toggle [Enter] Next [Tab] Skip"
            : "[↑/↓] Select [Enter] Next [Tab] Skip"}
        </Text>
      </Box>
    </Box>
  );
}

function getDefaultValue(question: Question): string | string[] {
  if (question.type === "multi-select") {
    // Return inferred options as default
    const inferred = question.options
      ?.filter((o) => o.inferred)
      .map((o) => o.id);
    return inferred || [];
  }
  if (question.type === "single-select") {
    // Return first inferred option or first option
    const inferred = question.options?.find((o) => o.inferred);
    return inferred?.id || question.options?.[0]?.id || "";
  }
  return "";
}
