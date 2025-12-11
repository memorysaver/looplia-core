/**
 * Kit Command Definition
 *
 * Builds a complete writing kit from content.
 */

import type { WritingKit } from "../domain/writing-kit";
import { WritingKitSchema } from "../validation/schemas";
import type { CommandDefinition, PromptContext } from "./types";

/**
 * Generate the prompt for kit command
 */
function buildPrompt(ctx: PromptContext): string {
  return `Task: Build WritingKit for session: contentItem/${ctx.contentId}

## Check Existing Progress
First, check which files already exist in contentItem/${ctx.contentId}/:
- summary.json → If exists, skip content-analyzer
- ideas.json → If exists, skip idea-generator
- writing-kit.json → If exists, return it directly

## Sequential Workflow (invoke only what's needed)

Step 1: IF summary.json missing:
  → Invoke content-analyzer subagent for contentItem/${ctx.contentId}/content.md
  → Wait for completion → summary.json created

Step 2: IF ideas.json missing:
  → Invoke idea-generator subagent for contentItem/${ctx.contentId}/summary.json
  → Wait for completion → ideas.json created

Step 3: IF writing-kit.json missing:
  → Invoke writing-kit-builder subagent for contentItem/${ctx.contentId}/
  → Wait for completion → outline.json + writing-kit.json created

Step 4: Return
  → Read writing-kit.json from contentItem/${ctx.contentId}/
  → Return as structured output`;
}

/**
 * Kit command definition
 */
export const kitCommand: CommandDefinition<WritingKit> = {
  name: "kit",
  displayConfig: {
    title: "Writing Kit Builder",
    successMessage: "Writing kit complete",
    sessionInfoFormat: "~/.looplia/contentItem/{contentId}/writing-kit.json",
    nextStep: null,
  },
  promptTemplate: buildPrompt,
  outputSchema: WritingKitSchema,
};
