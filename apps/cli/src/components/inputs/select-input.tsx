/**
 * Select Input component
 *
 * Single-select with arrow key navigation.
 * Shows selected with ● and unselected with ○
 * Includes "Other" option for custom text input.
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { TextInput } from "./text-input.js";

export type SelectOption = {
  id: string;
  label: string;
  /** Whether this option was AI-inferred */
  inferred?: boolean;
};

const OTHER_OPTION_ID = "__other__";
const OTHER_LABEL = "Something else in mind";

type Props = {
  /** Available options */
  options: SelectOption[];
  /** Currently selected option ID (can be custom text if "Other" was selected) */
  selected: string;
  /** Called when selection changes */
  onChange: (id: string) => void;
  /** Called when Enter is pressed */
  onSubmit?: () => void;
  /** Whether input is focused/active */
  isActive?: boolean;
};

function getOptionColor(isFocused: boolean): string {
  return isFocused ? "cyan" : "white";
}

export function SelectInput({
  options,
  selected,
  onChange,
  onSubmit,
  isActive = true,
}: Props) {
  // Check if current selection is custom (not in options list)
  const isCustomValue = selected && !options.find((o) => o.id === selected);
  const [isCustomMode, setIsCustomMode] = useState(isCustomValue);
  const [customValue, setCustomValue] = useState(isCustomValue ? selected : "");

  // All options including "Something else"
  const allOptions = [...options, { id: OTHER_OPTION_ID, label: OTHER_LABEL }];

  const [focusIndex, setFocusIndex] = useState(() => {
    if (isCustomValue) {
      return allOptions.length - 1; // Focus "Other"
    }
    const idx = options.findIndex((o) => o.id === selected);
    return idx >= 0 ? idx : 0;
  });

  // Sync focus when selected changes externally (not when user navigates with arrows)
  useEffect(() => {
    const isCustom = selected && !options.find((o) => o.id === selected);
    if (isCustom) {
      setFocusIndex(allOptions.length - 1);
      setCustomValue(selected);
    } else {
      const idx = options.findIndex((o) => o.id === selected);
      if (idx >= 0) {
        setFocusIndex(idx);
      }
    }
  }, [selected, options, allOptions.length]);

  const handleUpArrow = () => {
    setFocusIndex((i) => Math.max(0, i - 1));
  };

  const handleDownArrow = () => {
    setFocusIndex((i) => Math.min(allOptions.length - 1, i + 1));
  };

  const handleSelect = (isEnter: boolean) => {
    const focusedOption = allOptions[focusIndex];
    if (focusedOption?.id === OTHER_OPTION_ID) {
      setIsCustomMode(true);
      return;
    }
    if (focusedOption) {
      if (focusedOption.id !== selected) {
        onChange(focusedOption.id);
      }
      if (isEnter) {
        onSubmit?.();
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
      if (key.return || input === " ") {
        handleSelect(key.return);
      }
    },
    { isActive: isActive && !isCustomMode }
  );

  // Render custom text input mode
  if (isCustomMode) {
    return (
      <Box flexDirection="column">
        <Text dimColor>Enter your alternative idea:</Text>
        <TextInput
          isActive={isActive}
          onCancel={() => {
            setIsCustomMode(false);
            setCustomValue("");
          }}
          onChange={setCustomValue}
          onSubmit={() => {
            if (customValue.trim()) {
              onChange(customValue.trim());
              onSubmit?.();
            }
            setIsCustomMode(false);
          }}
          value={customValue}
        />
        <Text dimColor>[Enter] Confirm [Esc] Cancel</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {allOptions.map((opt, i) => {
        const isFocused = i === focusIndex && isActive;
        const isSelected =
          opt.id === selected || (opt.id === OTHER_OPTION_ID && isCustomValue);

        return (
          <Box key={opt.id}>
            <Text bold={isFocused} color={getOptionColor(isFocused)}>
              {isSelected ? "●" : "○"} {opt.label}
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
    </Box>
  );
}
