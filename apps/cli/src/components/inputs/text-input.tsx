/**
 * Text Input component
 *
 * A reusable text input with cursor, handles typing/backspace/arrows.
 */

import type { Key } from "ink";
import { Box, Text, useInput } from "ink";
import { useState } from "react";

type Props = {
  /** Current input value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Called when Enter is pressed */
  onSubmit: () => void;
  /** Called when Escape is pressed */
  onCancel?: () => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether input is focused/active */
  isActive?: boolean;
};

/**
 * Check if key is a navigation key
 */
function isNavigationKey(key: Key): boolean {
  return key.leftArrow || key.rightArrow;
}

/**
 * Check if input should be ignored (ctrl/meta combinations)
 */
function shouldIgnoreInput(key: Key, input: string): boolean {
  return key.ctrl || key.meta || !input;
}

export function TextInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = "",
  isActive = true,
}: Props) {
  const [cursorPosition, setCursorPosition] = useState(value.length);

  const handleBackspace = () => {
    if (cursorPosition > 0) {
      const newValue =
        value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition - 1);
    }
  };

  const handleCharacterInput = (input: string) => {
    const newValue =
      value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
    onChange(newValue);
    setCursorPosition(cursorPosition + input.length);
  };

  const handleNavigation = (key: Key) => {
    if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
    } else if (key.rightArrow) {
      setCursorPosition(Math.min(value.length, cursorPosition + 1));
    }
  };

  useInput(
    (input, key) => {
      if (!isActive) {
        return;
      }

      if (key.return) {
        onSubmit();
        return;
      }
      if (key.escape) {
        onCancel?.();
        return;
      }
      if (key.backspace || key.delete) {
        handleBackspace();
        return;
      }
      if (isNavigationKey(key)) {
        handleNavigation(key);
        return;
      }
      if (!shouldIgnoreInput(key, input)) {
        handleCharacterInput(input);
      }
    },
    { isActive }
  );

  // Sync cursor position when value changes externally
  if (cursorPosition > value.length) {
    setCursorPosition(value.length);
  }

  const displayValue = value || placeholder;
  const showPlaceholder = !value && Boolean(placeholder);

  // Render text with cursor
  const beforeCursor = displayValue.slice(0, cursorPosition);
  const cursorChar = displayValue[cursorPosition] || " ";
  const afterCursor = displayValue.slice(cursorPosition + 1);

  return (
    <Box>
      <Text dimColor={showPlaceholder}>{beforeCursor}</Text>
      {isActive ? (
        <Text backgroundColor="cyan" color="black">
          {cursorChar}
        </Text>
      ) : (
        <Text dimColor={showPlaceholder}>{cursorChar}</Text>
      )}
      <Text dimColor={showPlaceholder}>{afterCursor}</Text>
    </Box>
  );
}
