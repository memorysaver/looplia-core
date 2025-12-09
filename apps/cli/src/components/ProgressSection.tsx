/**
 * Progress section with bar and current step
 */

import React from "react";
import { Box, Text } from "ink";
import { ProgressBar } from "./ProgressBar.js";
import { Spinner } from "./Spinner.js";

type Props = {
  percent: number;
  step: string;
  isRunning: boolean;
};

export const ProgressSection: React.FC<Props> = ({
  percent,
  step,
  isRunning,
}) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text color="gray">Progress: </Text>
        <ProgressBar percent={percent} width={30} />
      </Box>
      <Box>
        {isRunning && (
          <Box marginRight={1}>
            <Spinner color="cyan" />
          </Box>
        )}
        <Text color="white">{step}</Text>
      </Box>
    </Box>
  );
};
