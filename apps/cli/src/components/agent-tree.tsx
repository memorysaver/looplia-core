/**
 * Agent Tree component
 *
 * Tree-based display for main agent text and subagent/skill invocations.
 * Shows a hierarchical view of what the agent is doing.
 */

import { Box, Text } from "ink";
import type React from "react";
import { Spinner } from "./spinner";

/**
 * A node in the agent tree
 */
export type AgentNode = {
  id: string;
  type: "agent" | "skill" | "tool";
  name: string;
  status: "running" | "complete" | "error";
  detail?: string;
  durationMs?: number;
  children?: AgentNode[];
};

type Props = {
  /** Current agent text output */
  agentText?: string;
  /** Current thinking text */
  thinkingText?: string;
  /** Tree of agent/skill nodes */
  nodes: AgentNode[];
  /** Maximum lines to show for agent text */
  maxTextLines?: number;
};

/**
 * Tree branch characters
 */
const TREE_CHARS = {
  vertical: "\u2502", // │
  branch: "\u251C", // ├
  lastBranch: "\u2514", // └
  horizontal: "\u2500", // ─
};

/**
 * Get status indicator
 */
function getStatusIndicator(
  status: AgentNode["status"],
  type: AgentNode["type"]
): { icon: string; color: string } {
  if (status === "running") {
    return { icon: "", color: "yellow" }; // Spinner will be used
  }
  if (status === "error") {
    return { icon: "\u2717", color: "red" }; // ✗
  }
  // Complete
  if (type === "skill") {
    return { icon: "\u2713", color: "green" }; // ✓
  }
  if (type === "tool") {
    return { icon: "\u25CF", color: "blue" }; // ●
  }
  return { icon: "\u2713", color: "green" }; // ✓
}

/**
 * Get icon for node type
 */
function getTypeIcon(type: AgentNode["type"]): string {
  switch (type) {
    case "agent":
      return "\u25B6"; // ▶
    case "skill":
      return "\u2726"; // ✦
    case "tool":
      return "\u25CF"; // ●
    default:
      return "\u25CB"; // ○
  }
}

/**
 * Render a single tree node
 */
const TreeNode: React.FC<{
  node: AgentNode;
  prefix: string;
  isLast: boolean;
}> = ({ node, prefix, isLast }) => {
  const { icon, color } = getStatusIndicator(node.status, node.type);
  const typeIcon = getTypeIcon(node.type);
  const branchChar = isLast ? TREE_CHARS.lastBranch : TREE_CHARS.branch;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray">{prefix}</Text>
        <Text color="gray">
          {branchChar}
          {TREE_CHARS.horizontal}
        </Text>
        <Box marginLeft={1} width={2}>
          {node.status === "running" ? (
            <Spinner />
          ) : (
            <Text color={color}>{icon || typeIcon}</Text>
          )}
        </Box>
        <Text color={color}>{node.name}</Text>
        {node.detail ? (
          <Text color="gray" dimColor>
            {" "}
            {node.detail}
          </Text>
        ) : null}
        {node.durationMs !== undefined && node.status === "complete" ? (
          <Text color="gray" dimColor>
            {" "}
            ({node.durationMs}ms)
          </Text>
        ) : null}
      </Box>

      {/* Render children */}
      {node.children?.map((child, idx) => (
        <TreeNode
          isLast={idx === (node.children?.length ?? 0) - 1}
          key={child.id}
          node={child}
          prefix={`${prefix}${isLast ? "  " : `${TREE_CHARS.vertical} `}`}
        />
      ))}
    </Box>
  );
};

/**
 * Truncate text to max lines
 */
function truncateText(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return text;
  }
  return `${lines.slice(0, maxLines).join("\n")}...`;
}

export const AgentTree: React.FC<Props> = ({
  agentText,
  thinkingText,
  nodes,
  maxTextLines = 3,
}) => {
  const hasContent = agentText || thinkingText || nodes.length > 0;

  if (!hasContent) {
    return (
      <Box>
        <Text color="gray" dimColor>
          Waiting for agent...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Main agent root */}
      <Box marginBottom={nodes.length > 0 ? 1 : 0}>
        <Box width={2}>
          <Text color="cyan">{"\u25B6"}</Text>
        </Box>
        <Text bold color="cyan">
          Agent
        </Text>
      </Box>

      {/* Thinking text (if present) */}
      {thinkingText ? (
        <Box marginBottom={1} marginLeft={3}>
          <Text color="gray" italic>
            {truncateText(thinkingText, maxTextLines)}
          </Text>
        </Box>
      ) : null}

      {/* Agent output text */}
      {agentText ? (
        <Box marginBottom={nodes.length > 0 ? 1 : 0} marginLeft={3}>
          <Text>{truncateText(agentText, maxTextLines)}</Text>
        </Box>
      ) : null}

      {/* Tree nodes (skills, tools) */}
      {nodes.map((node, idx) => (
        <TreeNode
          isLast={idx === nodes.length - 1}
          key={node.id}
          node={node}
          prefix="  "
        />
      ))}
    </Box>
  );
};
