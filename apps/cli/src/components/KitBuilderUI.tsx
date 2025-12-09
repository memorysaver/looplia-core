/**
 * Main streaming UI component for kit building
 */

import type { ContentItem, UserProfile, WritingKit } from "@looplia-core/core";
import type { WritingKitProvider } from "@looplia-core/provider";
import { Box, render, Text } from "ink";
import type React from "react";
import { useEffect } from "react";
import { useStreamingQuery } from "../hooks/useStreamingQuery.js";
import { ActivityLog } from "./ActivityLog.js";
import { Header } from "./Header.js";
import { ProgressSection } from "./ProgressSection.js";
import { ResultSection } from "./ResultSection.js";
import { UsageStats } from "./UsageStats.js";

type Props = {
  provider: WritingKitProvider;
  content: ContentItem;
  user: UserProfile;
  format: "json" | "markdown";
  onComplete: (result: WritingKit) => void;
  onError: (error: Error) => void;
};

export const KitBuilderUI: React.FC<Props> = ({
  provider,
  content,
  user,
  format,
  onComplete,
  onError,
}) => {
  const {
    status,
    sessionId,
    progress,
    currentStep,
    activities,
    usage,
    result,
    error,
  } = useStreamingQuery(provider, content, user);

  // Handle completion
  useEffect(() => {
    if (status === "complete" && result) {
      onComplete(result);
    }
    if (status === "error" && error) {
      onError(error);
    }
  }, [status, result, error, onComplete, onError]);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Header contentTitle={content.title} sessionId={sessionId} />

      {/* Progress */}
      {status !== "complete" && (
        <ProgressSection
          isRunning={status === "running"}
          percent={progress}
          step={currentStep}
        />
      )}

      {/* Activity Log */}
      <ActivityLog activities={activities} maxVisible={8} />

      {/* Usage Stats */}
      <UsageStats usage={usage} />

      {/* Result */}
      {status === "complete" && result && (
        <ResultSection format={format} result={result} />
      )}

      {/* Error */}
      {status === "error" && error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error.message}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Render the streaming UI and return a promise that resolves when complete
 */
export function renderKitBuilder(
  props: Props
): Promise<{ result?: WritingKit; error?: Error }> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <KitBuilderUI
        {...props}
        onComplete={(result) => {
          // Small delay to let final render complete
          setTimeout(() => {
            unmount();
            resolve({ result });
          }, 100);
        }}
        onError={(error) => {
          setTimeout(() => {
            unmount();
            resolve({ error });
          }, 100);
        }}
      />
    );
  });
}
