/**
 * Token usage and cost display
 */

import React from "react";
import { Box, Text } from "ink";

type Props = {
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
};

export const UsageStats: React.FC<Props> = ({ usage }) => {
  const { inputTokens, outputTokens, totalCostUsd } = usage;

  return (
    <Box marginTop={1}>
      <Text color="gray">
        Tokens: {inputTokens.toLocaleString()} in / {outputTokens.toLocaleString()} out | Cost: ${totalCostUsd.toFixed(4)}
      </Text>
    </Box>
  );
};
