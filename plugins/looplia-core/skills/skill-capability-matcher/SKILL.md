---
name: skill-capability-matcher
description: |
  Looplia core skill for matching user requirements to available skills.
  Use when building looplia workflows to determine which skills should handle each step.
  Analyzes natural language descriptions and recommends skill sequences with rationale.
  Triggered by /build command after plugin-registry-scanner.
  Skills-first: prioritizes skills over agents for workflow steps.
model: claude-haiku-4-5-20251001
---

# Skill Capability Matcher

Match natural language requirements to available skills, designing an optimal workflow step sequence.

## Purpose

Parse user's workflow description, understand their intent, and recommend which skills should handle each part of the workflow. Output includes step IDs, skill names, missions, and data flow.

## Process

### Step 1: Parse Requirements

Extract from the user's description:

**Input Types:**
- video transcript
- audio transcript
- article/blog post
- documentation
- raw text
- structured data (JSON/YAML)

**Processing Goals:**
- analyze (deep understanding)
- summarize (condensation)
- generate (create new content)
- transform (change format)
- extract (pull specific data)
- validate (check correctness)

**Output Format:**
- JSON structure
- Markdown document
- Summary text
- Structured data

### Step 2: Load Registry

Read the plugin registry from plugin-registry-scanner output:

```json
{
  "plugins": [...],
  "summary": { "totalSkills": N }
}
```

Build a capability index from skill descriptions and inferred capabilities.

### Step 3: Match Capabilities

Score each skill by:
1. **Description match** - Does skill description align with requirements?
2. **Capability overlap** - Do inferred capabilities match processing goals?
3. **Input/output compatibility** - Can skill handle input type and produce expected output?

### Step 4: Design Step Sequence

For each matched skill:
1. Create a step ID (kebab-case, descriptive)
2. Determine dependencies (`needs:`)
3. Write a mission description (what to accomplish)
4. Define data flow (input → output)

### Step 5: Recommend Sequence

Order skills logically:
1. Analysis skills first (understand content)
2. Generation/transformation skills second
3. Assembly/output skills last

Ensure proper data dependencies.

### Step 6: Flag Gaps

If requirements can't be fully satisfied:
- List unmatched capabilities as gaps
- Suggest creating custom skills if needed
- Indicate if workflow is partial

## Input

Provide:
1. User's natural language description
2. Registry JSON from plugin-registry-scanner

## Output Schema

```json
{
  "requirements": {
    "inputType": "video transcript",
    "goals": ["extract key points", "generate outline"],
    "outputFormat": "structured JSON"
  },
  "recommendations": [
    {
      "skill": "media-reviewer",
      "suggestedStepId": "analyze-content",
      "matchScore": 0.92,
      "capabilities": ["content analysis", "theme extraction"],
      "mission": "Deep analysis of video transcript. Extract key themes, quotes, and narrative structure.",
      "rationale": "Primary skill for content understanding"
    },
    {
      "skill": "idea-synthesis",
      "suggestedStepId": "generate-ideas",
      "matchScore": 0.85,
      "capabilities": ["idea generation", "hooks and angles"],
      "mission": "Generate hooks, angles, and questions from the analysis. Read user profile for personalization.",
      "rationale": "Creates engaging content ideas from analysis"
    }
  ],
  "suggestedSequence": ["analyze-content", "generate-ideas", "build-output"],
  "dataFlow": {
    "analyze-content": {
      "needs": [],
      "provides": "analysis.json"
    },
    "generate-ideas": {
      "needs": ["analyze-content"],
      "provides": "ideas.json"
    },
    "build-output": {
      "needs": ["analyze-content", "generate-ideas"],
      "provides": "output.json"
    }
  },
  "gaps": [],
  "customSkillNeeded": false
}
```

## Scoring Guidelines

| Match Type | Score |
|------------|-------|
| Exact capability match | 0.9-1.0 |
| Strong description overlap | 0.7-0.9 |
| Partial capability match | 0.5-0.7 |
| Weak/inferred match | 0.3-0.5 |
| No clear match | < 0.3 |

## Mission Writing Guidelines

Each mission should:
- Start with an action verb (Analyze, Extract, Generate, Create, Transform)
- Describe the specific goal for this step
- Mention key outputs expected
- Reference context from previous steps if applicable
- Be 2-4 sentences

**Good mission example:**
```
Deep analysis of video transcript. Extract key themes, important quotes with timestamps, and narrative structure. Focus on insights that would interest the user based on their profile.
```

**Bad mission example:**
```
Analyze the content.
```

## Important Rules

1. **Skills-first** - Never recommend agents, only skills
2. **Include missions** - Every recommendation must have a detailed mission
3. **Score realistically** - Don't inflate match scores
4. **Complete data flow** - Ensure all dependencies are resolvable
5. **Flag gaps honestly** - Report capabilities that can't be matched
