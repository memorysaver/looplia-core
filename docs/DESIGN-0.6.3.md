# Looplia-Core Architecture Design v0.6.3

> **FEATURE RELEASE:** Flexible Input System and Input-Less Workflows
>
> **Version:** 0.6.3
> **Date:** 2025-12-24
> **Related:** [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) | [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Architecture Change](#3-architecture-change)
4. [Workflow Inputs Declaration](#4-workflow-inputs-declaration)
5. [CLI Input System](#5-cli-input-system)
6. [Variable Resolution](#6-variable-resolution)
7. [Search Skill](#7-search-skill)
8. [Workspace Structure](#8-workspace-structure)
9. [Type System Changes](#9-type-system-changes)
10. [Build Pipeline Updates](#10-build-pipeline-updates)
11. [Implementation Steps](#11-implementation-steps)
12. [File Changes Summary](#12-file-changes-summary)

---

## 1. Executive Summary

### Feature Release: v0.6.2 → v0.6.3

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.2 | Schema-in-Skill Architecture | Skills define JSON schemas in SKILL.md |
| **v0.6.3** | **Flexible Input System** | **Workflows support 0 to N named inputs; skills can operate autonomously** |

### What Changes in v0.6.3

v0.6.3 introduces a flexible input system:

1. **FLEXIBLE INPUTS:** Workflows support 0, 1, or N named inputs
2. **NEW SYNTAX:** `inputs:` declaration at workflow level
3. **NEW CLI:** `--input name=value` for named inputs
4. **INPUT-LESS WORKFLOWS:** Skills can operate autonomously (local search, web search, generation)
5. **SEARCH SKILL:** Generic search with provider abstraction (local, web, future: jina.ai, firecrawl, exa.ai)
6. **BACKWARD COMPAT:** `--file` continues to work for legacy workflows

### Design Principle

> **Flexible Input System**
>
> Workflows should accept exactly the inputs they need - zero, one, or many.
> Named inputs are self-documenting and enable complex multi-source workflows.
>
> **Input-less ≠ Web-only**
>
> Input-less workflows can operate via:
> - **Local execution:** Search files, scan codebase, analyze directories
> - **Web execution:** Search online, fetch URLs, retrieve news
> - **Generation:** Create content from scratch without external data

### The Shift

```
BEFORE (v0.6.2):
  looplia run workflow --file content.md     # Exactly 1 input, always

AFTER (v0.6.3):
  looplia run workflow                                    # 0 inputs (input-less)
  looplia run workflow --file content.md                  # 1 input (legacy)
  looplia run workflow --input video1=v1.md               # 1 named input
  looplia run workflow --input v1=a.md --input v2=b.md    # N named inputs
  looplia run workflow --input config='{"key": "value"}'  # Inline JSON
```

---

## 2. Problem Statement

### 2.1 The Single-Input Limitation

Current (v0.6.2) workflows require exactly ONE input file:

```bash
looplia run writing-kit --file content.md
```

This fails for common use cases:

| Use Case | Required Inputs | Current Support |
|----------|-----------------|-----------------|
| "Read Hacker News and report" | 0 (web fetch) | Not supported |
| "Analyze this video" | 1 | Supported |
| "Compare two videos" | 2 | Not supported |
| "Merge transcript + notes + config" | 3 | Not supported |

### 2.2 Three Missing Capabilities

| Gap | Description | Solution |
|-----|-------------|----------|
| No zero inputs | Can't run without `--file` | Input-less workflows |
| No multi-inputs | Can't provide 2+ files | Named inputs system |
| No autonomous skills | No skill can operate without input | Generic search skill (local + web providers) |

### 2.3 User Experience Issues

**Issue 1:** User runs `looplia build "read hacker news"` and gets:
```yaml
steps:
  - id: fetch
    input: ${{ sandbox }}/inputs/content.md  # Why? There's nothing to input!
```

**Issue 2:** User wants to compare two videos but can only provide one:
```bash
looplia run compare-videos --file ???  # How to provide TWO files?
```

**Issue 3:** No way to know what inputs a workflow expects:
```bash
looplia run some-workflow --file ???  # What should I provide?
```

---

## 3. Architecture Change

### 3.1 Input Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     v0.6.3 FLEXIBLE INPUT SYSTEM                             │
└─────────────────────────────────────────────────────────────────────────────┘

MODE 1: Input-Less (0 inputs)
┌────────────────────────────────┐
│ Workflow has no inputs:        │
│ declaration AND first step     │
│ uses input-less capable skill  │
│                                │
│ CLI: looplia run workflow      │
│ (no --file or --input needed)  │
└────────────────────────────────┘

MODE 2: Legacy Single Input (1 input)
┌────────────────────────────────┐
│ Workflow has NO inputs:        │
│ declaration                    │
│                                │
│ CLI: looplia run workflow      │
│      --file content.md         │
│                                │
│ File copied to:                │
│ sandbox/inputs/content.md      │
└────────────────────────────────┘

MODE 3: Named Inputs (1 to N inputs)
┌────────────────────────────────┐
│ Workflow HAS inputs:           │
│ declaration                    │
│                                │
│ CLI: looplia run workflow      │
│      --input video1=v1.md      │
│      --input video2=v2.md      │
│                                │
│ Files copied to:               │
│ sandbox/inputs/video1.md       │
│ sandbox/inputs/video2.md       │
└────────────────────────────────┘
```

### 3.2 Decision Tree

```
                    ┌─────────────────────────┐
                    │ Does workflow have      │
                    │ inputs: declaration?    │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
        NO inputs:                          HAS inputs:
              │                                   │
              │                           ┌───────┴───────┐
              │                           │               │
              ▼                           ▼               ▼
    ┌─────────────────┐           Required         Optional
    │ --file provided?│           inputs           inputs
    └────────┬────────┘               │               │
             │                        ▼               ▼
    ┌────────┴────────┐         Validate all   Accept if
    │                 │         are provided   provided
    ▼                 ▼
  YES               NO
    │                 │
    ▼                 ▼
  Legacy        Input-less
  mode          mode (if valid)
```

### 3.3 Skill Capability Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SKILL CAPABILITY MATRIX (v0.6.3)                        │
└─────────────────────────────────────────────────────────────────────────────┘

Skill                   │ Input-Less? │ Tools                        │ Use Case
────────────────────────┼─────────────┼──────────────────────────────┼─────────────────
search                  │ YES         │ Glob, Grep, Read, Bash,      │ Local + web search
                        │             │ WebSearch, WebFetch          │ (provider-agnostic)
media-reviewer          │ NO          │ Read, Glob, Grep             │ Analyze content
idea-synthesis          │ NO          │ Read, Skill                  │ Generate ideas
content-documenter      │ NO          │ Read, Write                  │ Document content
writing-kit-assembler   │ NO          │ Read, Write                  │ Assemble kit
workflow-validator      │ NO          │ Bash                         │ Validate outputs
```

**Search Skill Modes:**
- **Local:** Glob, Grep, Read, Bash (search files, codebase, directories)
- **Web:** WebSearch, WebFetch (search online, fetch URLs)
- **Future providers:** jina.ai, firecrawl, exa.ai (pluggable backends)

---

## 4. Workflow Inputs Declaration

### 4.1 Schema

```yaml
---
name: workflow-name
version: 1.0.0
description: What this workflow does

inputs:                           # NEW: Declare expected inputs
  - name: video1                  # Input identifier (kebab-case)
    required: true                # Is this input mandatory?
    description: First video      # Human-readable description
  - name: video2
    required: true
    description: Second video
  - name: notes
    required: false               # Optional input
    description: Additional notes

steps:
  - id: compare
    skill: media-reviewer
    input:
      - ${{ inputs.video1 }}      # Reference named inputs
      - ${{ inputs.video2 }}
    output: ${{ sandbox }}/outputs/comparison.json
---
```

### 4.2 WorkflowInput Type

```typescript
export type WorkflowInput = {
  name: string;           // Unique identifier (kebab-case)
  required: boolean;      // Is this input mandatory?
  description?: string;   // Human-readable description
  type?: 'file' | 'json'; // Optional type hint (default: file)
};
```

### 4.3 Input Name Rules

- Must be kebab-case: `video-transcript`, `user-config`
- Must be unique within workflow
- Cannot be reserved names: `sandbox`, `steps`, `content`
- Maximum 50 characters

### 4.4 Examples

**Zero Inputs (input-less) - Web Search:**
```yaml
---
name: hn-news-reporter
# No inputs: declaration
steps:
  - id: fetch-news
    skill: search
    mission: Search Hacker News for top story and compile results
    # No input field - input-less step
    output: ${{ sandbox }}/outputs/news.json
---
```

**Zero Inputs (input-less) - Local Search:**
```yaml
---
name: todo-finder
# No inputs: declaration
steps:
  - id: find-todos
    skill: search
    mission: Search local codebase for TODO comments and compile a report
    # No input field - input-less step (local mode)
    output: ${{ sandbox }}/outputs/todos.json
---
```

**One Required Input:**
```yaml
---
name: video-analyzer
inputs:
  - name: video
    required: true
    description: Video transcript to analyze

steps:
  - id: analyze
    skill: media-reviewer
    input: ${{ inputs.video }}
    output: ${{ sandbox }}/outputs/analysis.json
---
```

**Multiple Inputs (Required + Optional):**
```yaml
---
name: compare-videos
inputs:
  - name: video1
    required: true
    description: First video to compare
  - name: video2
    required: true
    description: Second video to compare
  - name: config
    required: false
    description: Optional comparison settings
    type: json

steps:
  - id: analyze-first
    skill: media-reviewer
    input: ${{ inputs.video1 }}
    output: ${{ sandbox }}/outputs/analysis1.json

  - id: analyze-second
    skill: media-reviewer
    input: ${{ inputs.video2 }}
    output: ${{ sandbox }}/outputs/analysis2.json

  - id: compare
    skill: content-documenter
    needs: [analyze-first, analyze-second]
    input:
      - ${{ steps.analyze-first.output }}
      - ${{ steps.analyze-second.output }}
    output: ${{ sandbox }}/outputs/comparison.json
    final: true
---
```

---

## 5. CLI Input System

### 5.1 Command Syntax

```bash
looplia run <workflow> [options]

Options:
  --input <name>=<value>   Provide named input (repeatable)
  --file <path>            Legacy single input (for workflows without inputs:)
  --sandbox-id <id>        Resume existing sandbox
  --mock                   Use mock executor
  --help                   Show help with expected inputs
```

### 5.2 Input Value Formats

**File path:**
```bash
--input video1=path/to/video.md
--input config=settings.json
```

**Inline JSON:**
```bash
--input config='{"theme": "dark", "limit": 10}'
--input params='["tag1", "tag2"]'
```

**Detection logic:**
- If value starts with `{` or `[` → parse as inline JSON
- Otherwise → treat as file path

### 5.3 Help Output

When user runs `looplia run workflow --help`, show expected inputs:

```
Usage: looplia run compare-videos [options]

This workflow compares two videos and generates a report.

Inputs:
  --input video1=<path>   (required) First video to compare
  --input video2=<path>   (required) Second video to compare
  --input config=<json>   (optional) Comparison settings

Examples:
  looplia run compare-videos --input video1=v1.md --input video2=v2.md
  looplia run compare-videos --input video1=v1.md --input video2=v2.md \
                             --input config='{"detailed": true}'
```

### 5.4 Validation

| Scenario | Behavior |
|----------|----------|
| Missing required input | Error: "Required input 'video1' not provided" |
| Unknown input name | Warning: "Unknown input 'extra' - ignoring" |
| Invalid JSON syntax | Error: "Invalid JSON for input 'config': ..." |
| File not found | Error: "File not found for input 'video1': path/to/file.md" |
| No inputs for input-less | OK - workflow runs without inputs |

### 5.5 Backward Compatibility

| Workflow Type | CLI Syntax |
|---------------|------------|
| No `inputs:` declaration | Use `--file` (legacy) |
| Has `inputs:` declaration | Use `--input name=value` |
| Input-less (first step needs no input) | No flags needed |

---

## 6. Variable Resolution

### 6.1 Available Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `${{ sandbox }}` | Current sandbox directory | `sandbox/video-2025-01-15-abc1` |
| `${{ steps.{id}.output }}` | Output path from step | `sandbox/.../outputs/analysis.json` |
| `${{ inputs.{name} }}` | Named input file path | `sandbox/.../inputs/video1.md` |

### 6.2 Resolution Examples

**Workflow definition:**
```yaml
inputs:
  - name: video1
    required: true

steps:
  - id: analyze
    skill: media-reviewer
    input: ${{ inputs.video1 }}
    output: ${{ sandbox }}/outputs/analysis.json

  - id: summarize
    skill: content-documenter
    needs: [analyze]
    input: ${{ steps.analyze.output }}
    output: ${{ sandbox }}/outputs/summary.json
```

**After resolution (sandbox: `video-2025-12-24-x1y2`):**
```yaml
steps:
  - id: analyze
    input: sandbox/video-2025-12-24-x1y2/inputs/video1.md
    output: sandbox/video-2025-12-24-x1y2/outputs/analysis.json

  - id: summarize
    input: sandbox/video-2025-12-24-x1y2/outputs/analysis.json
    output: sandbox/video-2025-12-24-x1y2/outputs/summary.json
```

### 6.3 Resolution Order

1. `${{ inputs.name }}` → resolved from CLI-provided inputs
2. `${{ sandbox }}` → resolved from sandbox ID
3. `${{ steps.id.output }}` → resolved from step definitions

---

## 7. Search Skill

### 7.1 Skill Overview

**Domain:** Data Acquisition - Search and compile information from various sources

**Location:** `plugins/looplia-core/skills/search/`

**Purpose:** Generic search with provider abstraction (input-less capable)

### 7.2 Design Philosophy

**Input-less ≠ Web-only**

The search skill abstracts the data source:

| Mode | Tools | Use Case |
|------|-------|----------|
| **Local** | Glob, Grep, Read, Bash | Search files, codebase, directories |
| **Web** | WebSearch, WebFetch | Search online, fetch URLs |
| **Future** | Provider API (jina.ai, firecrawl, exa.ai) | Pluggable backends |

The skill auto-detects mode from the mission, or it can be explicitly specified.

### 7.3 Skill Definition

```yaml
---
name: search
description: |
  Generic search skill for finding and compiling information from various sources.
  Use when a workflow step needs to search for content without user-provided input files.

  Supports multiple search modes:
  - local: Search local filesystem using Glob, Grep, Read
  - web: Search web content (future: jina.ai, firecrawl, exa.ai integration)

  Trigger phrases:
  - "search for", "find", "look up"
  - "search the web", "search online", "fetch from URL"
  - "search files", "scan codebase", "find in project"
  - "get news from", "read hacker news"

  This skill can operate WITHOUT input files (input-less capable).
tools: Glob, Grep, Read, Bash, WebSearch, WebFetch
model: claude-sonnet-4-20250514
---
```

### 7.4 Process

1. **Parse Mission** - Extract search target and mode
2. **Determine Mode**:
   - File patterns, codebase, directory mentions → **Local**
   - URLs, websites, online, news → **Web**
   - Explicit mode in mission → Use specified
3. **Execute Search**:
   - Local: Glob → Grep → Read → Compile
   - Web: WebSearch → WebFetch → Parse → Compile
4. **Structure Output** - Create JSON with source attribution and results
5. **Write Output** - Write to specified output path

### 7.5 Output Schema

```json
{
  "query": "original search query/mission",
  "mode": "local | web",
  "results": [
    {
      "source": "path/to/file.ts | https://example.com/page",
      "type": "file | url",
      "title": "Optional title or filename",
      "content": "Extracted content or snippet",
      "relevance": 0.95,
      "metadata": {
        "lineNumber": 42,
        "matchContext": "surrounding context",
        "date": "2025-12-24"
      }
    }
  ],
  "summary": "Brief summary of findings",
  "totalMatches": 15,
  "compiledAt": "2025-12-24T10:30:00Z"
}
```

### 7.6 Future Provider Integration

The search skill is designed for pluggable backends:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH SKILL ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────┘

                    ┌───────────────────┐
                    │   search skill    │
                    │  (mission input)  │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
    │  Local Provider │ │ Web (Now) │ │ Future Providers│
    │  Glob, Grep,    │ │ WebSearch │ │ jina.ai         │
    │  Read, Bash     │ │ WebFetch  │ │ firecrawl       │
    └─────────────────┘ └───────────┘ │ exa.ai          │
                                      └─────────────────┘
```

Provider selection can be:
- **Auto-detected** from mission keywords
- **Explicit** via mission directive: `[mode: local]` or `[provider: jina]`

---

## 8. Workspace Structure

### 8.1 Sandbox Layout

```
~/.looplia/
├── sandbox/
│   └── {sandbox-id}/
│       ├── inputs/
│       │   ├── video1.md       # Named input
│       │   ├── video2.md       # Named input
│       │   ├── config.json     # JSON input
│       │   └── content.md      # Legacy single input (if --file used)
│       ├── outputs/
│       │   ├── analysis.json   # Step outputs
│       │   └── summary.json
│       ├── logs/
│       └── validation.json
└── workflows/
    ├── compare-videos.md
    └── hn-reporter.md
```

### 8.2 Sandbox ID Generation

| Mode | Pattern | Example |
|------|---------|---------|
| Named inputs | `{workflow-name}-{date}-{random4}` | `compare-videos-2025-12-24-x1y2` |
| Legacy --file | `{content-slug}-{date}-{random4}` | `my-video-2025-12-24-a3b4` |
| Input-less | `{workflow-name}-{date}-{random4}` | `hn-reporter-2025-12-24-c5d6` |

---

## 9. Type System Changes

### 9.1 New Types

**File:** `packages/core/src/domain/workflow.ts`

```typescript
/**
 * Declares an expected input for the workflow
 */
export type WorkflowInput = {
  name: string;           // Unique identifier (kebab-case)
  required: boolean;      // Is this input mandatory?
  description?: string;   // Human-readable description
  type?: 'file' | 'json'; // Optional type hint
};

/**
 * Updated workflow definition with optional inputs
 */
export type WorkflowDefinition = {
  name: string;
  version?: string;
  description: string;
  inputs?: WorkflowInput[];  // NEW: Optional inputs declaration
  steps: WorkflowStep[];
};

/**
 * Updated step with optional input (for input-less steps)
 */
export type WorkflowStep = {
  id: string;
  skill?: string;
  mission?: string;
  run?: string;
  input?: string | string[] | null;  // CHANGED: Now optional
  output: string;
  needs?: string[];
  model?: string;
  validate?: ValidationCriteria;
  final?: boolean;
};
```

### 9.2 Parser Changes

**File:** `packages/core/src/domain/workflow-parser.ts`

```typescript
// Skills that can operate without input
const INPUTLESS_CAPABLE_SKILLS = ['search'];

function validateStep(step: WorkflowStep, workflowInputs?: WorkflowInput[]): void {
  // ... existing id validation ...
  // ... existing skill/mission validation ...

  // v0.6.3: Input validation with input-less skill support
  const isInputlessCapable = step.skill &&
    INPUTLESS_CAPABLE_SKILLS.includes(step.skill);

  if (!step.input && !isInputlessCapable) {
    throw new Error(
      `Step '${step.id}' must have an 'input' field ` +
      `(or use an input-less capable skill)`
    );
  }

  // Validate ${{ inputs.name }} references exist
  if (step.input && workflowInputs) {
    validateInputReferences(step.input, workflowInputs);
  }

  // ... existing output validation ...
}

function validateInputReferences(
  input: string | string[],
  workflowInputs: WorkflowInput[]
): void {
  const inputs = Array.isArray(input) ? input : [input];
  const inputNames = new Set(workflowInputs.map(i => i.name));

  for (const inp of inputs) {
    const match = inp.match(/\$\{\{\s*inputs\.(\w+)\s*\}\}/);
    if (match && !inputNames.has(match[1])) {
      throw new Error(`Unknown input reference: $\{{ inputs.${match[1]} }}`);
    }
  }
}
```

---

## 10. Build Pipeline Updates

### 10.1 Plugin Registry Scanner

**File:** `plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.ts`

Add search capability patterns:
```typescript
export const CAPABILITY_PATTERNS: [string, string][] = [
  // Existing...
  ["analy", "content analysis"],
  ["review", "content analysis"],

  // NEW: Search patterns (local + web)
  ["search", "search and compile"],
  ["find", "search and compile"],
  ["scan", "search and compile"],
  ["fetch", "content retrieval"],
  ["web", "web search"],
  ["news", "web search"],
  ["codebase", "local search"],
  ["files", "local search"],
];
```

### 10.2 Skill Capability Matcher

**File:** `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md`

Add multi-input detection:
```markdown
## Recognizing Multi-Input Tasks

When analyzing requirements, detect:
- "compare X and Y" → 2 inputs
- "merge A, B, and C" → 3 inputs
- "X with Y" → 2 inputs

Output includes:
```json
{
  "suggestedInputs": [
    {
      "name": "video1",
      "required": true,
      "description": "First video"
    }
  ],
  "inputless": false
}
```
```

### 10.3 Workflow Schema Composer

**File:** `plugins/looplia-core/skills/workflow-schema-composer/SKILL.md`

Add inputs: generation:
```markdown
## Generate Inputs Declaration

If matcher suggests inputs:
```yaml
inputs:
  - name: {name}
    required: {required}
    description: {description}
```

## Reference Inputs in Steps

```yaml
steps:
  - id: step-id
    input: ${{ inputs.{name} }}
```
```

---

## 11. Implementation Steps

### 11.1 Implementation Order

| Phase | Components | Dependencies |
|-------|------------|--------------|
| 1 | Core types (WorkflowInput, update WorkflowStep) | None |
| 2 | Workflow parser (parse inputs:, validate) | Phase 1 |
| 3 | CLI (--input parsing, sandbox creation) | Phase 2 |
| 4 | Skill executor (variable resolution) | Phase 3 |
| 5 | Workflow executor skill updates | Phase 4 |
| 6 | Web-content-fetcher skill | None |
| 7 | Build pipeline updates | Phase 6 |
| 8 | Tests and documentation | All |

### 11.2 Phase Details

**Phase 1: Core Types**
- Add `WorkflowInput` type
- Add `inputs?` to `WorkflowDefinition`
- Make `input` optional in `WorkflowStep`

**Phase 2: Parser**
- Parse `inputs:` from YAML frontmatter
- Validate input names are unique
- Validate `${{ inputs.name }}` references
- Allow missing `input` for input-less skills

**Phase 3: CLI**
- Parse `--input name=value` flags
- Detect JSON vs file path
- Copy/write inputs to sandbox
- Validate required inputs

**Phase 4: Variable Resolution**
- Update skill-executor prompt
- Document `${{ inputs.name }}` pattern

**Phase 5: Workflow Executor**
- Update sandbox setup for multiple inputs
- Update step invocation for input-less

**Phase 6: Web Skill**
- Create `web-content-fetcher/SKILL.md`

**Phase 7: Build Pipeline**
- Update registry scanner patterns
- Update capability matcher
- Update schema composer

---

## 12. File Changes Summary

### 12.1 New Files

| File | Purpose |
|------|---------|
| `plugins/looplia-core/skills/search/SKILL.md` | Generic search skill (local + web) |

### 12.2 Modified Files

| File | Changes |
|------|---------|
| `packages/core/src/domain/workflow.ts` | Add WorkflowInput, update types |
| `packages/core/src/domain/workflow-parser.ts` | Parse inputs:, validate references |
| `apps/cli/src/commands/run.ts` | Parse --input flags, multi-input sandbox |
| `packages/provider/.../skill-executor.ts` | Document ${{ inputs }} resolution |
| `plugins/looplia-core/skills/workflow-executor/SKILL.md` | Multi-input sandbox setup |
| `plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.ts` | Web patterns |
| `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md` | Multi-input detection |
| `plugins/looplia-core/skills/workflow-schema-composer/SKILL.md` | Generate inputs: |
| `plugins/looplia-core/skills/workflow-schema-composer/SCHEMA.md` | Document inputs: |
| `packages/core/test/domain/workflow-parser.test.ts` | Multi-input tests |

---

## Success Criteria

1. **Input-less works:** `looplia run hn-reporter` (web search) and `looplia run todo-finder` (local search) work without --file
2. **Named inputs work:** `--input video1=v1.md --input video2=v2.md`
3. **JSON inputs work:** `--input config='{"key": "value"}'`
4. **Legacy works:** `--file content.md` for old workflows
5. **Validation works:** Required inputs enforced, unknown inputs warned
6. **Help shows inputs:** `looplia run workflow --help` lists expected inputs
7. **Build generates correctly:** `/build "compare two videos"` creates inputs: declaration
8. **Search skill works:** Both local (Glob/Grep/Read) and web (WebSearch/WebFetch) modes
9. **All tests pass**

---

## Example: Complete Workflow

### Build Command
```bash
looplia build "compare two videos and create a unified analysis"
```

### Generated Workflow
```yaml
---
name: compare-videos
version: 1.0.0
description: Compare two videos and create a unified analysis

inputs:
  - name: video1
    required: true
    description: First video to compare
  - name: video2
    required: true
    description: Second video to compare

steps:
  - id: analyze-first
    skill: media-reviewer
    mission: Deep analysis of the first video
    input: ${{ inputs.video1 }}
    output: ${{ sandbox }}/outputs/analysis1.json
    model: haiku
    validate:
      required_fields: [contentId, headline, keyThemes]

  - id: analyze-second
    skill: media-reviewer
    mission: Deep analysis of the second video
    input: ${{ inputs.video2 }}
    output: ${{ sandbox }}/outputs/analysis2.json
    model: haiku
    validate:
      required_fields: [contentId, headline, keyThemes]

  - id: compare
    skill: content-documenter
    mission: |
      Compare the two video analyses.
      Identify similarities, differences, and key insights.
      Create a unified summary.
    needs: [analyze-first, analyze-second]
    input:
      - ${{ steps.analyze-first.output }}
      - ${{ steps.analyze-second.output }}
    output: ${{ sandbox }}/outputs/comparison.json
    final: true
    validate:
      required_fields: [similarities, differences, insights]
---

# Compare Videos Workflow

Compare two videos and generate a unified analysis.

## Usage

```bash
looplia run compare-videos --input video1=first.md --input video2=second.md
```

## Inputs

- **video1** (required): First video to compare
- **video2** (required): Second video to compare
```

---

## Cross-References

- **Schema-in-Skill Architecture (v0.6.2):** See [DESIGN-0.6.2.md](./DESIGN-0.6.2.md)
- **Skills-First Architecture (v0.6.1):** See [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)
- **Context Injection:** See [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md)
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md)

---

*This document serves as the single source of truth for Looplia-Core v0.6.3 flexible input system and input-less workflows.*
