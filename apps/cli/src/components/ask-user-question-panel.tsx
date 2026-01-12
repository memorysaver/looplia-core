/**
 * AskUserQuestion Panel (v0.7.1)
 *
 * Renders questions from SDK's AskUserQuestion tool.
 * Supports single-select and multi-select questions.
 */

import { Box, Text, useInput } from "ink";
import { useCallback, useState } from "react";
import { BoxedArea } from "./boxed-area.js";
import {
  MultiSelectInput,
  type MultiSelectOption,
  SelectInput,
  type SelectOption,
} from "./inputs/index.js";

/**
 * Question from AskUserQuestion tool
 */
export type SDKQuestion = {
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
};

type Props = {
  /** Questions to display */
  questions: SDKQuestion[];
  /** Called when all questions are answered */
  onComplete: (answers: Record<string, string>) => void;
  /** Called when user cancels */
  onCancel: () => void;
};

/**
 * Convert SDK options to SelectInput format
 */
function toSelectOptions(
  options: Array<{ label: string; description: string }>
): SelectOption[] {
  return options.map((opt, i) => ({
    id: String(i),
    label: opt.label,
  }));
}

/**
 * Convert SDK options to MultiSelectInput format
 */
function toMultiSelectOptions(
  options: Array<{ label: string; description: string }>
): MultiSelectOption[] {
  return options.map((opt, i) => ({
    id: String(i),
    label: opt.label,
  }));
}

export function AskUserQuestionPanel({
  questions,
  onComplete,
  onCancel,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Current question state
  const currentQuestion = questions[currentIndex];
  const selectOptions = toSelectOptions(currentQuestion?.options || []);
  const multiSelectOptions = toMultiSelectOptions(
    currentQuestion?.options || []
  );

  // Single-select state
  const [selected, setSelected] = useState<string>(selectOptions[0]?.id || "");

  // Multi-select state
  const [multiSelected, setMultiSelected] = useState<string[]>([]);

  // Handle Esc key for cancel
  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  /**
   * Handle single-select submit
   */
  const handleSingleSubmit = useCallback(() => {
    if (!currentQuestion) {
      return;
    }
    const selectedOption = currentQuestion.options[Number(selected)];
    if (!selectedOption) {
      return;
    }

    const answer = selectedOption.label;
    const newAnswers = { ...answers, [currentQuestion.question]: answer };

    if (currentIndex < questions.length - 1) {
      setAnswers(newAnswers);
      setCurrentIndex(currentIndex + 1);
      // Reset selection for next question
      setSelected("0");
    } else {
      onComplete(newAnswers);
    }
  }, [
    answers,
    currentIndex,
    currentQuestion,
    onComplete,
    questions.length,
    selected,
  ]);

  /**
   * Handle multi-select submit
   */
  const handleMultiSubmit = useCallback(() => {
    if (!currentQuestion) {
      return;
    }
    const selectedLabels = multiSelected
      .map((id) => currentQuestion.options[Number(id)]?.label)
      .filter(Boolean);

    const answer = selectedLabels.join(", ");
    const newAnswers = { ...answers, [currentQuestion.question]: answer };

    if (currentIndex < questions.length - 1) {
      setAnswers(newAnswers);
      setCurrentIndex(currentIndex + 1);
      // Reset selection for next question
      setMultiSelected([]);
    } else {
      onComplete(newAnswers);
    }
  }, [
    answers,
    currentIndex,
    currentQuestion,
    multiSelected,
    onComplete,
    questions.length,
  ]);

  if (!currentQuestion) {
    return null;
  }

  return (
    <BoxedArea borderColor="yellow" title={currentQuestion.header}>
      <Box flexDirection="column">
        <Text bold>{currentQuestion.question}</Text>

        {/* Show option descriptions */}
        <Box flexDirection="column" marginBottom={1} marginTop={1}>
          {currentQuestion.options.map((opt) => (
            <Text dimColor key={opt.label}>
              {opt.label}: {opt.description}
            </Text>
          ))}
        </Box>

        <Box marginTop={1}>
          {currentQuestion.multiSelect ? (
            <MultiSelectInput
              isActive={true}
              onChange={setMultiSelected}
              onSubmit={handleMultiSubmit}
              options={multiSelectOptions}
              selected={multiSelected}
            />
          ) : (
            <SelectInput
              isActive={true}
              onChange={setSelected}
              onSubmit={handleSingleSubmit}
              options={selectOptions}
              selected={selected}
            />
          )}
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            Question {currentIndex + 1} of {questions.length}
            {currentQuestion.multiSelect
              ? " | [Space] Toggle [Enter] Confirm"
              : " | [Enter] Select"}{" "}
            | [Esc] Cancel
          </Text>
        </Box>
      </Box>
    </BoxedArea>
  );
}
