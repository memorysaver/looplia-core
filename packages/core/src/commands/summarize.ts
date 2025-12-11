/**
 * Summarize Command Definition
 *
 * Analyzes content and generates a structured summary.
 */

import type { ContentSummary } from "../domain/summary";
import { ContentSummarySchema } from "../validation/schemas";
import type { CommandDefinition, PromptContext } from "./types";

/**
 * Generate the prompt for summarize command
 */
function buildPrompt(ctx: PromptContext): string {
  return `Task: Analyze and summarize content.

Use the content-analyzer subagent to process: contentItem/${ctx.contentId}/content.md

The subagent will:
1. Read content from contentItem/${ctx.contentId}/content.md
2. Perform deep analysis using skills
3. Write results to contentItem/${ctx.contentId}/summary.json

After the subagent completes, read contentItem/${ctx.contentId}/summary.json and return its contents as the structured output.`;
}

/**
 * Summarize command definition
 */
export const summarizeCommand: CommandDefinition<ContentSummary> = {
  name: "summarize",
  displayConfig: {
    title: "Content Summarizer",
    successMessage: "Summary complete",
    sessionInfoFormat: "~/.looplia/contentItem/{contentId}/summary.json",
    nextStep: {
      description: "Next step:",
      commandTemplate: "looplia kit --session-id {contentId}",
    },
  },
  promptTemplate: buildPrompt,
  outputSchema: ContentSummarySchema,
};
