# Looplia-Core Architecture Design v0.6.3

> **FEATURE RELEASE:** Web-Capable Skills and Input-Less Workflows
>
> **Version:** 0.6.3
> **Date:** 2025-12-22
> **Related:** [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) | [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Architecture Change](#3-architecture-change)
4. [Web-Content-Fetcher Skill](#4-web-content-fetcher-skill)
5. [Input-Less Workflow Support](#5-input-less-workflow-support)
6. [Build Pipeline Updates](#6-build-pipeline-updates)
7. [Implementation Steps](#7-implementation-steps)
8. [File Changes Summary](#8-file-changes-summary)

---

## 1. Executive Summary

### Feature Release: v0.6.2 → v0.6.3

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.2 | Schema-in-Skill Architecture | Remove workflow-specific types; skills define JSON schemas in SKILL.md |
| **v0.6.3** | **Web-Capable Skills + Input-Less Workflows** | **Skills can fetch web content; workflows can run without user-provided input files** |

### What Changes in v0.6.3

v0.6.3 introduces two complementary features:

1. **NEW SKILL:** `web-content-fetcher` with WebSearch/WebFetch tools
2. **SCHEMA CHANGE:** `input` field becomes optional for input-less capable skills
3. **BUILD ENHANCEMENT:** Matcher/composer recognize web tasks and generate input-less steps

### Design Principle

> **Self-Contained Workflows**
>
> Some workflows don't require user input - they generate their own data.
> Example: "Read Hacker News and report the first news" needs no input file.
> Skills with web capabilities can fetch data directly.

### Key Insight

The current architecture assumes ALL workflow steps need an `input` file:

```yaml
# Current (v0.6.2) - REQUIRES input file
steps:
  - id: fetch-news
    skill: content-documenter
    input: ${{ sandbox }}/inputs/hn-request.json  # User must provide this
    output: ${{ sandbox }}/outputs/news.json
```

This forces users to create placeholder input files for tasks that don't need them. v0.6.3 introduces **input-less steps** for skills that can generate their own data:

```yaml
# New (v0.6.3) - NO input required
steps:
  - id: fetch-news
    skill: web-content-fetcher
    mission: Fetch the top story from Hacker News
    # No input field - skill fetches directly from web
    output: ${{ sandbox }}/outputs/news.json
```

---

## 2. Problem Statement

### 2.1 The User Experience Issue

User runs:
```bash
looplia build "read hacker news and report the first news to user"
```

System generates a workflow that:
1. **Requires an input file** (`--file request.json`)
2. **Uses `content-documenter`** which can't fetch web content
3. **Forces artificial input** for a self-contained task

**Expected behavior:**
- No input file needed
- Skill directly fetches from Hacker News
- User runs: `looplia run hn-news-reporter` (no `--file`)

### 2.2 Two Missing Capabilities

| Gap | Description | Solution |
|-----|-------------|----------|
| No web skills | No skill has WebSearch/WebFetch tools | Create `web-content-fetcher` skill |
| Mandatory input | All steps require `input` field | Make `input` optional for input-less skills |

### 2.3 Current Skill Inventory

| Skill | Has Web Tools? | Can Work Without Input? |
|-------|----------------|-------------------------|
| `media-reviewer` | No | No - needs content to analyze |
| `idea-synthesis` | No | No - needs analysis to generate ideas |
| `content-documenter` | No | No - needs content to document |
| `writing-kit-assembler` | No | No - needs inputs to assemble |
| **`web-content-fetcher`** (NEW) | **Yes** | **Yes** |

---

## 3. Architecture Change

### 3.1 Before vs After

```
BEFORE (v0.6.2):                        AFTER (v0.6.3):
┌─────────────────────────────┐         ┌─────────────────────────────┐
│ ALL workflow steps          │         │ MOST workflow steps         │
│                             │         │                             │
│ REQUIRE:                    │         │ REQUIRE:                    │
│ - skill: name               │         │ - skill: name               │
│ - mission: description      │         │ - mission: description      │
│ - input: file path     ←────┼───┐     │ - input: file path          │
│ - output: file path         │   │     │ - output: file path         │
└─────────────────────────────┘   │     └─────────────────────────────┘
                                  │
                                  │     ┌─────────────────────────────┐
                                  │     │ INPUT-LESS capable steps    │
                                  │     │ (e.g., web-content-fetcher) │
                                  └────▶│                             │
                                        │ REQUIRE:                    │
                                        │ - skill: name               │
                                        │ - mission: description      │
                                        │ - output: file path         │
                                        │                             │
                                        │ OPTIONAL (can omit):        │
                                        │ - input: (not required)     │
                                        └─────────────────────────────┘
```

### 3.2 Skill Capability Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SKILL CAPABILITY MATRIX (v0.6.3)                      │
└─────────────────────────────────────────────────────────────────────────────┘

Skill                    │ Input-Less? │ Tools                  │ Use Case
─────────────────────────┼─────────────┼────────────────────────┼──────────────
web-content-fetcher      │ YES         │ WebSearch, WebFetch    │ Fetch from web
media-reviewer           │ NO          │ Read, Glob, Grep       │ Analyze content
idea-synthesis           │ NO          │ Read, Skill            │ Generate ideas
content-documenter       │ NO          │ Read, Write            │ Document content
writing-kit-assembler    │ NO          │ Read, Write            │ Assemble kit
workflow-validator       │ NO          │ Bash                   │ Validate outputs
```

### 3.3 Input-Less Skill Registry

Skills that can operate without input are registered in the workflow parser:

```typescript
// packages/core/src/domain/workflow-parser.ts
const INPUTLESS_CAPABLE_SKILLS = [
  'web-content-fetcher',
  // Future: 'scheduler-trigger', 'cron-trigger', etc.
];
```

---

## 4. Web-Content-Fetcher Skill

### 4.1 Skill Overview

**Domain:** Data Acquisition - Fetch content from external sources

**Location:** `plugins/looplia-core/skills/web-content-fetcher/`

**Purpose:** Fetch web content using WebSearch and WebFetch tools without requiring input files

**Reusability:** HIGH - Any workflow needing external data

### 4.2 Skill Definition

**Path:** `plugins/looplia-core/skills/web-content-fetcher/SKILL.md`

```yaml
---
name: web-content-fetcher
description: |
  Looplia core skill for fetching content from the web.
  Use when the user wants to search online, fetch web pages, get news,
  read external URLs, or access any external web content.

  Trigger phrases:
  - "search the web for", "search online"
  - "fetch from URL", "get content from"
  - "read hacker news", "get news from"
  - "access [website]", "look up"

  This skill can operate WITHOUT input files (input-less capable).
  It generates its own data by fetching from the web.
tools: WebSearch, WebFetch, Write
model: claude-haiku-4-5-20251001
---
```

### 4.3 Skill Process

```markdown
## Process

### 1. Parse Mission
Extract from the mission:
- Target source (URL or search query)
- Data to extract (titles, content, metadata)
- Output format requirements

### 2. Determine Fetch Strategy

**For specific URLs:**
- Use WebFetch to retrieve page content
- Parse and extract relevant data

**For search queries:**
- Use WebSearch to find relevant results
- Optionally fetch top results with WebFetch

**For known sources (Hacker News, Reddit, etc.):**
- Use appropriate API endpoints or web pages
- Parse structured data from responses

### 3. Structure Output
Create JSON output with:
- contentId: Unique identifier for this fetch
- source: Where data came from
- fetchedAt: ISO timestamp
- content: The fetched/extracted content
- metadata: Additional context

### 4. Write Output
Write structured JSON to the specified output path.
```

### 4.4 Output Schema

```json
{
  "contentId": "hn-2025-12-22-abc123",
  "source": {
    "type": "hacker-news|web-search|url-fetch",
    "url": "https://news.ycombinator.com",
    "query": "search query if applicable"
  },
  "fetchedAt": "2025-12-22T10:30:00Z",
  "content": {
    "title": "Story title",
    "url": "https://example.com/story",
    "text": "Full text content if available",
    "summary": "Brief summary"
  },
  "metadata": {
    "score": 1234,
    "comments": 456,
    "author": "username"
  }
}
```

### 4.5 Example Missions

**Hacker News:**
```yaml
mission: |
  Fetch the top story from Hacker News.
  Extract title, URL, score, and comment count.
  Format as structured JSON.
```

**Web Search:**
```yaml
mission: |
  Search for "latest TypeScript features 2025".
  Return top 5 results with titles and URLs.
  Include brief snippets from each result.
```

**URL Fetch:**
```yaml
mission: |
  Fetch content from https://example.com/article.
  Extract the main article text and title.
  Include any metadata (author, date, tags).
```

---

## 5. Input-Less Workflow Support

### 5.1 Type Definition Change

**File:** `packages/core/src/domain/workflow.ts`

```typescript
// Before (v0.6.2)
export type WorkflowStep = {
  id: string;
  skill: string;
  mission: string;
  input: string | string[];  // REQUIRED
  output: string;
  needs?: string[];
  model?: string;
  validate?: ValidationCriteria;
  final?: boolean;
};

// After (v0.6.3)
export type WorkflowStep = {
  id: string;
  skill: string;
  mission: string;
  input?: string | string[] | null;  // OPTIONAL for input-less skills
  output: string;
  needs?: string[];
  model?: string;
  validate?: ValidationCriteria;
  final?: boolean;
};
```

### 5.2 Parser Validation Change

**File:** `packages/core/src/domain/workflow-parser.ts`

```typescript
// List of skills that can operate without input
const INPUTLESS_CAPABLE_SKILLS = ['web-content-fetcher'];

function validateStep(step: WorkflowStep): void {
  // ... existing id validation ...

  // ... existing skill/mission validation ...

  // v0.6.3: Input validation with input-less skill support
  const isInputlessCapable = step.skill &&
    INPUTLESS_CAPABLE_SKILLS.includes(step.skill);

  if (!step.input && !isInputlessCapable) {
    throw new Error(
      `Step '${step.id}' must have an 'input' field ` +
      `(or use an input-less capable skill like: ${INPUTLESS_CAPABLE_SKILLS.join(', ')})`
    );
  }

  if (step.input && Array.isArray(step.input) && step.input.length === 0) {
    throw new Error(`Step '${step.id}' input array cannot be empty`);
  }

  // ... existing output validation ...
}
```

### 5.3 Skill Executor Prompt Update

**File:** `packages/provider/src/claude-agent-sdk/streaming/prompts/skill-executor.ts`

```markdown
## Execution Protocol

When you receive a step execution request:

### 1. Parse Step Context
Extract from the prompt:
- `skill`: The primary skill to invoke
- `mission`: Natural language description of what to accomplish
- `input`: Input file path(s) to read (MAY BE ABSENT for input-less steps)
- `output`: Output file path to write
- `validate`: Validation criteria (if any)

### 2. Read Input Files (if provided)
**IF** input paths are provided in the step:
  - Use the Read tool to load the input file(s) specified in the step
  - Pass the content to the skill

**ELSE** (input-less step):
  - Proceed directly to skill invocation
  - The skill will generate its own data (e.g., by fetching from web)

### 3. Invoke the Skill
Use the Skill tool to invoke the specified skill.
Pass the mission and any input content as context.

### 4. Write Output
Write the skill's output to the specified output path.

### 5. Return for Validation
Signal completion for validation hook.
```

### 5.4 Workflow Executor Update

**File:** `plugins/looplia-core/skills/workflow-executor/SKILL.md`

Update Phase 1 (Sandbox Setup) to handle workflows without `--file`:

```markdown
## Phase 1: Sandbox Setup

**When `--file` is provided:**
1. Read content file
2. Generate sandbox ID: `{content-slug}-{YYYY-MM-DD}-{random4chars}`
3. Create sandbox directory
4. Copy content to `${{ sandbox }}/inputs/content.md`

**When `--file` is NOT provided (input-less workflow):**
1. Verify workflow can run without input (first step must be input-less capable)
2. Generate sandbox ID: `{workflow-name}-{YYYY-MM-DD}-{random4chars}`
3. Create sandbox directory
4. Create empty inputs directory (steps will generate their own data)
```

Update Phase 6 (Task Tool Invocation) for input-less steps:

```markdown
## Phase 6: Execute Steps

For each step in execution order:

**Standard step (has input field):**
```json
{
  "subagent_type": "skill-executor",
  "description": "Execute step: {step-id}",
  "prompt": "Execute skill '{skill}' for step '{step-id}'.\n\nMission: {mission}\n\nInput: {input}\nOutput: {output}\nValidation: {validate}"
}
```

**Input-less step (no input field):**
```json
{
  "subagent_type": "skill-executor",
  "description": "Execute step: {step-id}",
  "prompt": "Execute skill '{skill}' for step '{step-id}'.\n\nMission: {mission}\n\nInput: (none - input-less step, skill will generate its own data)\nOutput: {output}\nValidation: {validate}"
}
```
```

---

## 6. Build Pipeline Updates

### 6.1 Plugin Registry Scanner

**File:** `plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.ts`

Add capability patterns for web-related skills:

```typescript
export const CAPABILITY_PATTERNS: [string, string][] = [
  // Existing patterns...
  ["analy", "content analysis"],
  ["review", "content analysis"],
  ["summar", "summarization"],
  ["document", "structured output"],
  ["generat", "content generation"],

  // NEW: Web-related patterns
  ["web", "web content fetching"],
  ["fetch", "web content fetching"],
  ["search", "web search"],
  ["url", "URL retrieval"],
  ["news", "news retrieval"],
  ["http", "web content fetching"],
  ["online", "web search"],
];
```

### 6.2 Skill Capability Matcher

**File:** `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md`

Add web task recognition:

```markdown
## Step 1: Parse Requirements

**Input Types (updated):**
- video transcript
- audio transcript
- article/blog post
- documentation
- raw text
- structured data (JSON/YAML)
- **web URL** (NEW)
- **search query** (NEW)
- **none (input-less)** (NEW)

### Recognizing Web Tasks

Tasks requiring web access:
- "fetch from [URL]", "read [website]", "get content from [site]"
- "search for", "find online", "look up"
- "check news", "read hacker news", "latest from [source]"
- Any task mentioning external websites or real-time data

For these tasks:
- Recommend `web-content-fetcher` skill
- Mark step as input-less: `inputless: true`
- Set `dataFlow.{stepId}.needs: []` (no dependencies on prior file inputs)
```

Update output schema:

```json
{
  "requirements": {
    "inputType": "none (input-less)",
    "goals": ["fetch news", "generate report"],
    "outputFormat": "structured JSON"
  },
  "recommendations": [
    {
      "skill": "web-content-fetcher",
      "suggestedStepId": "fetch-content",
      "matchScore": 0.95,
      "capabilities": ["web content fetching", "URL retrieval"],
      "mission": "Fetch the top news from Hacker News. Extract headline, URL, and summary.",
      "rationale": "Required for accessing external web content",
      "inputless": true
    },
    {
      "skill": "content-documenter",
      "suggestedStepId": "generate-report",
      "matchScore": 0.88,
      "capabilities": ["structured output"],
      "mission": "Create a formatted report from the fetched content.",
      "rationale": "Transforms raw data into user-friendly format",
      "inputless": false
    }
  ],
  "dataFlow": {
    "fetch-content": {
      "needs": [],
      "provides": "news.json",
      "inputless": true
    },
    "generate-report": {
      "needs": ["fetch-content"],
      "provides": "report.json",
      "inputless": false
    }
  }
}
```

### 6.3 Workflow Schema Composer

**File:** `plugins/looplia-core/skills/workflow-schema-composer/SKILL.md`

Update Step 2 (Design Steps):

```markdown
## Step 2: Design Steps

For each recommendation from skill-capability-matcher:

**Standard step (inputless: false):**
```yaml
- id: {suggestedStepId}
  skill: {skill-name}
  mission: |
    {mission description}
  input: {input path or step reference}
  output: ${{ sandbox }}/outputs/{step-id}.json
  validate:
    required_fields: [{fields}]
```

**Input-less step (inputless: true):**
```yaml
- id: {suggestedStepId}
  skill: {skill-name}
  mission: |
    {mission description}
  # NO input field for input-less steps
  output: ${{ sandbox }}/outputs/{step-id}.json
  validate:
    required_fields: [{fields}]
```

### CRITICAL: Input-less step rules

1. **OMIT** the `input` field entirely (do not set to null or empty string)
2. Input-less steps can be the **first step** in a workflow
3. Subsequent steps can **depend on** input-less step outputs via `${{ steps.{id}.output }}`
4. A workflow can have **multiple** input-less steps if needed
```

### 6.4 Schema Documentation Update

**File:** `plugins/looplia-core/skills/workflow-schema-composer/SCHEMA.md`

Update Step Fields table:

```markdown
## Step Fields Reference (v0.6.3)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique step identifier (kebab-case) |
| `skill` | string | **Yes** | Skill to execute |
| `mission` | string | **Yes** | Natural language task description |
| `input` | string/array | **Conditional** | Input file path(s). Required unless skill is input-less capable |
| `output` | string | **Yes** | Output file path |
| `needs` | string[] | No | Step dependencies (by step ID) |
| `model` | string | No | Model override (haiku/sonnet/opus) |
| `validate` | object | No | Validation criteria |
| `final` | boolean | No | Mark as final output step |

## Input-Less Steps (v0.6.3)

Some skills can generate their own data without external input:

**Currently supported:**
- `web-content-fetcher` - Fetches content from web URLs or search queries

**How to define:**
```yaml
# Input-less step - omit the input field entirely
- id: fetch-data
  skill: web-content-fetcher
  mission: Search for latest AI news
  output: ${{ sandbox }}/outputs/news.json
  validate:
    required_fields: [contentId, source, content]
```

**Downstream steps can reference input-less step outputs:**
```yaml
- id: analyze-data
  skill: media-reviewer
  needs: [fetch-data]
  input: ${{ steps.fetch-data.output }}  # Uses output from input-less step
  output: ${{ sandbox }}/outputs/analysis.json
```
```

---

## 7. Implementation Steps

### 7.1 Implementation Order

| Phase | Components | Dependencies |
|-------|------------|--------------|
| 1 | Create `web-content-fetcher` skill | None |
| 2 | Update workflow type definition | None |
| 3 | Update workflow parser validation | Phase 2 |
| 4 | Update skill-executor prompt | Phase 3 |
| 5 | Update workflow-executor skill | Phase 4 |
| 6 | Update registry scanner capabilities | Phase 1 |
| 7 | Update skill-capability-matcher | Phase 6 |
| 8 | Update workflow-schema-composer | Phase 7 |
| 9 | Update schema documentation | Phase 8 |
| 10 | Add tests | All phases |

### 7.2 Phase 1: Create Web-Content-Fetcher Skill

**Create:** `plugins/looplia-core/skills/web-content-fetcher/SKILL.md`

Full content as specified in [Section 4](#4-web-content-fetcher-skill).

### 7.3 Phase 2: Update Type Definition

**Modify:** `packages/core/src/domain/workflow.ts`

Change `input` from required to optional:
```typescript
input?: string | string[] | null;
```

### 7.4 Phase 3: Update Parser Validation

**Modify:** `packages/core/src/domain/workflow-parser.ts`

Add:
1. `INPUTLESS_CAPABLE_SKILLS` constant
2. Conditional input validation in `validateStep()`

### 7.5 Phase 4: Update Skill Executor Prompt

**Modify:** `packages/provider/src/claude-agent-sdk/streaming/prompts/skill-executor.ts`

Add conditional input handling as specified in [Section 5.3](#53-skill-executor-prompt-update).

### 7.6 Phase 5: Update Workflow Executor

**Modify:** `plugins/looplia-core/skills/workflow-executor/SKILL.md`

1. Update Phase 1 for sandbox setup without `--file`
2. Update Phase 6 for input-less step invocation

### 7.7 Phase 6: Update Registry Scanner

**Modify:** `plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.ts`

Add web-related capability patterns.

### 7.8 Phase 7: Update Skill Capability Matcher

**Modify:** `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md`

1. Add web task recognition
2. Add `inputless` field to output schema
3. Update input types list

### 7.9 Phase 8: Update Workflow Schema Composer

**Modify:** `plugins/looplia-core/skills/workflow-schema-composer/SKILL.md`

1. Add input-less step generation logic
2. Update Step 2 documentation

### 7.10 Phase 9: Update Schema Documentation

**Modify:** `plugins/looplia-core/skills/workflow-schema-composer/SCHEMA.md`

1. Update Step Fields table
2. Add Input-Less Steps section

### 7.11 Phase 10: Add Tests

**Modify:** `packages/core/test/domain/workflow-parser.test.ts`

```typescript
describe('input-less workflow support (v0.6.3)', () => {
  it('should allow steps without input for input-less capable skills', () => {
    const valid = `---
name: web-workflow
description: Fetch web content
steps:
  - id: fetch-news
    skill: web-content-fetcher
    mission: Fetch the top story from Hacker News
    output: \${{ sandbox }}/outputs/news.json
---`;

    const result = parseWorkflow(valid);
    expect(result.definition.steps[0].input).toBeUndefined();
  });

  it('should still require input for non-input-less skills', () => {
    const invalid = `---
name: test
description: Test
steps:
  - id: analyze
    skill: media-reviewer
    mission: Analyze content
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow("'input' field");
  });

  it('should allow mixed workflows with input-less and standard steps', () => {
    const valid = `---
name: mixed-workflow
description: Fetch and analyze
steps:
  - id: fetch
    skill: web-content-fetcher
    mission: Fetch news
    output: \${{ sandbox }}/outputs/news.json
  - id: analyze
    skill: media-reviewer
    mission: Analyze the news
    needs: [fetch]
    input: \${{ steps.fetch.output }}
    output: \${{ sandbox }}/outputs/analysis.json
---`;

    const result = parseWorkflow(valid);
    expect(result.definition.steps[0].input).toBeUndefined();
    expect(result.definition.steps[1].input).toBe('${{ steps.fetch.output }}');
  });
});
```

---

## 8. File Changes Summary

### 8.1 New Files

| File | Purpose |
|------|---------|
| `plugins/looplia-core/skills/web-content-fetcher/SKILL.md` | Web content fetching skill |

### 8.2 Modified Files

| File | Change |
|------|--------|
| `packages/core/src/domain/workflow.ts` | Make `input` field optional |
| `packages/core/src/domain/workflow-parser.ts` | Add input-less skill validation |
| `packages/core/test/domain/workflow-parser.test.ts` | Add input-less workflow tests |
| `packages/provider/src/claude-agent-sdk/streaming/prompts/skill-executor.ts` | Handle steps without input |
| `plugins/looplia-core/skills/workflow-executor/SKILL.md` | Handle input-less workflows |
| `plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.ts` | Add web capability patterns |
| `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md` | Recognize web tasks |
| `plugins/looplia-core/skills/workflow-schema-composer/SKILL.md` | Generate input-less steps |
| `plugins/looplia-core/skills/workflow-schema-composer/SCHEMA.md` | Document input-less steps |

### 8.3 Summary Table

| Component | File | Action |
|-----------|------|--------|
| New Skill | `plugins/looplia-core/skills/web-content-fetcher/SKILL.md` | **Create** |
| Type Definition | `packages/core/src/domain/workflow.ts` | Modify |
| Parser | `packages/core/src/domain/workflow-parser.ts` | Modify |
| Parser Tests | `packages/core/test/domain/workflow-parser.test.ts` | Modify |
| Skill Executor | `packages/provider/.../skill-executor.ts` | Modify |
| Workflow Executor | `plugins/looplia-core/skills/workflow-executor/SKILL.md` | Modify |
| Registry Scanner | `plugins/looplia-core/.../scan-plugins.ts` | Modify |
| Capability Matcher | `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md` | Modify |
| Schema Composer | `plugins/looplia-core/skills/workflow-schema-composer/SKILL.md` | Modify |
| Schema Docs | `plugins/looplia-core/skills/workflow-schema-composer/SCHEMA.md` | Modify |

---

## Success Criteria

1. **New skill works:** `web-content-fetcher` can fetch Hacker News content
2. **Parser accepts input-less:** Workflows without `input` field for valid skills pass validation
3. **Parser rejects invalid:** Workflows without `input` field for non-input-less skills fail validation
4. **Build generates correctly:** `/build "read hacker news"` generates input-less workflow
5. **Execution works:** `looplia run hn-news-reporter` works without `--file` flag
6. **Mixed workflows work:** Workflows with both input-less and standard steps execute correctly
7. **All tests pass:** Unit and integration tests pass

---

## Example: Expected Build Output

After v0.6.3 implementation:

```bash
looplia build "read hacker news and report the first news to user"
```

Generates:

```yaml
---
name: hn-news-reporter
version: 1.0.0
description: Fetch the top Hacker News story and generate a user report

steps:
  - id: fetch-news
    skill: web-content-fetcher
    mission: |
      Fetch the top story from Hacker News homepage.
      Extract title, URL, score, and comment count.
      Format as structured JSON.
    # No input field - input-less step
    output: ${{ sandbox }}/outputs/news.json
    model: haiku
    validate:
      required_fields: [contentId, source, content, metadata]

  - id: analyze-story
    skill: media-reviewer
    mission: |
      Analyze the fetched Hacker News story.
      Extract key themes and relevance indicators.
      Provide context on why this story is trending.
    needs: [fetch-news]
    input: ${{ steps.fetch-news.output }}
    output: ${{ sandbox }}/outputs/analysis.json
    validate:
      required_fields: [contentId, headline, keyThemes]

  - id: generate-report
    skill: content-documenter
    mission: |
      Create a user-friendly report of the Hacker News story.
      Include title, link, score, key insights, and importance.
      Format as clean, readable summary.
    needs: [fetch-news, analyze-story]
    input:
      - ${{ steps.fetch-news.output }}
      - ${{ steps.analyze-story.output }}
    output: ${{ sandbox }}/outputs/report.json
    final: true
    validate:
      required_fields: [title, url, summary, insights]
---

# Hacker News Reporter Workflow

Fetch the top Hacker News story and generate a comprehensive report.

## Usage

```bash
looplia run hn-news-reporter
```

No `--file` required - the workflow fetches content directly from the web.
```

---

## Cross-References

- **Schema-in-Skill Architecture (v0.6.2):** See [DESIGN-0.6.2.md](./DESIGN-0.6.2.md)
- **Skills-First Architecture (v0.6.1):** See [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)
- **Context Injection:** See [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md)
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md)

---

*This document serves as the single source of truth for Looplia-Core v0.6.3 web-capable skills and input-less workflows.*
