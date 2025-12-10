/**
 * Final result display section
 */

import type { WritingKit } from "@looplia-core/core";
import { Box, Text } from "ink";
import type React from "react";

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
  lines.push(kit.summary.overview || kit.summary.tldr);
  lines.push("");

  // Key points
  if (kit.summary.bullets.length > 0) {
    lines.push("## Key Points");
    for (const bullet of kit.summary.bullets) {
      lines.push(`- ${bullet}`);
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
      const wordEstimate = section.estimatedWords
        ? ` (${section.estimatedWords} words)`
        : "";
      lines.push(`### ${section.heading}${wordEstimate}`);
      lines.push(section.notes);
      lines.push("");
    }
  }

  return lines.join("\n");
}
