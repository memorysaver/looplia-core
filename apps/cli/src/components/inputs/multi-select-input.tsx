/**
 * Multi-Select Input component
 *
 * Multi-select with space to toggle.
 * Shows selected with ✓ and unselected with ☐
 * Includes "Other" option for custom text input.
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { TextInput } from "./text-input.js";

export type MultiSelectOption = {
  id: string;
  label: string;
  /** Whether this option was AI-inferred */
  inferred?: boolean;
};

const OTHER_OPTION_ID = "__other__";
const OTHER_LABEL = "Something else in mind";

type Props = {
  /** Available options */
  options: MultiSelectOption[];
  /** Currently selected option IDs (can include custom text values) */
  selected: string[];
  /** Called when selection changes */
  onChange: (ids: string[]) => void;
  /** Called when Enter is pressed */
  onSubmit?: () => void;
  /** Whether input is focused/active */
  isActive?: boolean;
};

function getOptionColor(isFocused: boolean): string {
  return isFocused ? "cyan" : "white";
}

export function MultiSelectInput({
  options,
  selected,
  onChange,
  onSubmit,
  isActive = true,
}: Props) {
  // Find any custom values (values not in options list)
  const customValues = selected.filter((s) => !options.find((o) => o.id === s));
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");

  // All options including "Something else" (exclusive option)
  const allOptions = [...options, { id: OTHER_OPTION_ID, label: OTHER_LABEL }];

  const [focusIndex, setFocusIndex] = useState(0);

  // Reset focus if options change
  useEffect(() => {
    if (focusIndex >= allOptions.length) {
      setFocusIndex(Math.max(0, allOptions.length - 1));
    }
  }, [allOptions.length, focusIndex]);

  const handleUpArrow = () => {
    setFocusIndex((i) => Math.max(0, i - 1));
  };

  const handleDownArrow = () => {
    setFocusIndex((i) => Math.min(allOptions.length - 1, i + 1));
  };

  const handleSpace = () => {
    const focusedOption = allOptions[focusIndex];
    if (focusedOption?.id === OTHER_OPTION_ID) {
      setIsCustomMode(true);
      return;
    }
    if (focusedOption) {
      const id = focusedOption.id;
      if (selected.includes(id)) {
        onChange(selected.filter((s) => s !== id));
      } else {
        onChange([...selected, id]);
      }
    }
  };

  useInput(
    (input, key) => {
      if (!isActive || isCustomMode) {
        return;
      }

      if (key.upArrow) {
        handleUpArrow();
        return;
      }
      if (key.downArrow) {
        handleDownArrow();
        return;
      }
      if (input === " ") {
        handleSpace();
        return;
      }
      if (key.return) {
        onSubmit?.();
      }
    },
    { isActive: isActive && !isCustomMode }
  );

  // Render custom text input mode
  if (isCustomMode) {
    return (
      <Box flexDirection="column">
        <Text dimColor>
          Enter your alternative idea (replaces other selections):
        </Text>
        <TextInput
          isActive={isActive}
          onCancel={() => {
            setIsCustomMode(false);
            setCustomValue("");
          }}
          onChange={setCustomValue}
          onSubmit={() => {
            if (customValue.trim()) {
              // Custom value is exclusive - replace all selections
              onChange([customValue.trim()]);
            }
            setIsCustomMode(false);
            setCustomValue("");
          }}
          value={customValue}
        />
        <Text dimColor>[Enter] Add [Esc] Cancel</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {allOptions.map((opt, i) => {
        const isFocused = i === focusIndex && isActive;
        const isSelected = selected.includes(opt.id);
        const isOtherWithCustom =
          opt.id === OTHER_OPTION_ID && customValues.length > 0;

        return (
          <Box key={opt.id}>
            <Text bold={isFocused} color={getOptionColor(isFocused)}>
              {isSelected || isOtherWithCustom ? "✓" : "☐"} {opt.label}
            </Text>
            {opt.inferred ? (
              <Text color="yellow" dimColor>
                {" "}
                (inferred)
              </Text>
            ) : null}
          </Box>
        );
      })}
      {/* Show custom values */}
      {customValues.length > 0 ? (
        <Box marginTop={1}>
          <Text dimColor>Custom: {customValues.join(", ")}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
