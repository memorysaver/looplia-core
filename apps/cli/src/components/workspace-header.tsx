/**
 * Workspace header component
 *
 * Displays the main workspace path and session folder path
 * to guide users where files are stored.
 */

import { Box, Text } from "ink";
import type React from "react";

type Props = {
  /** Main workspace path (e.g., ~/.looplia) */
  workspacePath?: string;
  /** Session folder path (e.g., ~/.looplia/contentItem/abc123) */
  sessionPath?: string;
};

/**
 * Truncate path from the left if too long, keeping the meaningful parts
 */
function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) {
    return path;
  }
  return `...${path.slice(-(maxLen - 3))}`;
}

export const WorkspaceHeader: React.FC<Props> = ({
  workspacePath,
  sessionPath,
}) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box>
      <Text color="gray">Workspace: </Text>
      <Text color="cyan">
        {truncatePath(workspacePath || "~/.looplia", 50)}
      </Text>
    </Box>
    {sessionPath ? (
      <Box>
        <Text color="gray">Session: </Text>
        <Text color="yellow">{truncatePath(sessionPath, 50)}</Text>
      </Box>
    ) : null}
  </Box>
);
