/**
 * Single activity item in the activity log
 */

import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "./Spinner.js";

export type Activity = {
  id: string;
  status: "pending" | "running" | "complete" | "error";
  type: "read" | "skill" | "thinking" | "write";
  label: string;
  detail?: string;
  durationMs?: number;
};

type Props = {
  activity: Activity;
};

function getStatusIcon(status: Activity["status"]): string {
  switch (status) {
    case "pending":
      return "\u25CB"; // ○
    case "running":
      return "\u25D0"; // ◐
    case "complete":
      return "\u2713"; // ✓
    case "error":
      return "\u2717"; // ✗
  }
}

function getStatusColor(status: Activity["status"]): string {
  switch (status) {
    case "pending":
      return "gray";
    case "running":
      return "yellow";
    case "complete":
      return "green";
    case "error":
      return "red";
  }
}

export const ActivityItem: React.FC<Props> = ({ activity }) => {
  const icon = getStatusIcon(activity.status);
  const color = getStatusColor(activity.status);

  return (
    <Box>
      <Box width={3}>
        {activity.status === "running" ? (
          <Spinner />
        ) : (
          <Text color={color}>{icon}</Text>
        )}
      </Box>
      <Text color={color}>{activity.label}</Text>
      {activity.detail && (
        <Text color="gray" dimColor>
          {" "}
          ({activity.detail})
        </Text>
      )}
      {activity.durationMs !== undefined && activity.status === "complete" && (
        <Text color="gray" dimColor>
          {" "}
          {activity.durationMs}ms
        </Text>
      )}
    </Box>
  );
};
