# Looplia-Core Architecture Design v0.6.0

> Steps-Based Workflow Schema with Deterministic Subagent Invocation
>
> **Version:** 0.6.0
> **Date:** 2025-12-20
> **Related:** [DESIGN-0.5.2.md](./DESIGN-0.5.2.md) | [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) | [GLOSSARY.md](./GLOSSARY.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Philosophy](#2-design-philosophy)
3. [Workflow Schema v0.6.0](#3-workflow-schema-v060)
4. [Subagent Invocation Protocol](#4-subagent-invocation-protocol)
5. [Variable Substitution](#5-variable-substitution)
6. [Execution Protocol](#6-execution-protocol)
7. [Migration from v0.5.2](#7-migration-from-v052)

---

## 1. Executive Summary

### Evolution from v0.5.2 to v0.6.0

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.5.2 | Plugin Separation | Two-plugin architecture, slash commands |
| **v0.6.0** | **Deterministic Execution** | **Steps-based workflow schema, explicit subagent mapping** |

### Key Architectural Changes

v0.6.0 introduces a GitHub Actions-inspired workflow schema that ensures deterministic subagent invocation:

| v0.5.x | v0.6.0 | Rationale |
|--------|--------|-----------|
| `outputs:` (object) | `steps:` (array) | Explicit ordering, clearer semantics |
| `agent:` | `run:` | Action-oriented verb, familiar syntax |
| `requires:` | `needs:` | GitHub Actions familiarity |
| `artifact:` | `output:` | Clearer semantics |
| Implicit paths | `${{ }}` syntax | Explicit variable substitution |

### Problem Solved

In v0.5.x, Claude sometimes used `subagent_type: "general-purpose"` instead of custom agent types because the mapping from `agent: content-analyzer` to `subagent_type: "content-analyzer"` was implicit.

v0.6.0 makes this mapping **explicit and deterministic** through:

1. **Explicit mapping table** in CLAUDE.md
2. **Action-oriented syntax** (`run: agents/content-analyzer`)
3. **Visual prohibition** against `general-purpose` fallback

---

## 2. Design Philosophy

### 2.1 Deterministic Subagent Invocation

> **Principle:** Every workflow step MUST invoke a specific custom subagent, never the general-purpose fallback.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  DETERMINISTIC SUBAGENT INVOCATION                          │
└─────────────────────────────────────────────────────────────────────────────┘

Workflow YAML:                         Task Tool Call:
┌─────────────────────────────┐        ┌─────────────────────────────────────┐
│ - id: summary               │        │ {                                   │
│   run: agents/content-      │───────▶│   "subagent_type": "content-        │
│       analyzer              │        │       analyzer",                    │
│                             │        │   "description": "Execute step:     │
│                             │        │       summary"                      │
└─────────────────────────────┘        │ }                                   │
                                       └─────────────────────────────────────┘

NEVER: subagent_type: "general-purpose"
```

### 2.2 GitHub Actions Familiarity

> **Principle:** Use familiar syntax patterns from GitHub Actions to improve LLM comprehension.

**GitHub Actions:**
```yaml
jobs:
  build:
    steps:
      - id: checkout
        uses: actions/checkout@v3
      - id: test
        run: npm test
        needs: checkout
```

**Looplia v0.6.0:**
```yaml
steps:
  - id: summary
    run: agents/content-analyzer
  - id: ideas
    run: agents/idea-generator
    needs: [summary]
```

### 2.3 Explicit Variable Substitution

> **Principle:** All dynamic values use explicit `${{ }}` syntax for clarity.

```yaml
input: ${{ sandbox }}/inputs/content.md          # Sandbox path
input: ${{ steps.summary.output }}               # Previous step output
```

---

## 3. Workflow Schema v0.6.0

### 3.1 Complete Schema

```yaml
---
name: workflow-name                    # Required: Workflow identifier
version: 1.0.0                         # Required: Semantic version
description: What this workflow does   # Required: Brief description

steps:                                 # Required: Ordered array of steps
  - id: step-one                       # Required: Unique step identifier
    run: agents/agent-name             # Required: Agent to execute
    input: ${{ sandbox }}/inputs/...   # Required: Input path(s)
    output: ${{ sandbox }}/outputs/... # Required: Output path
    validate:                          # Optional: Validation criteria
      required_fields: [field1]
      min_quotes: 3

  - id: step-two
    run: agents/another-agent
    needs: [step-one]                  # Optional: Dependencies
    input: ${{ steps.step-one.output }}
    output: ${{ sandbox }}/outputs/...
    final: true                        # Optional: Mark as final output
---

# Workflow Title

Markdown body with additional instructions...
```

### 3.2 Step Fields Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique step identifier (kebab-case) |
| `run` | string | Yes | Agent path: `agents/{name}` |
| `needs` | string[] | No | Step IDs this step depends on |
| `input` | string/string[] | Yes | Input file path(s) |
| `output` | string | Yes | Output file path |
| `validate` | object | No | Validation criteria |
| `final` | boolean | No | Mark as final output (triggers return) |

### 3.3 Validation Criteria

| Criterion | Type | Example |
|-----------|------|---------|
| `required_fields` | string[] | `[contentId, headline, tldr]` |
| `min_quotes` | number | `3` |
| `min_key_points` | number | `5` |
| `min_outline_sections` | number | `4` |
| `has_hooks` | boolean | `true` |

### 3.4 Example: Writing-Kit Workflow

```yaml
---
name: writing-kit
version: 1.0.0
description: Transform content into structured writing kit with summary, ideas, and outline

steps:
  - id: summary
    run: agents/content-analyzer
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    validate:
      required_fields: [contentId, headline, tldr, bullets, tags, sentiment, category, overview, keyThemes, detailedAnalysis, narrativeFlow, coreIdeas, importantQuotes, context, relatedConcepts]
      min_quotes: 3
      min_key_points: 5

  - id: ideas
    run: agents/idea-generator
    needs: [summary]
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json
    validate:
      required_fields: [contentId, hooks, angles, questions]
      has_hooks: true

  - id: writing-kit
    run: agents/writing-kit-builder
    needs: [summary, ideas]
    input:
      - ${{ steps.summary.output }}
      - ${{ steps.ideas.output }}
    output: ${{ sandbox }}/outputs/writing-kit.json
    final: true
    validate:
      required_fields: [contentId, source, summary, ideas, suggestedOutline, meta]
      min_outline_sections: 4
      has_hooks: true
---

# Writing Kit Workflow

Transform raw content into a comprehensive writing kit...
```

---

## 4. Subagent Invocation Protocol

### 4.1 Critical Mapping Rule

When a workflow step specifies `run: agents/{name}`, the Task tool MUST be invoked with:

```json
{
  "subagent_type": "{name}",
  "description": "Execute step: {step.id}",
  "prompt": "You are {name}. Read .claude/agents/{name}.md for your instructions..."
}
```

### 4.2 Mapping Table

| Workflow YAML | Task Tool `subagent_type` |
|---------------|---------------------------|
| `run: agents/content-analyzer` | `"content-analyzer"` |
| `run: agents/idea-generator` | `"idea-generator"` |
| `run: agents/writing-kit-builder` | `"writing-kit-builder"` |

### 4.3 Rules

1. **REQUIRED**: Extract agent name from `run: agents/{name}` and use as `subagent_type`
2. **FORBIDDEN**: Never use `"subagent_type": "general-purpose"` for workflow steps
3. **ALWAYS**: The subagent reads its definition from `.claude/agents/{name}.md`

### 4.4 Example Invocation

For step:
```yaml
- id: summary
  run: agents/content-analyzer
  input: ${{ sandbox }}/inputs/content.md
  output: ${{ sandbox }}/outputs/summary.json
```

Task tool call:
```json
{
  "subagent_type": "content-analyzer",
  "description": "Execute step: summary",
  "prompt": "You are content-analyzer. Read .claude/agents/content-analyzer.md for your instructions.\n\nInput: sandbox/article-2025-12-18-xk7m/inputs/content.md\nOutput: sandbox/article-2025-12-18-xk7m/outputs/summary.json\nSandbox: sandbox/article-2025-12-18-xk7m/"
}
```

---

## 5. Variable Substitution

### 5.1 Syntax

Variables use the `${{ expression }}` syntax, inspired by GitHub Actions.

### 5.2 Available Variables

| Variable | Resolves To | Example |
|----------|-------------|---------|
| `${{ sandbox }}` | `sandbox/{sandbox-id}` | `sandbox/article-2025-12-18-xk7m` |
| `${{ steps.{id}.output }}` | Output path of step `{id}` | `sandbox/.../outputs/summary.json` |

### 5.3 Resolution Examples

**Input:**
```yaml
input: ${{ sandbox }}/inputs/content.md
```

**Resolved (sandbox-id = article-2025-12-18-xk7m):**
```
sandbox/article-2025-12-18-xk7m/inputs/content.md
```

**Input:**
```yaml
input: ${{ steps.summary.output }}
```

**Resolved:**
```
sandbox/article-2025-12-18-xk7m/outputs/summary.json
```

---

## 6. Execution Protocol

### 6.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXECUTION PROTOCOL v0.6.0                            │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 1: Sandbox Setup
    │
    ▼
Phase 2: Workflow Parsing
    │
    ▼
Phase 3: Validation State Generation
    │
    ▼
Phase 4: Dependency Resolution (Topological Sort)
    │
    ▼
Phase 5: Step Execution Loop ─────────────────────┐
    │                                              │
    ├──▶ Check: validated? ──▶ YES ──▶ SKIP       │
    │              │                               │
    │              ▼ NO                            │
    │    Invoke Task tool                          │
    │    (subagent_type = agent name)              │
    │              │                               │
    │    Validate output                           │
    │              │                               │
    │    Update validation.json                    │
    │              │                               │
    └──────────────┴───────────────────────────────┘
    │
    ▼
Phase 6: Return Final Artifact
```

### 6.2 Dependency Resolution

Compute execution order using topological sort:

```
Input:
  summary:     { needs: [] }
  ideas:       { needs: [summary] }
  writing-kit: { needs: [summary, ideas] }

Computed order: [summary, ideas, writing-kit]
```

### 6.3 Step Execution Loop

```
FOR EACH step in dependency order:
    │
    ▼
┌─────────────────────────────────────────┐
│ Check: output exists AND validated?      │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼ YES           ▼ NO
    ┌─────────┐    ┌─────────────────────────────┐
    │ SKIP    │    │ 1. INVOKE Task tool:        │
    │ (done)  │    │    subagent_type: {agent}   │
    └─────────┘    │    (from run: agents/{agent})│
                   │                              │
                   │ 2. VALIDATE output           │
                   │                              │
                   │ 3. UPDATE validation.json    │
                   │                              │
                   │ 4. IF FAILED: retry (max 2x) │
                   └─────────────────────────────┘
```

---

## 7. Migration from v0.5.2

### 7.1 Schema Changes

**Before (v0.5.x):**
```yaml
outputs:
  summary:
    artifact: summary.json
    agent: content-analyzer
    requires: []
    validate:
      required_fields: [contentId]
```

**After (v0.6.0):**
```yaml
steps:
  - id: summary
    run: agents/content-analyzer
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    validate:
      required_fields: [contentId]
```

### 7.2 Migration Mapping

| v0.5.x | v0.6.0 |
|--------|--------|
| `outputs:` (object) | `steps:` (array) |
| Key name (e.g., `summary:`) | `id: summary` |
| `agent: content-analyzer` | `run: agents/content-analyzer` |
| `artifact: summary.json` | `output: ${{ sandbox }}/outputs/summary.json` |
| `requires: [...]` | `needs: [...]` |
| (implicit input) | `input: ${{ sandbox }}/inputs/...` |
| `final: true` | `final: true` (unchanged) |

### 7.3 Backward Compatibility

v0.6.0 is a **breaking change** for workflow YAML format. However:

- Existing sandbox data remains compatible
- validation.json structure unchanged
- Agent definitions unchanged
- Skills unchanged

### 7.4 Success Criteria

CI test should verify:
```
=== Checking subagent types ===
✓ content-analyzer subagent used
✓ idea-generator subagent used
✓ writing-kit-builder subagent used
✓ No general-purpose fallback
```

---

## Cross-References

- **Context Injection Flow:** See [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) for what gets loaded
- **Previous Version:** See [DESIGN-0.5.2.md](./DESIGN-0.5.2.md) for two-plugin architecture
- **Claude Code Plugins:** See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) for plugin reference
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md) for term definitions

---

*This document serves as the single source of truth for Looplia-Core v0.6.0 workflow schema.*
