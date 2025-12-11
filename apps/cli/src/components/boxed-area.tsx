/**
 * Boxed Area component
 *
 * Wraps content in a box with customizable title and border style.
 */

import { Box, Text } from "ink";
import type React from "react";

type Props = {
  /** Optional title for the box */
  title?: string;
  /** Box border color */
  borderColor?: string;
  /** Children to render inside the box */
  children: React.ReactNode;
};

/**
 * Box drawing characters
 */
const BOX_CHARS = {
  topLeft: "\u250C", // ┌
  topRight: "\u2510", // ┐
  bottomLeft: "\u2514", // └
  bottomRight: "\u2518", // ┘
  horizontal: "\u2500", // ─
  vertical: "\u2502", // │
};

/**
 * Calculate visible width (accounting for ANSI codes)
 */
function getBoxWidth(): number {
  // Use terminal width or default to 80
  return Math.min(process.stdout.columns || 80, 100) - 2;
}

export const BoxedArea: React.FC<Props> = ({
  title,
  borderColor = "gray",
  children,
}) => {
  const boxWidth = getBoxWidth();
  const innerWidth = boxWidth - 2; // Account for side borders

  // Build top border with optional title
  const titleStr = title ? ` ${title} ` : "";
  const topPadding = Math.max(0, innerWidth - titleStr.length);
  const topBorder = `${BOX_CHARS.topLeft}${titleStr}${BOX_CHARS.horizontal.repeat(topPadding)}${BOX_CHARS.topRight}`;

  // Bottom border
  const bottomBorder = `${BOX_CHARS.bottomLeft}${BOX_CHARS.horizontal.repeat(innerWidth)}${BOX_CHARS.bottomRight}`;

  return (
    <Box flexDirection="column">
      {/* Top border */}
      <Text color={borderColor}>{topBorder}</Text>

      {/* Content with side borders */}
      <Box flexDirection="row">
        <Text color={borderColor}>{BOX_CHARS.vertical}</Text>
        <Box flexDirection="column" paddingX={1} width={innerWidth}>
          {children}
        </Box>
        <Text color={borderColor}>{BOX_CHARS.vertical}</Text>
      </Box>

      {/* Bottom border */}
      <Text color={borderColor}>{bottomBorder}</Text>
    </Box>
  );
};
