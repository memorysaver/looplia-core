# Looplia-Core Architecture Design v0.5.1

> Workflow-as-Markdown: Generic Pipeline Interpretation with Validation Skills
>
> **Version:** 0.5.1
> **Date:** 2025-12-17
> **Related:** [GLOSSARY.md](./GLOSSARY.md) | [DESIGN-0.5.0.md](./DESIGN-0.5.0.md) | [AGENT-SKILLS.md](./AGENT-SKILLS.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Philosophy](#2-design-philosophy)
3. [Problem Analysis](#3-problem-analysis)
4. [Workflow-as-Markdown Architecture](#4-workflow-as-markdown-architecture)
5. [Validation Skill System](#5-validation-skill-system)
6. [Generic Workflow Interpreter](#6-generic-workflow-interpreter)
7. [CLI Command Updates](#7-cli-command-updates)
8. [Implementation Plan](#8-implementation-plan)
9. [Migration from v0.5.0](#9-migration-from-v050)
10. [Future: Build Command](#10-future-build-command)

---

## 1. Executive Summary

### Evolution from v0.5.0 to v0.5.1

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.5.0 | Reliability & Simplicity | Session Manifest, Architecture Refinement |
| **v0.5.1** | **Workflow Generalization** | **Workflow.md format, Validation Skill, Generic Interpreter** |

### Key Terminology Change

| v0.5.0 Term | v0.5.1 Term | Rationale |
|-------------|-------------|-----------|
| Pipeline | **Workflow** | More generic; supports future workflow types beyond pipelines |
| `pipelines/*.yaml` | `workflows/*.md` | YAML frontmatter + markdown instructions in single file |
| `session.json` with "done" | `validation.json` + skill | Validation-driven completion instead of status flags |

### Key Improvements

1. **Workflow.md Format** - YAML frontmatter (definition) + Markdown body (instructions) in single file
2. **Validation Skill** - Script-based validation using Anthropic's progressive disclosure model
3. **Generic CLAUDE.md** - Interpreter that can execute ANY workflow, not just writing-kit
4. **Simplified Outputs** - 2 outputs (summary + writing-kit) instead of 4

### Scope

| In Scope | Out of Scope (Deferred) |
|----------|------------------------|
| Workflow.md frontmatter format | Multi-workflow orchestration |
| Validation skill with scripts | Custom validation rule DSL |
| Generic workflow interpreter | Visual workflow editor |
| CLI `run <workflow-id>` | `build` command (v0.6.0) |
| No backward compatibility | Migration tooling |

---

## 2. Design Philosophy

### 2.1 Configuration-Driven Agent Behavior

> **Principle:** Workflow behavior is defined in configuration (workflow.md), not code. CLAUDE.md teaches HOW to interpret any workflow, not WHAT a specific workflow does.

**v0.5.0 Approach (Hardcoded):**
```typescript
// kit.ts - Steps hardcoded in prompt
"Step 1: analyzing → summary.json
 Step 2: generating_ideas → ideas.json
 Step 3: building_outline → outline.json
 Step 4: assembling_kit → writing-kit.json"
```

**v0.5.1 Approach (Configuration-Driven):**
```typescript
// workflow.ts - Generic prompt
"Read workflows/{name}.md to understand:
 - What outputs to produce (from frontmatter)
 - How to produce them (from markdown body)
 - How to validate them (from validate blocks)"
```

### 2.2 Validation-Driven Completion

> **Principle:** A step is complete when its output PASSES VALIDATION, not when it's marked "done".

**v0.5.0:** Binary status tracking
```json
{ "steps": { "analyzing": "done" } }
```

**v0.5.1:** Validation-driven completion
```json
{
  "summary": {
    "required_fields": ["contentId", "source", "themes"],
    "min_quotes": 3,
    "validated": true
  }
}
```

### 2.3 Progressive Disclosure for Validation

Following Anthropic's Agent Skills architecture, the validation skill uses three-level loading:

| Level | Content | Token Cost |
|-------|---------|------------|
| **Level 1** | Skill metadata (name, description) | ~100 tokens |
| **Level 2** | SKILL.md instructions | < 5k tokens |
| **Level 3** | `scripts/validate.ts` execution | 0 tokens (runs outside LLM) |

The validation script runs **outside the LLM context**, providing deterministic validation without consuming tokens.

---

## 3. Problem Analysis

### 3.1 Hardcoded Workflow Steps

**v0.5.0 Problem:**
```typescript
// kit.ts has hardcoded steps
function buildPrompt(ctx: PromptContext): string {
  return `Step 1 (summary): → Invoke content-analyzer
Step 2 (ideas): → Invoke idea-generator
Step 3 (writing-kit): → Invoke writing-kit-builder`;
}
```

**Issues:**
- Adding new workflow requires modifying TypeScript code
- Prompt duplicates what's in `pipelines/writing-kit.yaml`
- No single source of truth for workflow definition

**v0.5.1 Solution:** Workflow.md with frontmatter + instructions.

### 3.2 Status-Based vs Validation-Based Completion

**v0.5.0 Problem:**
```json
// session.json tracks "done" status
{ "steps": { "analyzing": "done" } }
```

**Issues:**
- Step marked "done" but artifact may be invalid
- No way to specify what "valid" means per step
- Agent must guess when output is acceptable

**v0.5.1 Solution:** Explicit validation criteria in frontmatter, verified by script.

### 3.3 Domain-Specific CLAUDE.md

**v0.5.0 Problem:**
```markdown
<!-- CLAUDE.md is writing-kit specific -->
# Task: Build Writing Kit
Step 1, Step 2, Step 3...
ContentSummary Schema: [17 fields]
```

**Issues:**
- CLAUDE.md only knows writing-kit workflow
- Adding new workflow requires rewriting CLAUDE.md
- No generic workflow interpretation capability

**v0.5.1 Solution:** Generic CLAUDE.md that interprets ANY workflow.md file.

---

## 4. Workflow-as-Markdown Architecture

### 4.1 Overview

A **Workflow** is defined as a single markdown file with:
- **YAML frontmatter**: Declarative output definitions with validation criteria
- **Markdown body**: Custom instructions for this specific workflow

### 4.2 Workflow.md Structure

```markdown
---
name: writing-kit
description: Transform content into structured writing kit

outputs:
  summary:
    artifact: summary.json
    agent: content-analyzer
    validate:
      required_fields: [contentId, source, themes, keyPoints, quotes]
      min_quotes: 3
      min_key_points: 5

  writing-kit:
    artifact: writing-kit.json
    agent: writing-kit-builder
    requires: [summary]
    final: true
    validate:
      required_fields: [contentId, source, summary, ideas, suggestedOutline, meta]
      min_outline_sections: 4
      has_hooks: true
---

# Writing Kit Workflow

## Purpose
Transform raw content into a structured writing kit with summary, ideas, and outline.

## Custom Instructions
- Read user-profile.json for personalization
- Calculate relevance scores based on user topics
- Generate 5 types of hooks: emotional, curiosity, controversy, statistic, story

## Output Schemas

### ContentSummary (summary.json)
- contentId: string
- source: { id, type, url }
- themes: string[]
- keyPoints: string[]
- quotes: { text, context, timestamp? }[]
...

### WritingKit (writing-kit.json)
- contentId: string
- source: WritingKitSource
- summary: ContentSummary
- ideas: WritingIdeas
- suggestedOutline: OutlineSection[]
- meta: WritingKitMeta

## Rules
- Preserve original meaning - no interpretation beyond source
- Extract verbatim quotes - no paraphrasing
- Document structure as-is
```

### 4.3 Frontmatter Schema

```typescript
/**
 * Validation criteria for a workflow output
 */
type ValidationCriteria = {
  /** Required top-level fields */
  required_fields?: string[];
  /** Minimum number of quotes in output */
  min_quotes?: number;
  /** Minimum number of key points */
  min_key_points?: number;
  /** Minimum outline sections */
  min_outline_sections?: number;
  /** Must have hooks array */
  has_hooks?: boolean;
  /** Extensible for custom validators */
  [key: string]: unknown;
};

/**
 * Single output in a workflow
 */
type WorkflowOutput = {
  /** Output filename (e.g., "summary.json") */
  artifact: string;
  /** Subagent responsible for producing this output */
  agent: string;
  /** Dependencies - other output names that must complete first */
  requires?: string[];
  /** Marks this as the final output */
  final?: boolean;
  /** Validation criteria */
  validate?: ValidationCriteria;
};

/**
 * Complete workflow definition (from YAML frontmatter)
 */
type WorkflowDefinition = {
  /** Unique workflow identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Map of output names to configurations */
  outputs: Record<string, WorkflowOutput>;
};
```

### 4.4 Parsed Workflow Structure

```typescript
/**
 * Complete parsed workflow from .md file
 */
type ParsedWorkflow = {
  /** Definition from YAML frontmatter */
  definition: WorkflowDefinition;
  /** Custom instructions from markdown body */
  instructions: string;
};
```

### 4.5 File Location

```
~/.looplia/
├── workflows/
│   └── writing-kit.md          # YAML frontmatter + markdown instructions
├── CLAUDE.md                    # Generic workflow interpreter
└── .claude/
    ├── agents/*.md              # Subagent definitions
    └── skills/
        └── workflow-validator/  # Validation skill
```

---

## 5. Validation Skill System

### 5.1 Overview

The **workflow-validator** skill validates output artifacts against criteria defined in the workflow frontmatter. It uses Anthropic's progressive disclosure model with a **script** that runs outside the LLM context.

### 5.2 Skill Structure

```
.claude/skills/workflow-validator/
├── SKILL.md                    # Level 2: Instructions
└── scripts/
    └── validate.ts             # Level 3: Deterministic script
```

### 5.3 SKILL.md Definition

```markdown
---
name: workflow-validator
description: |
  Validate workflow output artifacts against criteria from validation.json.
  Use after each subagent completes to verify the output meets requirements.
  Returns pass/fail with detailed check results.
---

# Workflow Validator

Validates JSON artifacts against validation criteria defined in the workflow.

## When to Use
- After each subagent writes an artifact
- Before marking an output as complete
- When resuming a workflow to verify existing artifacts

## Usage

1. Read `contentItem/{id}/validation.json` for criteria
2. Run validation script:
   ```bash
   bun scripts/validate.ts <artifact-path> '<criteria-json>'
   ```
3. Parse the JSON output for results
4. If failed: review error details, retry subagent if needed
5. If passed: continue to next output

## Script Output Format

```json
{
  "passed": true,
  "checks": [
    { "name": "has_contentId", "passed": true, "message": "OK" },
    { "name": "has_source", "passed": true, "message": "OK" },
    { "name": "min_quotes", "passed": true, "message": "Found 5 quotes (min: 3)" }
  ]
}
```

## Error Handling

If validation fails:
1. Review which checks failed
2. Determine if agent retry is appropriate
3. If structural issue, report to user
4. If content issue, retry subagent with guidance
```

### 5.4 Validation Script

**File:** `scripts/validate.ts`

```typescript
#!/usr/bin/env bun

import { readFile } from "node:fs/promises";

type ValidationResult = {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
};

async function validate(
  artifactPath: string,
  criteriaJson: string
): Promise<ValidationResult> {
  const data = JSON.parse(await readFile(artifactPath, "utf-8"));
  const criteria = JSON.parse(criteriaJson);

  const result: ValidationResult = {
    passed: true,
    checks: [],
  };

  // Check required_fields
  if (criteria.required_fields) {
    for (const field of criteria.required_fields) {
      const exists = field in data;
      result.checks.push({
        name: `has_${field}`,
        passed: exists,
        message: exists ? "OK" : `Missing required field: ${field}`,
      });
      if (!exists) result.passed = false;
    }
  }

  // Check min_quotes
  if (criteria.min_quotes !== undefined) {
    const quotes = data.quotes ?? data.summary?.quotes ?? [];
    const count = Array.isArray(quotes) ? quotes.length : 0;
    const passed = count >= criteria.min_quotes;
    result.checks.push({
      name: "min_quotes",
      passed,
      message: passed
        ? `Found ${count} quotes (min: ${criteria.min_quotes})`
        : `Only ${count} quotes, need at least ${criteria.min_quotes}`,
    });
    if (!passed) result.passed = false;
  }

  // Check min_key_points
  if (criteria.min_key_points !== undefined) {
    const keyPoints = data.keyPoints ?? [];
    const count = Array.isArray(keyPoints) ? keyPoints.length : 0;
    const passed = count >= criteria.min_key_points;
    result.checks.push({
      name: "min_key_points",
      passed,
      message: passed
        ? `Found ${count} key points (min: ${criteria.min_key_points})`
        : `Only ${count} key points, need at least ${criteria.min_key_points}`,
    });
    if (!passed) result.passed = false;
  }

  // Check min_outline_sections
  if (criteria.min_outline_sections !== undefined) {
    const outline = data.suggestedOutline ?? [];
    const count = Array.isArray(outline) ? outline.length : 0;
    const passed = count >= criteria.min_outline_sections;
    result.checks.push({
      name: "min_outline_sections",
      passed,
      message: passed
        ? `Found ${count} outline sections (min: ${criteria.min_outline_sections})`
        : `Only ${count} sections, need at least ${criteria.min_outline_sections}`,
    });
    if (!passed) result.passed = false;
  }

  // Check has_hooks
  if (criteria.has_hooks) {
    const hooks = data.ideas?.hooks ?? [];
    const hasHooks = Array.isArray(hooks) && hooks.length > 0;
    result.checks.push({
      name: "has_hooks",
      passed: hasHooks,
      message: hasHooks ? `Found ${hooks.length} hooks` : "No hooks found",
    });
    if (!hasHooks) result.passed = false;
  }

  return result;
}

// CLI entry point
const [artifactPath, criteriaJson] = process.argv.slice(2);

if (!artifactPath || !criteriaJson) {
  console.error("Usage: validate.ts <artifact-path> '<criteria-json>'");
  process.exit(1);
}

const result = await validate(artifactPath, criteriaJson);
console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);
```

### 5.5 validation.json Generation

When CLI starts a workflow, it generates `validation.json` from the frontmatter:

```json
{
  "workflow": "writing-kit",
  "outputs": {
    "summary": {
      "artifact": "summary.json",
      "criteria": {
        "required_fields": ["contentId", "source", "themes", "keyPoints", "quotes"],
        "min_quotes": 3,
        "min_key_points": 5
      },
      "validated": false
    },
    "writing-kit": {
      "artifact": "writing-kit.json",
      "criteria": {
        "required_fields": ["contentId", "source", "summary", "ideas", "suggestedOutline", "meta"],
        "min_outline_sections": 4,
        "has_hooks": true
      },
      "validated": false
    }
  }
}
```

### 5.6 Validation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VALIDATION FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

[1] CLI parses workflow.md frontmatter
    │
    ├─ Extracts validate blocks from each output
    └─ Generates contentItem/{id}/validation.json

[2] Agent invokes subagent (e.g., content-analyzer)
    │
    └─ Subagent writes artifact (summary.json)

[3] Agent uses workflow-validator skill
    │
    ├─ Reads validation.json for criteria
    ├─ Runs: bun scripts/validate.ts summary.json '{"required_fields":...}'
    └─ Receives: { "passed": true, "checks": [...] }

[4] If passed:
    │
    ├─ Agent updates validation.json: outputs.summary.validated = true
    └─ Agent proceeds to next output

[5] If failed:
    │
    ├─ Agent reviews failed checks
    ├─ Retries subagent with guidance OR
    └─ Reports issue to user
```

---

## 6. Generic Workflow Interpreter

### 6.1 Overview

CLAUDE.md becomes a **generic workflow interpreter** that can execute ANY workflow defined in `workflows/*.md`. It no longer contains writing-kit specific instructions.

### 6.2 CLAUDE.md Structure

```markdown
# Looplia Workflow Interpreter

You are a workflow execution agent. Your role is to read workflow definitions and execute them step by step, using validation to verify outputs.

## Workspace Structure

```
~/.looplia/
├── CLAUDE.md                    # This file (your instructions)
├── user-profile.json            # User preferences
├── workflows/                   # Workflow definitions
│   └── {workflow-id}.md           YAML frontmatter + instructions
├── .claude/
│   ├── agents/*.md              # Subagent definitions
│   └── skills/
│       └── workflow-validator/  # Validation skill
└── contentItem/{id}/
    ├── content.md               # Input content
    ├── validation.json          # Validation state (generated by CLI)
    └── *.json                   # Output artifacts
```

## Workflow File Format

Each workflow is a markdown file with YAML frontmatter:

```yaml
---
name: workflow-name
description: What this workflow does

outputs:
  output-name:
    artifact: output-file.json
    agent: subagent-name
    requires: [dependency-names]  # optional
    final: true                   # marks final output
    validate:
      required_fields: [field1, field2]
      min_quotes: 3
      # ... validation criteria
---

# Workflow Title

## Custom Instructions
[Workflow-specific behavior...]

## Output Schemas
[Schema documentation...]
```

## Your Execution Protocol

### Step 1: Read Workflow Definition

Read `workflows/{name}.md` and parse:
- **YAML frontmatter**: Output definitions, agents, dependencies, validation
- **Markdown body**: Custom instructions specific to this workflow

### Step 2: Check Validation State

Read `contentItem/{id}/validation.json`:
- See which outputs are required
- Check validation criteria for each
- Note which outputs have `validated: true`

### Step 3: Execute Outputs in Dependency Order

Build execution order from `requires` fields, then for each output:

1. **Check if already validated**:
   - If `validated: true` AND artifact exists → Skip

2. **Execute subagent**:
   - Read agent definition from `.claude/agents/{agent}.md`
   - Invoke as subagent with session context
   - Agent writes artifact to `contentItem/{id}/`

3. **Validate output**:
   - Use **workflow-validator** skill
   - Script checks artifact against criteria
   - Review results

4. **Handle result**:
   - If passed: Update `validation.json` with `validated: true`
   - If failed: Retry subagent or report issue

### Step 4: Return Final Output

When output marked `final: true` passes validation:
- Read its artifact file
- Return as structured output

## Key Skills

### workflow-validator
Validates artifacts against criteria from validation.json.
- Uses deterministic script (no LLM tokens consumed)
- Returns detailed check results

## Rules

1. **Always validate**: After every subagent, use workflow-validator
2. **Respect dependencies**: Never execute output before its requirements
3. **Update state**: Keep validation.json current after each step
4. **Read everything**: Parse full workflow before starting execution
```

### 6.3 Benefits of Generic Interpreter

| Benefit | Description |
|---------|-------------|
| **Single CLAUDE.md** | One interpreter for all workflows |
| **No code changes** | Add workflow by creating `workflows/foo.md` |
| **Self-documenting** | Workflow.md contains all behavior |
| **Validation-driven** | Clear completion criteria per output |
| **Extensible** | Add custom validation rules in scripts |

---

## 7. CLI Command Updates

### 7.1 Run Command

**Usage:**
```bash
looplia run <workflow-id> --file <path>
looplia run <workflow-id> --session-id <id>
```

**Examples:**
```bash
# New session
looplia run writing-kit --file ./article.txt

# Resume session
looplia run writing-kit --session-id article-2025-12-17-abc123
```

### 7.2 Command Flow

```
looplia run writing-kit --file article.txt
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Validate workflow exists                                                  │
│    Check: workflows/writing-kit.md exists                                    │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Parse workflow.md                                                         │
│    - Extract YAML frontmatter → WorkflowDefinition                          │
│    - Extract markdown body → Instructions                                    │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Create session                                                            │
│    - Generate session ID                                                     │
│    - Write contentItem/{id}/content.md                                       │
│    - Generate contentItem/{id}/validation.json from frontmatter             │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Build prompt                                                              │
│    - Include workflow definition                                             │
│    - Include custom instructions                                             │
│    - Include execution protocol                                              │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. Execute via AgentExecutor                                                 │
│    - Agent reads CLAUDE.md (generic interpreter)                             │
│    - Agent reads validation.json for state                                   │
│    - Agent executes outputs, validates each                                  │
│    - Agent returns final artifact                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Workflow Discovery

**Location:** `packages/provider/src/claude-agent-sdk/workspace.ts`

```typescript
/**
 * Discover available workflows in workspace
 */
export async function discoverWorkflows(workspaceDir: string): Promise<string[]> {
  const workflowsDir = join(workspaceDir, "workflows");

  try {
    const files = await readdir(workflowsDir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}
```

### 7.4 Help Text

```
looplia run - Execute a workflow on content

Usage:
  looplia run <workflow-id> --file <path> [options]
  looplia run <workflow-id> --session-id <id> [options]

Arguments:
  workflow-id      Name of workflow to run (e.g., writing-kit)
                   Available workflows are in ~/.looplia/workflows/

Options:
  --file, -f       Path to content file (creates new session)
  --session-id     Session ID to continue (resumes existing session)
  --format         Output format: json, markdown (default: json)
  --output, -o     Output file path (default: stdout)
  --no-streaming   Disable streaming UI
  --help, -h       Show this help

Examples:
  looplia run writing-kit --file ./article.txt
  looplia run writing-kit --session-id article-2025-12-17-abc123
```

---

## 8. Implementation Plan

### Phase 1: Core Types & Parser

| Task | File | Description |
|------|------|-------------|
| 1.1 | `packages/core/src/domain/workflow.ts` | WorkflowDefinition, ValidationCriteria types |
| 1.2 | `packages/core/src/domain/workflow-parser.ts` | Parse YAML frontmatter from .md files |
| 1.3 | `packages/core/src/validation/schemas.ts` | Zod schemas for workflow types |
| 1.4 | `packages/core/src/commands/types.ts` | Add workflowName, workflowPath to PromptContext |

### Phase 2: Validation Skill

| Task | File | Description |
|------|------|-------------|
| 2.1 | `plugins/looplia-writer/skills/workflow-validator/SKILL.md` | Skill instructions |
| 2.2 | `plugins/looplia-writer/skills/workflow-validator/scripts/validate.ts` | Validation script |

### Phase 3: Generic Workflow Command

| Task | File | Description |
|------|------|-------------|
| 3.1 | `packages/core/src/commands/workflow.ts` | Generic workflow prompt builder |
| 3.2 | `packages/core/src/commands/kit.ts` | DELETE - replaced by workflow.ts |
| 3.3 | `packages/core/src/commands/index.ts` | Update exports |

### Phase 4: CLI Updates

| Task | File | Description |
|------|------|-------------|
| 4.1 | `apps/cli/src/parsers/run-parser.ts` | Parse workflow-id argument |
| 4.2 | `apps/cli/src/commands/run.ts` | Route to executeWorkflow() |
| 4.3 | `apps/cli/src/runtime/looplia-runtime.ts` | Add executeWorkflow(), generate validation.json |

### Phase 5: Plugin Updates

| Task | File | Description |
|------|------|-------------|
| 5.1 | `plugins/looplia-writer/README.md` | Rewrite as generic interpreter |
| 5.2 | `plugins/looplia-writer/workflows/writing-kit.md` | Create workflow file |
| 5.3 | DELETE `plugins/looplia-writer/pipelines/` | Remove old YAML files |

### Phase 6: Workspace Bootstrap

| Task | File | Description |
|------|------|-------------|
| 6.1 | `packages/provider/src/claude-agent-sdk/workspace.ts` | Copy workflows/, validation skill |

---

## 9. Migration from v0.5.0

### 9.1 Breaking Changes

| v0.5.0 | v0.5.1 | Migration |
|--------|--------|-----------|
| `looplia run --file x.md` | `looplia run writing-kit --file x.md` | Add workflow-id argument |
| `pipelines/*.yaml` | `workflows/*.md` | Convert to frontmatter format |
| `session.json` | `validation.json` | Auto-generated by CLI |
| 4 outputs | 2 outputs | Simplified workflow |

### 9.2 No Backward Compatibility

v0.5.1 does **not** maintain backward compatibility with v0.5.0. Users must:

1. Run `looplia init` to get new workspace structure
2. Use new CLI syntax: `looplia run writing-kit --file x.md`
3. Existing sessions are not migrated

### 9.3 File Structure Changes

**v0.5.0:**
```
~/.looplia/
├── CLAUDE.md                    # Writing-kit specific
├── pipelines/
│   └── writing-kit.yaml         # YAML only
└── contentItem/{id}/
    └── session.json             # { steps: { "analyzing": "done" } }
```

**v0.5.1:**
```
~/.looplia/
├── CLAUDE.md                    # Generic interpreter
├── workflows/
│   └── writing-kit.md           # YAML frontmatter + markdown
├── .claude/skills/
│   └── workflow-validator/      # NEW
└── contentItem/{id}/
    └── validation.json          # { outputs: { summary: { validated: true } } }
```

---

## 10. Future: Build Command

### 10.1 Overview (v0.6.0)

The `build` command will help users create new workflows:

```bash
looplia build <workflow-name>
```

### 10.2 Scope

- Generate `workflows/<name>.md` with scaffold
- User creates agents manually
- No AI-assisted agent generation (keep simple)

### 10.3 Generated Scaffold

```markdown
---
name: my-workflow
description: TODO - describe what this workflow does

outputs:
  output-1:
    artifact: output-1.json
    agent: agent-name
    validate:
      required_fields: []
---

# My Workflow

## Purpose
TODO - describe the purpose

## Custom Instructions
TODO - add workflow-specific instructions

## Output Schemas
TODO - document expected schemas
```

---

## Cross-References

- **Previous Version:** See [DESIGN-0.5.0.md](./DESIGN-0.5.0.md) for v0.5.0 architecture
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md) for term definitions
- **Agent Skills Reference:** See [AGENT-SKILLS.md](./AGENT-SKILLS.md) for Anthropic SDK patterns
- **Agentic Concept:** See [AGENTIC_CONCEPT-0.3.md](./AGENTIC_CONCEPT-0.3.md) for agent system design

---

*This document serves as the single source of truth for Looplia-Core v0.5.1 architecture.*
