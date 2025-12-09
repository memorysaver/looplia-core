/**
 * Visual progress bar component
 */

import React from "react";
import { Box, Text } from "ink";

type Props = {
  percent: number;
  width?: number;
  showPercent?: boolean;
};

export const ProgressBar: React.FC<Props> = ({
  percent,
  width = 40,
  showPercent = true,
}) => {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clampedPercent / 100) * width);
  const empty = width - filled;

  const filledBar = "\u2588".repeat(filled);
  const emptyBar = "\u2591".repeat(empty);

  return (
    <Box>
      <Text color="green">{filledBar}</Text>
      <Text color="gray">{emptyBar}</Text>
      {showPercent && <Text color="cyan"> {clampedPercent.toFixed(0)}%</Text>}
    </Box>
  );
};
