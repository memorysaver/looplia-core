import type { ContentSummary, WritingKit } from "@looplia-core/core";

/**
 * Format a content summary as markdown
 */
export function formatSummaryAsMarkdown(summary: ContentSummary): string {
  const lines: string[] = [
    `# ${summary.headline}`,
    "",
    "## TL;DR",
    "",
    summary.tldr,
    "",
    "## Key Points",
    "",
    ...summary.bullets.map((bullet) => `- ${bullet}`),
    "",
    "## Metadata",
    "",
    `- **Sentiment:** ${summary.sentiment}`,
    `- **Category:** ${summary.category}`,
    `- **Relevance Score:** ${(summary.score.relevanceToUser * 100).toFixed(0)}%`,
    `- **Tags:** ${summary.tags.join(", ")}`,
  ];

  return lines.join("\n");
}

/**
 * Format a writing kit as markdown
 */
export function formatKitAsMarkdown(kit: WritingKit): string {
  const lines: string[] = [
    `# Writing Kit: ${kit.summary.headline}`,
    "",
    `**Source:** [${kit.source.label}](${kit.source.url})`,
    "",
    "---",
    "",
    "## Summary",
    "",
    "### TL;DR",
    "",
    kit.summary.tldr,
    "",
    "### Key Points",
    "",
    ...kit.summary.bullets.map((bullet) => `- ${bullet}`),
    "",
    "---",
    "",
    "## Writing Ideas",
    "",
    "### Hooks",
    "",
    ...kit.ideas.hooks.map(
      (hook) => `- **[${hook.type}]** ${hook.text}`
    ),
    "",
    "### Angles",
    "",
    ...kit.ideas.angles.map(
      (angle) =>
        `- **${angle.title}** (${(angle.relevanceScore * 100).toFixed(0)}% relevant)\n  ${angle.description}`
    ),
    "",
    "### Questions to Explore",
    "",
    ...kit.ideas.questions.map(
      (q) => `- **[${q.type}]** ${q.question}`
    ),
    "",
    "---",
    "",
    "## Suggested Outline",
    "",
    ...kit.suggestedOutline.map(
      (section) =>
        `### ${section.heading}${section.estimatedWords ? ` (~${section.estimatedWords} words)` : ""}\n\n${section.notes}\n`
    ),
    "---",
    "",
    "## Metadata",
    "",
    `- **Relevance:** ${(kit.meta.relevanceToUser * 100).toFixed(0)}%`,
    `- **Est. Reading Time:** ${kit.meta.estimatedReadingTimeMinutes} min`,
    `- **Tags:** ${kit.summary.tags.join(", ")}`,
  ];

  return lines.join("\n");
}
