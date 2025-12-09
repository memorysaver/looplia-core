/**
 * Main streaming UI component for kit building
 */

import React, { useEffect } from "react";
import { Box, Text, render } from "ink";
import type { ContentItem, UserProfile, WritingKit } from "@looplia-core/core";
import type { WritingKitProvider } from "@looplia-core/provider";

import { Header } from "./Header.js";
import { ProgressSection } from "./ProgressSection.js";
import { ActivityLog } from "./ActivityLog.js";
import { UsageStats } from "./UsageStats.js";
import { ResultSection } from "./ResultSection.js";
import { useStreamingQuery } from "../hooks/useStreamingQuery.js";

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
      <Header sessionId={sessionId} contentTitle={content.title} />

      {/* Progress */}
      {status !== "complete" && (
        <ProgressSection
          percent={progress}
          step={currentStep}
          isRunning={status === "running"}
        />
      )}

      {/* Activity Log */}
      <ActivityLog activities={activities} maxVisible={8} />

      {/* Usage Stats */}
      <UsageStats usage={usage} />

      {/* Result */}
      {status === "complete" && result && (
        <ResultSection result={result} format={format} />
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
