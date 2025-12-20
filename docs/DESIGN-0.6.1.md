# Looplia-Core Architecture Design v0.6.1

> AI-Assisted Workflow Builder with Skill Decomposition
>
> **Version:** 0.6.1
> **Date:** 2025-12-20
> **Related:** [DESIGN-0.6.0.md](./DESIGN-0.6.0.md) | [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) | [GLOSSARY.md](./GLOSSARY.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Philosophy](#2-design-philosophy)
3. [Skill Decomposition](#3-skill-decomposition)
4. [CLAUDE.md Integration](#4-claudemd-integration)
5. [CLI Command](#5-cli-command)
6. [Terminal UI (TUI)](#6-terminal-ui-tui)
7. [Data Flow](#7-data-flow)
8. [Implementation Guide](#8-implementation-guide)
9. [Testing Strategy](#9-testing-strategy)
10. [Universal Skill-Executor Architecture](#10-universal-skill-executor-architecture)

---

## 1. Executive Summary

### Evolution from v0.6.0 to v0.6.1

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.0 | Deterministic Execution | Steps-based workflow schema, explicit subagent mapping |
| **v0.6.1** | **Workflow Creation** | **AI-assisted workflow builder with skill decomposition** |

### What v0.6.1 Adds

v0.6.1 introduces `looplia build` - an interactive command that transforms natural language requirements into valid workflow definitions:

```
User: "I want to analyze YouTube videos and create blog outlines"
                                    │
                                    ▼
                         ┌──────────────────┐
                         │  looplia build   │
                         └────────┬─────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  ~/.looplia/workflows/  │
                    │  video-to-blog.md       │
                    └─────────────────────────┘
```

### Key Architectural Additions

| Component | Type | Purpose |
|-----------|------|---------|
| `skill-executor` | **Agent** | **Universal skill orchestrator for workflow steps** |
| `plugin-registry-scanner` | Skill | Discover available skills (primary) and agents (fallback) |
| `skill-capability-matcher` | Skill | Match requirements to skills |
| `workflow-schema-composer` | Skill | Generate valid workflow YAML with `skill:` steps |
| `commands/build.md` | Command | Slash command definition |
| `looplia build` | CLI Command | Interactive TUI entry point |

### Paradigm Shift: Skills-First

v0.6.1 introduces a **skills-first** paradigm where:

| Before (v0.6.0) | After (v0.6.1) |
|-----------------|----------------|
| Steps use `run: agents/X` | Steps use `skill: Y` (default) |
| Agents wrap skills | Skills run directly via skill-executor |
| Search agents first | **Search skills first**, agents as fallback |
| Many thin wrapper agents | ONE universal skill-executor |

### Design Pattern

Following the established looplia-core pattern, workflow building uses **skills directly** rather than a wrapper agent:

| Command | Pattern |
|---------|---------|
| `/run` | CLAUDE.md instructions + `workflow-executor` skill |
| `/build` | CLAUDE.md instructions + 3 builder skills |

This ensures consistency across all commands.

---

## 2. Design Philosophy

### 2.1 AI-First, Human-Refinable

> **Principle:** Use AI to transform natural language into structured workflows, then allow human refinement.

The build command embodies looplia's philosophy - using specialized skills orchestrated by CLAUDE.md instructions, consistent with how `/run` works.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI-FIRST WORKFLOW CREATION                            │
└─────────────────────────────────────────────────────────────────────────────┘

Traditional Approach:              Looplia v0.6.1 Approach:
┌─────────────────────────┐        ┌─────────────────────────────────────────┐
│ 1. Learn YAML schema    │        │ 1. Describe what you want              │
│ 2. Read agent docs      │        │ 2. AI generates workflow               │
│ 3. Write steps manually │        │ 3. Refine in visual editor             │
│ 4. Fix validation errors│        │ 4. Save and run                        │
└─────────────────────────┘        └─────────────────────────────────────────┘
         Tedious                              Natural
```

### 2.2 Skill Decomposition by Domain

> **Principle:** Break complex tasks into focused, reusable skills aligned with distinct domains.

| Domain | Skill | Responsibility |
|--------|-------|----------------|
| Discovery | `plugin-registry-scanner` | Know what's available (skills-first) |
| Analysis + Matching | `skill-capability-matcher` | Understand intent, recommend skills |
| Construction | `workflow-schema-composer` | Build valid workflow artifacts |
| Execution | `skill-executor` (agent) | Universal skill orchestrator |

### 2.3 Progressive Disclosure

> **Principle:** Skills follow Anthropic's three-level loading pattern for token efficiency.

| Level | When Loaded | Content |
|-------|-------------|---------|
| Level 1: Metadata | Always | YAML frontmatter (~100 tokens) |
| Level 2: Instructions | When triggered | SKILL.md body (<5k tokens) |
| Level 3: Resources | As needed | Scripts, templates (0 LLM tokens) |

### 2.4 Determinism Where Possible

> **Principle:** Use deterministic scripts for operations that don't require LLM reasoning.

```
plugin-registry-scanner:
├── SKILL.md                 # LLM instructions
└── scripts/
    └── scan-plugins.ts      # Deterministic file scanning (no tokens)
```

---

## 3. Skill Decomposition

### 3.1 Skill Architecture Overview

```
plugins/looplia-core/
├── agents/
│   └── skill-executor.md          # Universal skill orchestrator (NEW)
│
└── skills/
    ├── plugin-registry-scanner/   # Domain: Discovery (skills-first)
    │   ├── SKILL.md
    │   └── scripts/
    │       └── scan-plugins.ts
    │
    ├── skill-capability-matcher/  # Domain: Analysis + Matching (RENAMED)
    │   └── SKILL.md
    │
    └── workflow-schema-composer/  # Domain: Construction
        ├── SKILL.md
        ├── SCHEMA.md
        └── templates/
            └── workflow.md.template
```

### 3.2 Skill Naming Convention

> **Principle:** All looplia core skills include "looplia" in their description to ensure correct triggering.

Skills are triggered automatically based on the `description` field in the frontmatter. To prevent conflicts with other plugins and ensure Claude uses the right skills for looplia operations, all core skills follow this pattern:

```yaml
---
name: skill-name
description: |
  Looplia core skill for [purpose]. Use when [trigger conditions].
---
```

**Key elements:**
- Start with "Looplia core skill" or "Looplia workflow skill"
- Include specific trigger keywords (e.g., "building workflows", "scanning plugins")
- Mention the context (e.g., "Use with /build command")

---

### 3.3 Skill 1: plugin-registry-scanner

**Domain:** Discovery — Know what's available in the system

**Location:** `plugins/looplia-core/skills/plugin-registry-scanner/`

**Purpose:** Discover and catalog all agents and skills from installed plugins

**Reusability:** HIGH — Any meta-agent needing system capabilities

**Determinism:** PARTIAL — File scanning is deterministic, capability inference may use LLM

#### Frontmatter

```yaml
---
name: plugin-registry-scanner
description: |
  Looplia core skill for discovering available agents and skills from installed plugins.
  Use when building looplia workflows, matching capabilities, or listing available agents.
  Triggered by /build command or when user asks about available looplia agents.
---
```

#### Process

1. Scan `plugins/*/agents/*.md` for agent definitions
2. Scan `plugins/*/skills/*/SKILL.md` for skill definitions
3. Extract frontmatter metadata (name, description, model, tools, skills)
4. Infer capabilities from descriptions
5. Output structured registry JSON

#### Output Schema

```json
{
  "plugins": [
    {
      "name": "looplia-writer",
      "path": "plugins/looplia-writer",
      "agents": [
        {
          "name": "content-analyzer",
          "description": "Deep content analysis using media-reviewer skill",
          "model": "haiku",
          "tools": ["Read", "Write", "Skill"],
          "skills": ["media-reviewer", "content-documenter"],
          "capabilities": ["content analysis", "structured JSON output"]
        }
      ],
      "skills": [
        {
          "name": "media-reviewer",
          "description": "Deep content analysis (structure, themes, narrative)"
        }
      ]
    }
  ],
  "summary": {
    "totalPlugins": 2,
    "totalAgents": 3,
    "totalSkills": 7
  }
}
```

#### Script Interface

```bash
# Deterministic scan (no LLM tokens)
bun plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.ts

# Output: registry.json to stdout
```

---

### 3.4 Skill 2: skill-capability-matcher

**Domain:** Analysis + Matching — Understand intent, recommend skills

**Location:** `plugins/looplia-core/skills/skill-capability-matcher/`

**Purpose:** Parse natural language requirements and match to available skills (skills-first approach)

**Reusability:** HIGH — Any skill recommendation system

**Pattern:** Similar to `media-reviewer` (multi-step analysis process)

> **Note:** Renamed from `agent-capability-matcher` to reflect the skills-first paradigm. See [Section 10.9](#109-renamed-skills).

#### Frontmatter

```yaml
---
name: skill-capability-matcher
description: |
  Looplia core skill for matching user requirements to available skills.
  Use when building looplia workflows to determine which skills should handle each step.
  Analyzes natural language descriptions and recommends skill sequences with rationale.
  Triggered by /build command after plugin-registry-scanner.
  Skills-first: prioritizes skills over agents for workflow steps.
---
```

#### Process

1. **Parse Requirements**
   - Extract input type (video, article, transcript, etc.)
   - Identify processing goals (analyze, summarize, generate, etc.)
   - Determine output format (JSON, markdown, structured data)

2. **Load Registry**
   - Read plugin registry from `plugin-registry-scanner` output
   - Build capability index for matching
   - **Skills listed first, agents as fallback**

3. **Match Capabilities**
   - Score each **skill** by capability alignment (primary)
   - Fall back to agents only for complex multi-skill orchestration
   - Identify capability gaps

4. **Recommend Sequence**
   - Order skills by data flow dependencies
   - Suggest step names (kebab-case)
   - Provide rationale for each recommendation
   - Include `mission` descriptions for each step

5. **Flag Gaps**
   - Identify missing capabilities
   - Suggest custom skill creation if needed

#### Input

```json
{
  "description": "I want to analyze YouTube videos and create blog outlines",
  "registry": { /* output from plugin-registry-scanner (skills-first) */ }
}
```

#### Output Schema

```json
{
  "requirements": {
    "inputType": "video transcript",
    "goals": ["extract key points", "generate outline"],
    "outputFormat": "structured JSON with outline"
  },
  "recommendations": [
    {
      "skill": "media-reviewer",
      "suggestedStepId": "analyze-content",
      "matchScore": 0.92,
      "capabilities": ["content analysis", "deep understanding"],
      "mission": "Deep analysis of video transcript. Extract key themes, quotes, and narrative structure.",
      "rationale": "Primary analysis skill for understanding content"
    },
    {
      "skill": "idea-synthesis",
      "suggestedStepId": "generate-ideas",
      "matchScore": 0.85,
      "capabilities": ["idea generation", "hooks and angles"],
      "mission": "Generate hooks, angles, and questions from the analysis.",
      "rationale": "Generates creative angles from structured analysis"
    },
    {
      "skill": "content-documenter",
      "suggestedStepId": "build-outline",
      "matchScore": 0.88,
      "capabilities": ["structured output", "documentation"],
      "mission": "Create structured blog outline with sections and key points.",
      "rationale": "Transforms understanding into structured JSON output"
    }
  ],
  "suggestedSequence": ["analyze-content", "generate-ideas", "build-outline"],
  "dataFlow": {
    "analyze-content": { "needs": [], "provides": "analysis.json" },
    "generate-ideas": { "needs": ["analyze-content"], "provides": "ideas.json" },
    "build-outline": { "needs": ["analyze-content", "generate-ideas"], "provides": "outline.json" }
  },
  "gaps": [],
  "customSkillNeeded": false
}
```

---

### 3.5 Skill 3: workflow-schema-composer

**Domain:** Construction — Build valid workflow artifacts

**Location:** `plugins/looplia-core/skills/workflow-schema-composer/`

**Purpose:** Design workflow steps and generate valid YAML/Markdown

**Reusability:** MEDIUM — Workflow creation, editing, refactoring

**Pattern:** Similar to `content-documenter` (schema-driven output)

#### Frontmatter

```yaml
---
name: workflow-schema-composer
description: |
  Looplia core skill for generating valid workflow YAML/Markdown files.
  Use when building looplia workflows to compose the final workflow definition.
  Takes agent recommendations and creates v0.6.0 compliant workflow schema with steps,
  dependencies, and validation criteria. Triggered by /build command after skill-capability-matcher.
---
```

#### Process

1. **Receive Inputs**
   - Skill sequence from `skill-capability-matcher`
   - Original user requirements
   - Workflow name (derived or specified)

2. **Design Steps**
   - Create step IDs (kebab-case, meaningful)
   - Map steps to skills (`skill: {name}`) with mission descriptions
   - Design input/output paths using `${{ }}` variables

3. **Resolve Dependencies**
   - Set `needs:` based on data flow
   - Ensure topological ordering is valid

4. **Suggest Validation**
   - Add `validate:` criteria per step
   - Use patterns from similar workflows

5. **Compose YAML**
   - Generate frontmatter with metadata
   - Format steps array correctly

6. **Generate Markdown Body**
   - Add workflow description
   - Include usage instructions

7. **Output Complete File**
   - Return workflow markdown ready to save

#### Embedded Knowledge

The skill contains complete knowledge of:

- Workflow schema v0.6.0 format
- Variable substitution: `${{ sandbox }}`, `${{ steps.{id}.output }}`
- Validation criteria options (required_fields, min_quotes, etc.)
- Dependency resolution algorithm
- Step design best practices

#### Input

```json
{
  "name": "video-to-blog",
  "description": "Analyze YouTube videos and create blog outlines",
  "matcherOutput": { /* output from skill-capability-matcher */ }
}
```

#### Output

Complete workflow markdown file:

```markdown
---
name: video-to-blog
version: 1.0.0
description: Analyze YouTube videos and create blog outlines with key points

steps:
  - id: analyze-content
    run: agents/content-analyzer
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/analysis.json
    validate:
      required_fields: [contentId, headline, tldr, bullets]
      min_key_points: 5

  - id: generate-ideas
    run: agents/idea-generator
    needs: [analyze-content]
    input: ${{ steps.analyze-content.output }}
    output: ${{ sandbox }}/outputs/ideas.json
    validate:
      required_fields: [contentId, hooks, angles]
      has_hooks: true

  - id: build-outline
    run: agents/writing-kit-builder
    needs: [analyze-content, generate-ideas]
    input:
      - ${{ steps.analyze-content.output }}
      - ${{ steps.generate-ideas.output }}
    output: ${{ sandbox }}/outputs/outline.json
    final: true
    validate:
      required_fields: [contentId, suggestedOutline]
      min_outline_sections: 4
---

# Video to Blog Workflow

Transform video content into structured blog outlines.

## Usage

```bash
looplia run video-to-blog --file <transcript.md>
```

## Steps

1. **analyze-content**: Deep analysis of video transcript
2. **generate-ideas**: Extract hooks, angles, and questions
3. **build-outline**: Create structured blog outline
```

---

### 3.6 Updating Existing Core Skills

The existing looplia-core skills should also be updated to follow the naming convention:

#### workflow-executor (Update)

```yaml
---
name: workflow-executor
description: |
  Looplia core skill for executing workflow-as-markdown definitions.
  Use when running looplia workflows with /run command.
  Handles sandbox management, step execution, and validation state tracking.
  Orchestrates subagent invocations for multi-step workflow execution.
---
```

#### workflow-validator (Update)

```yaml
---
name: workflow-validator
description: |
  Looplia core skill for validating workflow step outputs.
  Use when validating JSON artifacts against looplia workflow criteria.
  Provides deterministic validation without consuming LLM tokens.
  Automatically triggered after each workflow step writes output.
---
```

---

### 3.7 Skill Comparison with Existing Skills

| New Skill | Pattern From | Similarity |
|-----------|--------------|------------|
| `plugin-registry-scanner` | `workflow-validator` | Deterministic script for file operations |
| `skill-capability-matcher` | `media-reviewer` | Multi-step analysis with structured output |
| `workflow-schema-composer` | `content-documenter` | Schema-driven output generation |

---

## 4. CLAUDE.md Integration

### 4.1 Pattern Consistency

Workflow building follows the same pattern as workflow execution:

| Command | Orchestration | Skills Used |
|---------|---------------|-------------|
| `/run` | CLAUDE.md instructions | `workflow-executor`, `workflow-validator` |
| `/build` | CLAUDE.md instructions | `plugin-registry-scanner`, `skill-capability-matcher`, `workflow-schema-composer` |

**No wrapper agent needed** - Claude uses skills directly based on CLAUDE.md instructions.

### 4.2 Skill Invocation Protocol

> **Critical:** Skills MUST be invoked explicitly using the Skill tool. Do NOT rely on automatic skill triggering.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXPLICIT SKILL INVOCATION                                │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Skill("plugin-registry-scanner")
        └── Output: Registry JSON (skills-first, held in context)

Step 2: Skill("skill-capability-matcher")
        └── Input: User requirements + Registry JSON from Step 1
        └── Output: Skill sequence JSON with missions (held in context)

Step 3: Skill("workflow-schema-composer")
        └── Input: Requirements + Skill sequence from Step 2
        └── Output: Complete workflow markdown (with skill: steps)
```

**Rules:**
- **ALWAYS** invoke skills in sequence (1 → 2 → 3)
- **NEVER** skip skills or change order
- **ALWAYS** pass previous skill output as context to next skill
- **NEVER** rely on automatic skill triggering based on description

### 4.3 Inter-Skill Data Flow

Data passes between skills via Claude's context window (not files):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW PROTOCOL                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. plugin-registry-scanner
   └── Outputs: Registry JSON to context (skills listed first)
   └── Claude holds: { skills: [...], agents: [...], summary: {...} }

2. skill-capability-matcher
   └── Receives: User description + Registry JSON (from context)
   └── Outputs: Matcher result JSON to context (skill recommendations)
   └── Claude holds: { requirements: {...}, recommendations: [...], missions: {...} }

3. workflow-schema-composer
   └── Receives: Requirements + Matcher result (from context)
   └── Outputs: Complete workflow markdown with skill: steps
   └── Claude returns: { filename: "...", content: "..." }
```

**Why context-based (not file-based):**
- Simpler implementation
- No temp file cleanup needed
- Natural for LLM orchestration
- Skills are read-only (no file writes during build)

### 4.4 Error Handling Protocol

Define behavior for failure scenarios:

| Scenario | Detection | Response |
|----------|-----------|----------|
| No plugins installed | `summary.totalAgents === 0` | Error: "No agents found. Install looplia-writer plugin first." |
| No matching agents | `recommendations.length === 0` | Warning: Show gaps, offer partial workflow or cancel |
| Capability gaps | `gaps.length > 0` | Warning: "No agent for: {gaps}. Proceed with partial?" |
| Invalid YAML generated | Parse error | Retry generation with explicit schema reminder |
| User cancels | Ctrl+C / Esc | Clean exit, no partial files written |

**Capability Gap Handling:**

```
When gaps are detected:
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠ Capability Gap Detected                                                   │
│                                                                              │
│  No agent found for: "pdf-extraction"                                        │
│                                                                              │
│  Options:                                                                    │
│  [p] Proceed with partial workflow (skip this capability)                    │
│  [c] Cancel build                                                            │
│  [?] Show available agents                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 CLAUDE.md Additions

Add this section to `plugins/looplia-core/CLAUDE.md`:

```markdown
## Workflow Building

When you receive a `/build` command, create a workflow from natural language requirements.

### Build Protocol

1. **Use plugin-registry-scanner skill**
   - Scan installed plugins for available skills (primary) and agents (fallback)
   - Output: Registry JSON with capabilities (skills listed first)

2. **Use skill-capability-matcher skill**
   - Analyze user requirements
   - Match to available skills from registry
   - Output: Recommended skill sequence with missions

3. **Use workflow-schema-composer skill**
   - Design workflow steps based on skill sequence
   - Generate valid v0.6.1 YAML/Markdown with `skill:` steps
   - Output: Complete workflow file

### Build Rules

- **ALWAYS** scan registry first (skills-first approach)
- **ALWAYS** match user intent to skill capabilities before composing
- **ALWAYS** generate workflows with `skill:` steps by default
- **ALWAYS** save to `~/.looplia/workflows/{name}.md`

### Output

Return workflow definition with:
- Suggested filename (kebab-case)
- Complete workflow markdown content
```

### 4.6 Slash Command Definition

**Location:** `plugins/looplia-core/commands/build.md`

> **Note:** The slash command description also includes "looplia" to ensure proper context.

```markdown
---
description: Build a looplia workflow from natural language requirements
---

# Build Looplia Workflow

Create a complete looplia workflow definition from a natural language description.

## Usage

```
/build [description]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `description` | (Optional) What the workflow should do |

## Execution

1. **Gather requirements**
   - If no description provided, ask user what they want
   - Clarify input types and expected outputs

2. **Use plugin-registry-scanner skill**
   - Discover available skills (primary) and agents (fallback)
   - Build capability inventory (skills-first)

3. **Use skill-capability-matcher skill**
   - Match requirements to skills
   - Get recommended skill sequence with missions

4. **Use workflow-schema-composer skill**
   - Generate complete workflow YAML/Markdown with `skill:` steps
   - Include validation criteria and missions

5. **Save workflow**
   - Write to `~/.looplia/workflows/{name}.md`
   - Report success with run command example

## Example

```
/build I want to analyze YouTube videos and create blog outlines
```

Output:
```
Created workflow: ~/.looplia/workflows/video-to-blog.md

Run with:
  looplia run video-to-blog --file <transcript.md>
```
```

### 4.7 Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW BUILD EXECUTION                              │
└─────────────────────────────────────────────────────────────────────────────┘

Input: "/build analyze YouTube videos and create blog outlines"
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Claude reads CLAUDE.md + commands/build.md                                   │
│ Understands: Use 3 skills in sequence                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ Skill tool:         │  │ Skill tool:         │  │ Skill tool:         │
│ plugin-registry-    │  │ skill-capability-   │  │ workflow-schema-    │
│ scanner             │──▶│ matcher             │──▶│ composer            │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ Output: Registry    │  │ Output: Skill       │  │ Output: Workflow    │
│ (skills, agents)    │  │ sequence + missions │  │ (skill: steps)      │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Write to ~/.looplia/workflows/video-to-blog.md                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. CLI Command

### 5.1 Entry Points Clarification

There are TWO entry points for workflow building:

| Entry Point | Context | UI | Use Case |
|-------------|---------|-----|----------|
| `looplia build` | Terminal CLI | TUI (Ink) | Interactive workflow creation |
| `/build` | Claude Code session | Text-based | Quick build inside Claude Code |

**Relationship:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENTRY POINT RELATIONSHIP                              │
└─────────────────────────────────────────────────────────────────────────────┘

looplia build (CLI)                    /build (Slash Command)
      │                                      │
      ▼                                      ▼
┌─────────────────┐                  ┌─────────────────┐
│ TUI Application │                  │ Claude Code     │
│ (React/Ink)     │                  │ Session         │
└────────┬────────┘                  └────────┬────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              Claude Agent (reads CLAUDE.md + commands/build.md)              │
│                    Uses 3 skills in sequence                                 │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
   TUI Preview + Save                  Text output + Write
```

### 5.2 Command Specification

**Location:** `apps/cli/src/commands/build.ts`

```bash
looplia build [description] [options]
```

### 5.3 Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `description` | string (optional) | Natural language workflow description |

### 5.4 Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--output`, `-o` | string | `~/.looplia/workflows/` | Output directory |
| `--name`, `-n` | string | (derived) | Workflow filename |
| `--no-interactive` | boolean | false | Skip TUI, batch mode |

### 5.5 Examples

```bash
# Interactive TUI (default)
looplia build

# Pre-fill description (still shows TUI for preview)
looplia build "analyze videos and create blog outlines"

# Custom output location
looplia build --output ./my-workflows/

# Non-interactive batch mode
looplia build "analyze videos" --no-interactive --name video-analyzer
```

### 5.6 Output Location

**Default:** `~/.looplia/workflows/`

This global workspace allows workflows to be shared across projects. Users can override with `--output` for project-local workflows.

**Clarification:** User-created workflows go to `~/.looplia/workflows/`. Plugin-bundled workflows stay in `plugins/{plugin}/workflows/`. These are separate locations.

```
~/.looplia/
├── sandbox/                    # Execution sandboxes
├── workflows/                  # Generated workflows (v0.6.1)
│   ├── video-to-blog.md
│   ├── research-summary.md
│   └── content-pipeline.md
└── config.json                 # User configuration
```

---

## 6. Terminal UI (TUI)

### 6.1 TUI-Claude Integration

The TUI coordinates with Claude agent for workflow generation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TUI-CLAUDE INTEGRATION                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TUI Phase 1   │────▶│   TUI Phase 2   │────▶│   TUI Phase 3   │
│  Requirements   │     │   Processing    │     │    Preview      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ createClaudeAgentExecutor()
                    │ executePromptStreaming()
                    └────────────┬───────────┘
                                 │
                    ┌────────────▼───────────┐
                    │ Streaming Events:      │
                    │ - ToolStartEvent       │◀── Skill invocations
                    │ - TextEvent            │◀── Progress messages
                    │ - CompleteEvent        │◀── Final workflow
                    └────────────────────────┘
```

**Integration Flow:**

1. **TUI Phase 1** collects user description
2. **TUI Phase 2** calls `executePromptStreaming("/build {description}")`
3. **TUI** receives streaming events:
   - `ToolStartEvent` → Update progress ("Scanning plugins...")
   - `TextEvent` → Show Claude's reasoning
   - `CompleteEvent` → Extract workflow from result
4. **TUI Phase 3** parses workflow JSON from Claude's response
5. **TUI Phase 4** writes file and shows confirmation

### 6.2 Component Architecture (MVP)

```
apps/cli/src/components/build/
├── index.tsx                   # BuildApp coordinator
├── phases/
│   ├── requirements-phase.tsx  # Phase 1: Text input
│   ├── processing-phase.tsx    # Phase 2: AI processing
│   ├── preview-phase.tsx       # Phase 3: Preview (read-only)
│   └── save-phase.tsx          # Phase 4: Confirm + save
├── step-card.tsx               # Individual step display
└── yaml-viewer.tsx             # Raw YAML preview

# Deferred to v0.6.2:
# ├── step-editor.tsx           # Edit step modal
```

### 6.3 State Machine

```typescript
type BuildPhase =
  | 'requirements'   // User typing description
  | 'processing'     // AI generating workflow
  | 'preview'        // Viewing generated workflow (MVP: read-only)
  | 'save'           // Confirming save location
  | 'complete'       // Success state
  | 'error';         // Error recovery

type BuildState = {
  phase: BuildPhase;
  description: string;
  progressMessages: string[];
  workflow: WorkflowDefinition | null;
  savePath: string;
  error: Error | null;
};
```

> **MVP Scope:** For v0.6.1, the preview phase is **read-only**. Editing capabilities (add/edit/remove steps) are deferred to v0.6.2.

### 6.4 Phase Flow (MVP)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: REQUIREMENTS                                                       │
│                                                                              │
│  What should this workflow do?                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Analyze YouTube videos and generate blog post outlines                 │  │
│  │ with key quotes and talking points                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  [Enter] Continue   [Ctrl+C] Cancel                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: PROCESSING                                                         │
│                                                                              │
│  ⠙ Designing your workflow...                                                │
│                                                                              │
│  ✓ Scanned plugin registry (3 agents, 7 skills)                              │
│  ✓ Matched requirements to agents                                            │
│  ⠙ Composing workflow structure...                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: PREVIEW (Read-Only for MVP)                                        │
│                                                                              │
│  video-to-blog (3 steps)                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. analyze-content                                                     │  │
│  │    Agent: content-analyzer                                             │  │
│  │    Output: analysis.json                                               │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ 2. generate-ideas                                                      │  │
│  │    Agent: idea-generator                                               │  │
│  │    Needs: analyze-content                                              │  │
│  │    Output: ideas.json                                                  │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ 3. build-outline                                [FINAL]                │  │
│  │    Agent: writing-kit-builder                                          │  │
│  │    Needs: analyze-content, generate-ideas                              │  │
│  │    Output: outline.json                                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  [y] View YAML   [s] Save   [r] Regenerate   [c] Cancel                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: SAVE                                                               │
│                                                                              │
│  Workflow name: video-to-blog                                                │
│  Location: ~/.looplia/workflows/video-to-blog.md                             │
│                                                                              │
│  ✅ Saved successfully!                                                       │
│                                                                              │
│  Run with:                                                                   │
│  looplia run video-to-blog --file <your-content.md>                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Keyboard Controls (MVP)

| Phase | Key | Action |
|-------|-----|--------|
| Requirements | `Enter` | Continue to processing |
| Requirements | `Ctrl+C` | Cancel |
| Preview | `y` | View raw YAML |
| Preview | `s` | Save workflow |
| Preview | `r` | Regenerate (restart from Phase 1) |
| Preview | `c` / `Esc` | Cancel |

> **Future (v0.6.2):** Add editing capabilities: `[e]` Edit step, `[+]` Add step, `[-]` Remove step

### 6.6 Pre-Save Validation

Before saving the generated workflow, validate it to catch errors early:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRE-SAVE VALIDATION                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Generated Workflow
       │
       ▼
┌─────────────────────┐
│ 1. YAML Syntax      │──▶ Parse frontmatter, check for syntax errors
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│ 2. Schema Validation│──▶ Validate against WorkflowDefinition schema
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│ 3. Agent Existence  │──▶ Verify all `run: agents/{name}` reference real agents
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│ 4. Dependency Check │──▶ Run getExecutionOrder() to detect cycles
└─────────────────────┘
       │
       ▼
   Save or Show Errors
```

**Validation Checks:**

| Check | Method | Error Message |
|-------|--------|---------------|
| YAML syntax | `parseWorkflow()` | "Invalid YAML syntax: {details}" |
| Required fields | Schema validation | "Missing required field: {field}" |
| Agent existence | Glob for agent files | "Agent not found: {name}" |
| Circular deps | `getExecutionOrder()` | "Circular dependency detected: {cycle}" |
| Step ID uniqueness | Set comparison | "Duplicate step ID: {id}" |

**On validation failure:** Show error in TUI, offer to regenerate or cancel.

---

## 7. Data Flow

### 7.1 Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE DATA FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

User Input: "I want to analyze YouTube videos and create blog outlines"
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TUI Phase 1: Requirements                                                    │
│ Output: { description: "I want to analyze..." }                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Claude reads CLAUDE.md + commands/build.md                                   │
│ Orchestrates skills directly (no wrapper agent)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ Skill tool:         │  │ Skill tool:         │  │ Skill tool:         │
│ plugin-registry-    │  │ skill-capability-   │  │ workflow-schema-    │
│ scanner             │  │ matcher             │  │ composer            │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ Input:              │  │ Input:              │  │ Input:              │
│ - Plugin directories│  │ - Description       │  │ - Skill sequence    │
│                     │  │ - Registry          │  │ - Requirements      │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ Output:             │  │ Output:             │  │ Output:             │
│ - Registry JSON     │──▶│ - Skill sequence    │──▶│ - Workflow markdown │
│   (skills, agents)  │  │ - Missions          │  │   (skill: steps)    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TUI Phase 3: Preview                                                         │
│ Display workflow, allow edits                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TUI Phase 4: Save                                                            │
│ Write to: ~/.looplia/workflows/video-to-blog.md                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Skill Chaining

```
plugin-registry-scanner ──────────────────┐
        │                                  │
        │ Registry JSON (skills-first)     │
        ▼                                  │
skill-capability-matcher                   │
        │                                  │
        │ Skill sequence + missions        │
        ▼                                  ▼
workflow-schema-composer ◀─────── (both inputs)
        │
        │ Complete workflow markdown
        │ (with skill: steps)
        ▼
    Output file
```

---

## 8. Implementation Guide

### 8.1 File Structure

```
looplia-core/
├── plugins/looplia-core/
│   ├── CLAUDE.md                            # MODIFY: Add build instructions
│   ├── agents/
│   │   └── skill-executor.md                # NEW: Universal skill orchestrator
│   ├── commands/
│   │   ├── run.md
│   │   ├── build.md                         # NEW: Replace build-workflow.md
│   │   └── list-workflows.md
│   └── skills/
│       ├── workflow-executor/
│       │   └── SKILL.md                     # MODIFY: Add "Looplia" + skill: support
│       ├── workflow-validator/
│       │   └── SKILL.md                     # MODIFY: Add "Looplia" to description
│       ├── plugin-registry-scanner/         # NEW: Discovery skill (skills-first)
│       │   ├── SKILL.md
│       │   └── scripts/
│       │       └── scan-plugins.ts
│       ├── skill-capability-matcher/        # NEW: Matching skill (renamed)
│       │   └── SKILL.md
│       └── workflow-schema-composer/        # NEW: Composition skill
│           ├── SKILL.md
│           └── SCHEMA.md
│
├── apps/cli/src/
│   ├── index.ts                             # MODIFY: Add build command
│   ├── commands/
│   │   └── build.ts                         # NEW: Command entry
│   └── components/build/
│       ├── index.tsx                        # NEW: TUI coordinator
│       ├── phases/
│       │   ├── requirements-phase.tsx       # NEW
│       │   ├── processing-phase.tsx         # NEW
│       │   ├── preview-phase.tsx            # NEW
│       │   └── save-phase.tsx               # NEW
│       ├── step-card.tsx                    # NEW
│       ├── step-editor.tsx                  # NEW
│       └── yaml-viewer.tsx                  # NEW
│
└── docs/
    └── DESIGN-0.6.1.md                      # This document
```

### 8.2 Implementation Order

| Phase | Components | Dependencies |
|-------|------------|--------------|
| 1 | New Skills (3) + Update existing skills | None |
| 2 | CLAUDE.md + commands/build.md | Skills |
| 3 | CLI Command | CLAUDE.md |
| 4 | TUI Components | CLI Command |
| 5 | Integration | All above |

### 8.3 Phase 1: Skills + Skill-Executor Agent

**New Agent:**
1. `skill-executor` - Universal skill orchestrator

**New Skills (in order):**
1. `plugin-registry-scanner` - Skills-first discovery
2. `skill-capability-matcher` - Match requirements to skills (renamed)
3. `workflow-schema-composer` - Generate workflows with `skill:` steps

**Update Existing Skills:**
1. `workflow-executor` - Add "Looplia core skill" + support for `skill:` steps
2. `workflow-validator` - Add "Looplia core skill" to description

Each skill follows the established pattern:
- YAML frontmatter with `name`, `description`, `tools` (optional), `model` (optional)
- Markdown body with process steps
- JSON schema examples for input/output

### 8.4 Phase 2: CLAUDE.md + Command

Update `plugins/looplia-core/CLAUDE.md` with:
- Build protocol section
- Build rules
- Skill usage instructions

Create `plugins/looplia-core/commands/build.md` with:
- Slash command definition
- Execution steps
- Example usage

### 8.5 Phase 3: CLI Command

Create `apps/cli/src/commands/build.ts` following `run.ts` pattern:
- Argument parsing
- Environment validation
- Mode detection (interactive vs batch)

### 8.6 Phase 4: TUI Components

Use existing Ink patterns from `streaming-query-ui.tsx`:
- React 19 with Ink 6.5.1
- useReducer for state management
- Keyboard input handling

### 8.7 Phase 5: Integration

- Add `build` case to CLI router in `index.ts`
- Update documentation
- Test end-to-end flow

---

## 9. Testing Strategy

### 9.1 Test Categories

| Category | Scope | Location |
|----------|-------|----------|
| Unit Tests | Individual functions | `packages/core/test/`, `apps/cli/test/` |
| Skill Tests | Skill invocation with mocked Claude | `plugins/looplia-core/test/` |
| Integration Tests | Multi-skill flow | `apps/cli/test/integration/` |
| E2E Tests | Full CLI command | `apps/cli/test/e2e/` |

### 9.2 Unit Tests

**scan-plugins.ts script:**
```typescript
// plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.test.ts
describe('scan-plugins', () => {
  it('should find all agent files in plugins directory');
  it('should extract frontmatter from agent files');
  it('should handle missing plugins directory gracefully');
  it('should return empty array when no agents found');
});
```

**Workflow parser validation:**
```typescript
// packages/core/test/domain/workflow-builder.test.ts
describe('workflow validation', () => {
  it('should detect circular dependencies');
  it('should validate agent references exist');
  it('should validate step ID uniqueness');
});
```

### 9.3 Skill Tests (Mocked Claude)

```typescript
// plugins/looplia-core/test/skills/build-flow.test.ts
describe('build workflow skill flow', () => {
  it('should invoke skills in correct order');
  it('should pass registry to matcher');
  it('should pass matcher output to composer');
  it('should handle no matching agents gracefully');
});
```

### 9.4 E2E Tests

```typescript
// apps/cli/test/e2e/build.test.ts
describe('looplia build', () => {
  it('should show help with --help flag');
  it('should error when no plugins installed (mock mode)');
  it('should generate valid workflow in non-interactive mode');
  it('should save workflow to specified output path');
});
```

### 9.5 Test Commands

```bash
# Run all tests
bun test

# Run build-specific tests
bun test --grep "build"

# Run E2E tests only
bun test apps/cli/test/e2e/

# Run with coverage
bun test --coverage
```

---

## 10. Universal Skill-Executor Architecture

### 10.1 Overview

The skill-executor is a **universal subagent** that can intelligently orchestrate multiple skills to complete workflow steps, eliminating the need for thin wrapper agents.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BEFORE (v0.6.0) - Agent-Based                             │
└─────────────────────────────────────────────────────────────────────────────┘

Workflow Step: run: agents/content-analyzer
                     │
                     ▼
              ┌──────────────────┐
              │  content-analyzer │  ← Thin wrapper agent
              │  (agent file)     │
              └────────┬─────────┘
                       │ "Use media-reviewer, then content-documenter"
                       ▼
              ┌──────────────────┐
              │     Skills        │
              │  (actual work)    │
              └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    AFTER (v0.6.1) - Skills-First                             │
└─────────────────────────────────────────────────────────────────────────────┘

Workflow Step: skill: media-reviewer
              mission: "Deep content analysis with structured JSON output"
                     │
                     ▼
              ┌──────────────────┐
              │  skill-executor   │  ← Universal intelligent orchestrator
              │  (ONE agent)      │
              └────────┬─────────┘
                       │ Reads mission, selects/composes skills dynamically
                       ▼
              ┌──────────────────┐
              │ media-reviewer    │  ← Skill 1
              │ content-documenter│  ← Skill 2 (if needed)
              └──────────────────┘
```

### 10.2 Skill-Executor Agent Definition

**Path:** `plugins/looplia-core/agents/skill-executor.md`

```yaml
---
name: skill-executor
description: |
  Universal skill orchestrator for looplia workflow steps.
  Reads step context, understands mission, and composes skills to complete tasks.
  Use this agent for all skill-based workflow steps.
model: sonnet
tools: Read, Write, Skill, Glob, Grep
---
```

#### Capabilities

1. **Mission Understanding**: Parse step's `mission` field to understand the goal
2. **Skill Discovery**: Use `plugin-registry-scanner` to find available skills
3. **Dynamic Orchestration**: Select and sequence multiple skills based on mission
4. **Tool Enforcement**: Respect skill's `tools:` restrictions if specified
5. **Output Compliance**: Ensure output matches step's requirements

#### Execution Protocol

```
1. Receive step context:
   - skill: The primary skill to use
   - mission: What needs to be accomplished
   - input: Input file path(s)
   - output: Output file path
   - validate: Validation criteria

2. Read the skill definition from plugins/*/skills/{skill}/SKILL.md

3. Analyze mission to determine if additional skills are needed:
   - If mission requires analysis → use analysis skills first
   - If mission requires transformation → use documenter skills
   - If mission requires enhancement → use enhancement skills

4. Execute skills in logical sequence:
   - Invoke Skill tool for each required skill
   - Pass context between skills
   - Maintain coherent understanding

5. Write final output to specified path

6. Return for validation
```

### 10.3 Enhanced Workflow Schema

v0.6.1 introduces the `skill:` field as the **default** for workflow steps:

```yaml
# v0.6.0 syntax (still supported for backward compatibility)
steps:
  - id: summary
    run: agents/content-analyzer
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json

# v0.6.1 syntax (DEFAULT for /build-generated workflows)
steps:
  - id: summary
    skill: media-reviewer             # Primary skill to use
    mission: |                        # What needs to be accomplished
      Analyze the input content deeply. Extract key themes,
      quotes, and narrative structure. Output as structured JSON
      following the ContentSummary schema.
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    model: haiku                      # Optional model override
    validate:
      required_fields: [contentId, headline, tldr, bullets]
```

#### New Step Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skill` | string | No* | Primary skill to execute |
| `mission` | string | No | Natural language description of the goal |
| `model` | string | No | Model override (haiku/sonnet/opus) |

*Step must have EITHER `run` OR `skill` (not both, not neither).

### 10.4 Enhanced Skill Frontmatter

Skills can now declare tool restrictions and preferred model:

```yaml
---
name: media-reviewer
description: |
  Looplia writer skill for deep content analysis.
  Analyzes structure, themes, narrative flow, and key insights.
tools: Read, Grep, Glob          # NEW: Tool restrictions (optional)
model: haiku                     # NEW: Preferred model (optional)
---
```

**Executor behavior:**
- If skill specifies `tools:`, executor only allows those tools
- If skill specifies `model:`, use it unless step overrides with `model:`
- If skill omits these fields, executor uses defaults (all tools, sonnet)

### 10.5 Skills-First Search Protocol

The `plugin-registry-scanner` skill now prioritizes skills over agents:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SKILLS-FIRST SEARCH PROTOCOL                              │
└─────────────────────────────────────────────────────────────────────────────┘

                     /build command
                            │
                            ▼
              ┌─────────────────────────┐
              │ plugin-registry-scanner │
              └───────────┬─────────────┘
                          │
              ┌───────────▼───────────┐
              │ 1. Scan skills/*      │  ← PRIMARY (check these first)
              │    Extract frontmatter │
              │    Catalog capabilities│
              ├───────────────────────┤
              │ 2. Scan agents/* only │  ← FALLBACK (for complex orchestration)
              │    if skill not found │
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │ Output: Registry JSON │
              │ {                     │
              │   skills: [...],      │  ← Listed first
              │   agents: [...]       │  ← Listed second
              │ }                     │
              └───────────────────────┘
```

### 10.6 Skill Field Resolution

When the workflow-executor processes a `skill:` step:

```
step.skill = "media-reviewer"
                    │
                    ▼
         ┌─────────────────────────────┐
         │ Check plugin registry       │
         │ for exact skill name match  │
         └────────────┬────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    FOUND                     NOT FOUND
         │                         │
         ▼                         ▼
   Use that skill           Treat as capability category
   directly                 (e.g., "content-analysis")
                                   │
                            Select best-matching
                            skill(s) by capability
```

### 10.7 Workflow-Executor Protocol Update

The `workflow-executor` skill handles both patterns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP EXECUTION PROTOCOL                                   │
└─────────────────────────────────────────────────────────────────────────────┘

FOR EACH step in execution order:
    │
    ├─▶ IF step.run exists:
    │       │
    │       ▼
    │   ┌─────────────────────────────────────┐
    │   │ subagent_type = extractAgentName()  │
    │   │ e.g., "content-analyzer"            │
    │   │                                     │
    │   │ Invoke specific agent (v0.6.0)      │
    │   └─────────────────────────────────────┘
    │
    └─▶ ELSE IF step.skill exists:
            │
            ▼
        ┌─────────────────────────────────────┐
        │ subagent_type = "skill-executor"    │
        │                                     │
        │ Pass to skill-executor:             │
        │ - step.skill                        │
        │ - step.mission                      │
        │ - step.input                        │
        │ - step.output                       │
        │ - step.model (if specified)         │
        │                                     │
        │ skill-executor orchestrates         │
        └─────────────────────────────────────┘
```

### 10.8 /build Integration

When `/build` generates a workflow, it now uses `skill:` by default:

```yaml
# Generated by /build "analyze videos and create blog outlines"
---
name: video-to-blog
version: 1.0.0
description: Analyze videos and create blog outlines

steps:
  - id: analyze-content
    skill: media-reviewer                    # ← Uses skill directly
    mission: |
      Deep analysis of video transcript. Extract key themes,
      important quotes, and narrative structure.
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/analysis.json
    validate:
      required_fields: [contentId, headline, tldr, bullets]
      min_quotes: 3

  - id: generate-ideas
    skill: idea-synthesis                    # ← Uses skill directly
    mission: |
      Generate hooks, angles, and questions from the analysis.
      Focus on engaging content ideas for blog posts.
    needs: [analyze-content]
    input: ${{ steps.analyze-content.output }}
    output: ${{ sandbox }}/outputs/ideas.json
    validate:
      required_fields: [hooks, angles, questions]
      has_hooks: true

  - id: build-outline
    skill: content-documenter                # ← Uses skill directly
    mission: |
      Create a structured blog outline with sections, key points,
      and supporting quotes from the analysis.
    needs: [analyze-content, generate-ideas]
    input:
      - ${{ steps.analyze-content.output }}
      - ${{ steps.generate-ideas.output }}
    output: ${{ sandbox }}/outputs/outline.json
    final: true
    validate:
      required_fields: [suggestedOutline]
      min_outline_sections: 4
---

# Video to Blog Workflow

Transform video content into structured blog outlines.

## Usage

```bash
looplia run video-to-blog --file <transcript.md>
```
```

### 10.9 Renamed Skills

To reflect the skills-first approach, the following skill is renamed:

| Original Name | New Name | Rationale |
|---------------|----------|-----------|
| `agent-capability-matcher` | `skill-capability-matcher` | Matches to skills, not agents |

The `skill-capability-matcher` now:
1. Receives user requirements + registry (skills-first)
2. Matches requirements to **skills** primarily
3. Falls back to agents only for complex multi-skill orchestration
4. Outputs skill sequence (not agent sequence)

### 10.10 Backward Compatibility

Both patterns are fully supported:

| Pattern | Status | Use Case |
|---------|--------|----------|
| `run: agents/X` | **Supported** | Existing workflows, complex orchestration |
| `skill: Y` | **NEW (Default)** | New workflows, simple skill execution |
| Both fields | **Error** | Validation prevents ambiguity |

**Migration path:**
1. Existing workflows with `run:` continue to work unchanged
2. New workflows generated by `/build` use `skill:` by default
3. Users can gradually migrate simple agents to skill-based steps
4. Complex agents (multi-skill orchestration) remain as agents

### 10.11 Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Default for /build | `skill:` steps | Skills-first simplifies workflow creation |
| Skill field interpretation | Both specific and category | Flexible - exact match or capability search |
| Tool restrictions | Add `tools:` to skill frontmatter | Fine-grained control per skill |
| Model selection | `model:` in skill and step | Skill default, step override |
| Backward compatibility | Support both patterns | No breaking changes for existing workflows |
| Search order | Skills first, agents fallback | Skills are primary building blocks |

---

## Cross-References

- **Workflow Schema:** See [DESIGN-0.6.0.md](./DESIGN-0.6.0.md) for v0.6.0 schema specification
- **Context Injection:** See [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) for skill loading
- **Plugin Architecture:** See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) for plugin structure
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md) for term definitions

---

*This document serves as the single source of truth for Looplia-Core v0.6.1 workflow builder architecture.*
