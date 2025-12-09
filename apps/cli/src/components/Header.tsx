/**
 * Session header component
 */

import React from "react";
import { Box, Text } from "ink";

type Props = {
  /** Optional title override (defaults to "Looplia") */
  title?: string;
  sessionId?: string;
  contentTitle?: string;
};

export const Header: React.FC<Props> = ({
  title = "Looplia",
  sessionId,
  contentTitle,
}) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>
      {sessionId && (
        <Box>
          <Text color="gray">Session: </Text>
          <Text color="white">{sessionId}</Text>
        </Box>
      )}
      {contentTitle && (
        <Box>
          <Text color="gray">Content: </Text>
          <Text color="white">{contentTitle}</Text>
        </Box>
      )}
    </Box>
  );
};
