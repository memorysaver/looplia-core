/**
 * Scrolling activity log showing agent actions
 */

import { Box, Static, Text } from "ink";
import type React from "react";
import { type Activity, ActivityItem } from "./activity-item";

type Props = {
  activities: Activity[];
  maxVisible?: number;
};

export const ActivityLog: React.FC<Props> = ({
  activities,
  maxVisible = 8,
}) => {
  // Show most recent activities
  const visibleActivities = activities.slice(-maxVisible);
  const hiddenCount = Math.max(0, activities.length - maxVisible);

  // Separate completed from in-progress activities
  const completedActivities = visibleActivities.filter(
    (a) => a.status === "complete" || a.status === "error"
  );
  const activeActivities = visibleActivities.filter(
    (a) => a.status === "running" || a.status === "pending"
  );

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="white">
        Activity:
      </Text>

      {hiddenCount > 0 && (
        <Text color="gray" dimColor>
          ... {hiddenCount} more items above
        </Text>
      )}

      {/* Completed activities (static - won't re-render) */}
      <Static items={completedActivities}>
        {(activity) => <ActivityItem activity={activity} key={activity.id} />}
      </Static>

      {/* In-progress activities */}
      {activeActivities.map((activity) => (
        <ActivityItem activity={activity} key={activity.id} />
      ))}
    </Box>
  );
};
