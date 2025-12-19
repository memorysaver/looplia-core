/**
 * Workflow Command Definition (v0.6.0)
 *
 * Generic workflow executor using workflow-as-markdown pattern.
 * Replaces the hardcoded kit command.
 *
 * @see docs/DESIGN-0.6.0.md
 */

import { z } from "zod";
import type { CommandDefinition, PromptContext } from "./types";

/**
 * Build the prompt for a workflow execution
 *
 * Uses workflow-as-markdown approach:
 * 1. Parse workflow definition from frontmatter
 * 2. Check validation.json for validated outputs
 * 3. Execute only pending outputs via subagents
 * 4. Validate each output using workflow-validator skill
 * 5. Return final artifact when all validations pass
 */
export function buildWorkflowPrompt(ctx: PromptContext): string {
  if (!(ctx.workflowName && ctx.workflowDefinition)) {
    throw new Error(
      "Workflow context is required (workflowName, workflowDefinition)"
    );
  }

  return `Task: Execute workflow "${ctx.workflowName}" for session: contentItem/${ctx.contentId}

## Workflow Definition

\`\`\`yaml
${ctx.workflowDefinition}
\`\`\`

${ctx.workflowInstructions ? `## Custom Instructions\n\n${ctx.workflowInstructions}\n` : ""}
## Execution Protocol

### Step 1: Read Validation State
Read \`contentItem/${ctx.contentId}/validation.json\` to understand:
- What outputs are required
- Validation criteria for each output
- Which outputs have already passed validation

If validation.json is missing, the workflow hasn't started properly.

### Step 2: Execute Outputs (Dependency Order)

For each output in the workflow (following dependency order):

1. **Check completion**:
   - If artifact exists AND validated=true in validation.json → skip

2. **If incomplete - use Task tool with custom subagent_type**:

   Use the **Task** tool to invoke the agent specified in the workflow definition.
   The subagent_type MUST match the \`agent\` field exactly from the workflow YAML.

   Example for an output with \`agent: content-analyzer\`:
   \`\`\`json
   {
     "name": "Task",
     "input": {
       "subagent_type": "content-analyzer",
       "description": "Generate summary artifact",
       "prompt": "Analyze content at contentItem/${ctx.contentId}/content.md and write summary.json"
     }
   }
   \`\`\`

   The subagent will:
   - Auto-load its configured skills (from .claude/agents/*.md)
   - Write artifact to \`contentItem/${ctx.contentId}/{artifact}\`

3. **After artifact written - use Skill tool for validation**:

   Use the **Skill** tool to invoke workflow-validator:
   \`\`\`json
   {
     "name": "Skill",
     "input": { "skill": "workflow-validator" }
   }
   \`\`\`

   Then follow the skill's instructions to validate the artifact against criteria.

4. **Handle validation result**:
   - If passed: Update validation.json → set \`outputs.{name}.validated = true\`
   - If failed: Review failed checks, retry subagent with specific feedback

### Step 3: Return Final Output

When the output marked \`final: true\` passes validation:
1. Read the final artifact JSON
2. Return it as structured output

## Workspace Structure

- **Content**: \`contentItem/${ctx.contentId}/content.md\`
- **Validation**: \`contentItem/${ctx.contentId}/validation.json\`
- **Artifacts**: \`contentItem/${ctx.contentId}/*.json\`
- **Workflow**: \`workflows/${ctx.workflowName}.md\`
- **Agents**: \`.claude/agents/*.md\`
- **Skills**: \`.claude/skills/*/SKILL.md\`

## Important Rules

- **Validate after each step** - Never skip validation
- **Update validation.json** - Mark outputs validated when passed
- **Follow dependencies** - Complete required outputs before dependent ones
- **Retry on failure** - Give subagent specific feedback on validation failures
- **Return structured JSON** - Final output must match expected schema`;
}

/**
 * Generic workflow command definition
 *
 * Note: The output schema is dynamic based on the workflow.
 * The runtime will provide the appropriate schema.
 */
export const workflowCommand: CommandDefinition<Record<string, unknown>> = {
  name: "workflow",
  promptTemplate: buildWorkflowPrompt,
  // Generic object schema - allows any JSON object structure
  // Must be an object schema (not z.unknown()) to produce valid JSON schema with "type" field
  outputSchema: z.record(z.string(), z.unknown()),
};
