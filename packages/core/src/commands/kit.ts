/**
 * Kit Command Definition
 *
 * Builds a complete writing kit from content using pipeline-as-configuration.
 */

import type { WritingKit } from "../domain/writing-kit";
import { WritingKitSchema } from "../validation/schemas";
import type { CommandDefinition, PromptContext } from "./types";

/**
 * Generate the prompt for kit command
 *
 * Uses pipeline-as-configuration approach:
 * 1. Read pipeline definition from pipelines/writing-kit.yaml
 * 2. Check session manifest for completed steps
 * 3. Execute only pending steps via subagents
 * 4. Update session manifest after each step
 */
function buildPrompt(ctx: PromptContext): string {
  return `Task: Build WritingKit for session: contentItem/${ctx.contentId}

## Pipeline: writing-kit
Reference: ~/.looplia/pipelines/writing-kit.yaml

## Session State
Check session.json in contentItem/${ctx.contentId}/ for completed steps.
If missing, create with: { "version": 1, "contentId": "${ctx.contentId}", "pipeline": "writing-kit", "desiredOutput": "writing-kit", "updatedAt": "<ISO timestamp>", "steps": {} }

## Workflow (pipeline-driven)

For each output in the pipeline, check if step is done:
- A step is "done" if session.json has steps[name] = "done" AND artifact file exists

Step 1 (summary): IF not done:
  → Invoke content-analyzer subagent for contentItem/${ctx.contentId}/content.md
  → Wait for completion → summary.json created
  → Update session.json: steps.summary = "done"

Step 2 (ideas): IF not done (requires: summary):
  → Invoke idea-generator subagent for contentItem/${ctx.contentId}/summary.json
  → Wait for completion → ideas.json created
  → Update session.json: steps.ideas = "done"

Step 3 (writing-kit): IF not done (requires: ideas, final: true):
  → Invoke writing-kit-builder subagent for contentItem/${ctx.contentId}/
  → Wait for completion → writing-kit.json created
  → Update session.json: steps["writing-kit"] = "done"

## Return
Read writing-kit.json from contentItem/${ctx.contentId}/ and return as structured output.`;
}

/**
 * Kit command definition
 */
export const kitCommand: CommandDefinition<WritingKit> = {
  name: "kit",
  promptTemplate: buildPrompt,
  outputSchema: WritingKitSchema,
};
