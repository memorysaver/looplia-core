/**
 * Question Card component
 *
 * Renders a single question with appropriate input type.
 */

import { Box, Text } from "ink";
import { MultiSelectInput, SelectInput, TextInput } from "../inputs/index.js";
import type { Question } from "./types.js";

type Props = {
  /** Question to render */
  question: Question;
  /** Current answer value */
  value: string | string[];
  /** Called when answer changes */
  onChange: (value: string | string[]) => void;
  /** Called when user submits (Enter) */
  onSubmit?: () => void;
  /** Whether this question is active/focused */
  isActive?: boolean;
};

export function QuestionCard({
  question,
  value,
  onChange,
  onSubmit,
  isActive = true,
}: Props) {
  const renderInput = () => {
    switch (question.type) {
      case "single-select":
        return (
          <SelectInput
            isActive={isActive}
            onChange={(id) => onChange(id)}
            onSubmit={onSubmit}
            options={question.options || []}
            selected={(value as string) || question.options?.[0]?.id || ""}
          />
        );

      case "multi-select":
        return (
          <MultiSelectInput
            isActive={isActive}
            onChange={(ids) => onChange(ids)}
            onSubmit={onSubmit}
            options={question.options || []}
            selected={(value as string[]) || []}
          />
        );

      case "text":
        return (
          <TextInput
            isActive={isActive}
            onChange={(v) => onChange(v)}
            onSubmit={() => onSubmit?.()}
            value={(value as string) || ""}
          />
        );

      default:
        return <Text color="red">Unknown question type</Text>;
    }
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>{question.text}</Text>
      {question.reason ? (
        <Text dimColor italic>
          {question.reason}
        </Text>
      ) : null}
      <Box marginTop={1}>{renderInput()}</Box>
    </Box>
  );
}
