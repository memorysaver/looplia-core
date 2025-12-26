/**
 * Skill Analyzer Service
 *
 * Calls skill-capability-matcher via the executor to analyze
 * workflow descriptions and generate dynamic clarification questions.
 */

import { createClaudeAgentExecutor } from "@looplia-core/provider/claude-agent-sdk";
import type { ClarificationResult, Recommendation, Section } from "./types.js";

/** Regex for splitting words in getShortLabel - defined at module level for performance */
const WORD_SPLIT_REGEX = /\s+/;

/** Regex for removing common question words */
const QUESTION_PREFIX_REGEX =
  /^(what|how|which|where|when|should|do|does|is|are|will)\s+/i;

/** Regex for removing trailing question mark */
const QUESTION_MARK_REGEX = /\?$/;

/**
 * Analyze a workflow description and generate clarification questions.
 * Calls plugin-registry-scanner and skill-capability-matcher skills.
 */
export async function analyzeDescription(
  description: string,
  workspace: string
): Promise<ClarificationResult> {
  const executor = createClaudeAgentExecutor({ workspace });

  // Build prompt that invokes the skills and returns structured JSON
  const prompt = buildAnalysisPrompt(description);

  const result = await executor.executePrompt(prompt, {
    workspace,
    contentId: crypto.randomUUID(),
  });

  if (!result.success) {
    throw new Error(result.error?.message ?? "Failed to analyze description");
  }

  // Parse and validate the result
  return parseClarificationResult(result.data);
}

/**
 * Build the prompt for skill analysis
 */
function buildAnalysisPrompt(description: string): string {
  return `You are a workflow builder assistant. Analyze the user's workflow description and generate clarification questions.

## User's Description
"${description}"

## Instructions

1. First, use Skill("plugin-registry-scanner") to discover available skills in the workspace.

2. Analyze the description and generate DYNAMIC sections based on what clarifications are needed:
   - Create 1-4 sections based on what's truly ambiguous or needs clarification
   - Use SHORT 1-2 word titles (max 10 chars): "Source", "Content", "Format", "Output"
   - NOT long titles like "Data Source & Filtering" or "Content Selection Criteria"
   - DO NOT use fixed sections like "Input/Goals/Output" unless they make sense for this specific workflow
   - Keep it minimal - only ask what's truly necessary
   - ALWAYS include "Review" as the LAST section with empty questions array

3. For each question:
   - Mark options as "inferred: true" if you detected them from the description
   - Include a "reason" field explaining why you inferred something
   - question.type can be: "single-select", "multi-select", or "text"

4. Return ONLY valid JSON (no markdown code blocks):

## Example for "get today's hackernews":
{
  "requirements": { "inputType": "web", "goals": ["fetch"], "outputFormat": "json" },
  "recommendations": [
    { "goalId": "fetch", "skill": "web-fetch", "stepId": "fetch-hn", "matchScore": 0.9 }
  ],
  "clarificationNeeded": true,
  "clarifications": {
    "sections": [
      {
        "id": "source",
        "title": "Source",
        "completed": false,
        "questions": [{
          "id": "source",
          "text": "Where should we get Hacker News data from?",
          "type": "single-select",
          "options": [
            { "id": "api", "label": "Hacker News API (official)", "inferred": true },
            { "id": "scrape", "label": "Website scraping" },
            { "id": "aggregator", "label": "Third-party aggregator" }
          ],
          "reason": "User mentioned 'today's hackernews' - official API provides real-time data"
        }]
      },
      { "id": "review", "title": "Review", "completed": false, "questions": [] }
    ]
  }
}

## Example for "analyze videos and create blog posts":
{
  "requirements": { "inputType": "video", "goals": ["analyze", "generate"], "outputFormat": "markdown" },
  "recommendations": [
    { "goalId": "analyze", "skill": "media-reviewer", "stepId": "analyze-video", "matchScore": 0.9 },
    { "goalId": "generate", "skill": "content-writer", "stepId": "write-blog", "matchScore": 0.85 }
  ],
  "clarificationNeeded": true,
  "clarifications": {
    "sections": [
      {
        "id": "content",
        "title": "Content",
        "completed": false,
        "questions": [{
          "id": "video-source",
          "text": "How will you provide the videos?",
          "type": "single-select",
          "options": [
            { "id": "transcript", "label": "Video transcripts (text files)", "inferred": true },
            { "id": "url", "label": "YouTube URLs" },
            { "id": "local", "label": "Local video files" }
          ],
          "reason": "Inferred transcripts since 'analyze videos' typically works with text"
        }]
      },
      {
        "id": "style",
        "title": "Style",
        "completed": false,
        "questions": [{
          "id": "blog-style",
          "text": "What style of blog posts?",
          "type": "single-select",
          "options": [
            { "id": "summary", "label": "Summary/recap style" },
            { "id": "editorial", "label": "Editorial/opinion piece" },
            { "id": "tutorial", "label": "Tutorial/how-to" }
          ]
        }]
      },
      { "id": "review", "title": "Review", "completed": false, "questions": [] }
    ]
  }
}

Important:
- Generate sections DYNAMICALLY based on the description - don't use fixed templates
- Each recommendation's goalId should match a detected goal
- Set inferred: true on options that match keywords in the description
- The review section should always be last with empty questions array
- Return ONLY valid JSON, no markdown code blocks or explanation`;
}

