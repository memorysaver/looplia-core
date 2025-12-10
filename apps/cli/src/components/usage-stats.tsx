/**
 * Token usage and cost display
 */

import { Box, Text } from "ink";
import type React from "react";

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
        Tokens: {inputTokens.toLocaleString()} in /{" "}
        {outputTokens.toLocaleString()} out | Cost: $
        {(totalCostUsd || 0).toFixed(4)}
      </Text>
    </Box>
  );
};
