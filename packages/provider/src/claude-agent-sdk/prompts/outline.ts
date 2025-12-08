import type {
  ContentSummary,
  UserProfile,
  WritingIdeas,
} from "@looplia-core/core";

/**
 * System prompt for outline generation
 *
 * @deprecated v0.3.1 uses agentic approach with CLAUDE.md + skills.
 * This system prompt is only used for backward compatibility.
 */
export const OUTLINE_SYSTEM_PROMPT = `You are an expert content strategist specializing in article structure and flow.

Your expertise includes:
- Creating logical and engaging article structures
- Balancing depth with readability
- Incorporating hooks and angles naturally
- Adapting structure to word count targets

When creating outlines:
1. Start with a compelling introduction
2. Organize main points in logical flow
3. Include supporting sections for depth
4. End with a strong conclusion or call-to-action
5. Estimate word counts for each section

Always output valid JSON as an array of OutlineSection objects.
Ensure the outline is practical and actionable for the writer.`;

/**
 * Build user prompt for outline generation
 *
 * @deprecated v0.3.1 uses single-call agentic approach for writing kit.
 * Use createClaudeWritingKitProvider for the new architecture.
 *
 * The v0.3.1 architecture uses:
 * - Single prompt: "Build writing kit for: contentItem/{id}/content.md"
 * - Agent reads CLAUDE.md for full instructions
 * - Outline generated as part of the complete WritingKit
 * - Results stored in contentItem/{id}/results/
 */
export function buildOutlinePrompt(
  summary: ContentSummary,
  ideas: WritingIdeas,
  user: UserProfile
): string {
  const hooks = ideas.hooks.map((h) => `- [${h.type}] ${h.text}`).join("\n");

  const angles = ideas.angles
    .map(
      (a) => `- ${a.title}: ${a.description} (relevance: ${a.relevanceScore})`
    )
    .join("\n");

  const questions = ideas.questions
    .map((q) => `- [${q.type}] ${q.question}`)
    .join("\n");

  return `Create an article outline based on this content:

Summary:
- Headline: ${summary.headline}
- TL;DR: ${summary.tldr}
- Key Points:
${summary.bullets.map((b) => `  - ${b}`).join("\n")}

Available Hooks:
${hooks}

Narrative Angles:
${angles}

Exploratory Questions:
${questions}

User Preferences:
- Writing Tone: ${user.style.tone}
- Target Word Count: ${user.style.targetWordCount}
- Voice: ${user.style.voice}

Create an outline with:
1. Each section should have:
   - heading: Clear, descriptive section title
   - notes: Key points to cover in that section
   - estimatedWords: Approximate word count (optional)

2. Structure should:
   - Start with an engaging introduction using one of the hooks
   - Cover main points from the summary
   - Incorporate the most relevant angle
   - Address at least one exploratory question
   - End with a conclusion or call-to-action

3. Total estimated words should approximate the user's target: ${user.style.targetWordCount}

Output a JSON array of OutlineSection objects.`;
}