/**
 * Raw parsed response type
 */
type ParsedResponse = {
  requirements?: {
    inputType?: string;
    goals?: string[];
    outputFormat?: string;
  };
  recommendations?: Record<string, unknown>[];
  clarificationNeeded?: boolean;
  clarifications?: {
    sections?: Record<string, unknown>[];
  };
};

/**
 * Parse and validate the result from the executor
 */
function parseClarificationResult(data: unknown): ClarificationResult {
  // Handle various response formats
  const parsed = extractJsonFromResponse(data) as ParsedResponse;

  // Validate required fields
  if (!parsed.clarifications?.sections) {
    throw new Error("Invalid response: missing clarifications.sections");
  }

  // Flatten: each question becomes its own section (1 question = 1 tab)
  const flatSections: Section[] = [];

  for (const rawSection of parsed.clarifications.sections) {
    const sectionId = String(rawSection.id || "unknown");

    // Keep review section as-is
    if (sectionId === "review") {
      flatSections.push({
        id: "review",
        title: "Review",
        completed: false,
        questions: [],
      });
      continue;
    }

    // Each question becomes its own section with a short label
    const questions = Array.isArray(rawSection.questions)
      ? rawSection.questions
      : [];

    for (const question of questions) {
      const qId = String(question.id || sectionId);
      const shortLabel = getShortLabel(String(question.text || "Question"));

      flatSections.push({
        id: qId,
        title: shortLabel,
        completed: false,
        questions: [question],
      });
    }
  }

  // Ensure review section exists at the end
  if (!flatSections.find((s) => s.id === "review")) {
    flatSections.push({
      id: "review",
      title: "Review",
      completed: false,
      questions: [],
    });
  }

  // Parse recommendations
  const recommendations: Recommendation[] = Array.isArray(
    parsed.recommendations
  )
    ? parsed.recommendations.map((r: Record<string, unknown>) => ({
        goalId: String(r.goalId || ""),
        skill: String(r.skill || ""),
        stepId: String(r.stepId || r.suggestedStepId || ""),
        matchScore: Number(r.matchScore) || 0.5,
        rationale: r.rationale ? String(r.rationale) : undefined,
      }))
    : [];

  return {
    requirements: {
      inputType: parsed.requirements?.inputType,
      goals: parsed.requirements?.goals,
      outputFormat: parsed.requirements?.outputFormat,
    },
    recommendations,
    clarificationNeeded: parsed.clarificationNeeded !== false,
    clarifications: { sections: flatSections },
  };
}

/**
 * Extract a short label (1-2 words) from question text for tab display.
 */
function getShortLabel(text: string): string {
  // Remove common question words and punctuation
  const cleaned = text
    .replace(QUESTION_PREFIX_REGEX, "")
    .replace(QUESTION_MARK_REGEX, "")
    .trim();

  // Get first 1-2 meaningful words
  const words = cleaned.split(WORD_SPLIT_REGEX);
  if (words.length <= 2) {
    return capitalize(words.join(" "));
  }

  // Take first 2 words, max 12 chars total
  let label = words[0] ?? "";
  if (label.length < 8 && words[1] && words[1].length < 6) {
    label = `${label} ${words[1]}`;
  }

  return capitalize(label.slice(0, 12));
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Extract JSON from various response formats
 */
function extractJsonFromResponse(data: unknown): Record<string, unknown> {
  // If already an object with the expected structure
  if (
    data &&
    typeof data === "object" &&
    "clarifications" in (data as Record<string, unknown>)
  ) {
    return data as Record<string, unknown>;
  }

  // If it's a WorkflowResult with artifact
  if (
    data &&
    typeof data === "object" &&
    "artifact" in (data as Record<string, unknown>)
  ) {
    const artifact = (data as Record<string, unknown>).artifact;
    if (artifact && typeof artifact === "object") {
      return artifact as Record<string, unknown>;
    }
  }

  // If it's a string, try to parse as JSON
  if (typeof data === "string") {
    // Remove markdown code blocks if present
    const jsonStr = data
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse response as JSON");
    }
  }

  throw new Error("Unexpected response format from skill-capability-matcher");
}
