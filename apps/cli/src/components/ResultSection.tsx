/**
 * Final result display section
 */

import React from "react";
import { Box, Text } from "ink";
import type { WritingKit } from "@looplia-core/core";

type Props = {
  result: WritingKit;
  format: "json" | "markdown";
};

export const ResultSection: React.FC<Props> = ({ result, format }) => {
  const output =
    format === "json"
      ? JSON.stringify(result, null, 2)
      : formatAsMarkdown(result);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          {"\u2713"} Writing Kit Complete
        </Text>
      </Box>
      <Text>{output}</Text>
    </Box>
  );
};

function formatAsMarkdown(kit: WritingKit): string {
  const lines: string[] = [];

  // Headline
  lines.push(`# ${kit.summary.headline}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push(kit.summary.longSummary);
  lines.push("");

  // Key insights
  if (kit.summary.keyInsights.length > 0) {
    lines.push("## Key Insights");
    for (const insight of kit.summary.keyInsights) {
      lines.push(`- ${insight}`);
    }
    lines.push("");
  }

  // Hooks
  if (kit.ideas.hooks.length > 0) {
    lines.push("## Suggested Hooks");
    for (const hook of kit.ideas.hooks) {
      lines.push(`- ${hook}`);
    }
    lines.push("");
  }

  // Outline
  if (kit.suggestedOutline.length > 0) {
    lines.push("## Suggested Outline");
    for (const section of kit.suggestedOutline) {
      lines.push(`### ${section.heading} (${section.wordCount} words)`);
      lines.push(section.keyPoints.join(", "));
      lines.push("");
    }
  }

  return lines.join("\n");
}
