/**
 * Token Stats component
 *
 * Displays token usage and cost in a clean, compact format.
 * Placed below the main box in the TUI.
 */

import { Box, Text } from "ink";
import type React from "react";

type Props = {
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
  /** Whether the query is still running */
  isRunning?: boolean;
};

/**
 * Format number with comma separators
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Format cost in USD
 */
function formatCost(cost: number): string {
  if (cost === 0) {
    return "$0.00";
  }
  if (cost < 0.0001) {
    return "<$0.0001";
  }
  return `$${cost.toFixed(4)}`;
}

export const TokenStats: React.FC<Props> = ({ usage, isRunning = false }) => {
  const { inputTokens, outputTokens, totalCostUsd } = usage;
  const totalTokens = inputTokens + outputTokens;

  return (
    <Box marginTop={1}>
      <Text color="gray">Tokens: </Text>
      <Text color="white">{formatNumber(totalTokens)}</Text>
      <Text color="gray"> (</Text>
      <Text color="green">{formatNumber(inputTokens)}</Text>
      <Text color="gray"> in / </Text>
      <Text color="yellow">{formatNumber(outputTokens)}</Text>
      <Text color="gray"> out)</Text>
      <Text color="gray"> | Cost: </Text>
      <Text color={totalCostUsd > 0 ? "cyan" : "gray"}>
        {formatCost(totalCostUsd)}
      </Text>
      {isRunning ? (
        <Text color="gray" dimColor>
          {" "}
          ...
        </Text>
      ) : null}
    </Box>
  );
};
