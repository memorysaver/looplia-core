/**
 * Agent output display component
 *
 * Shows text and thinking output from the agent with truncation
 */

import { Box, Text } from "ink";
import type React from "react";

type Props = {
  /** Main agent text output (most recent) */
  text?: string;
  /** Agent thinking/reasoning (most recent) */
  thinking?: string;
  /** Maximum lines to show for each */
  maxLines?: number;
};

export const AgentOutput: React.FC<Props> = ({
  text,
  thinking,
  maxLines = 3,
}) => {
  const truncate = (str: string | undefined, lines: number): string => {
    if (!str) {
      return "";
    }
    const allLines = str.split("\n");
    if (allLines.length <= lines) {
      return str;
    }
    return `${allLines.slice(0, lines).join("\n")}...`;
  };

  if (!(text || thinking)) {
    return null;
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {!!thinking && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" dimColor italic>
            {truncate(thinking, maxLines)}
          </Text>
        </Box>
      )}
      {!!text && (
        <Box flexDirection="column">
          <Text color="white">{truncate(text, maxLines)}</Text>
        </Box>
      )}
    </Box>
  );
};
