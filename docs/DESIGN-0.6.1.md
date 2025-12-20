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
| `plugin-registry-scanner` | Skill | Discover available agents/skills |
| `agent-capability-matcher` | Skill | Match requirements to agents |
| `workflow-schema-composer` | Skill | Generate valid workflow YAML |
| `commands/build.md` | Command | Slash command definition |
| `looplia build` | CLI Command | Interactive TUI entry point |

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
| Discovery | `plugin-registry-scanner` | Know what's available |
| Analysis + Matching | `agent-capability-matcher` | Understand intent, recommend agents |
| Construction | `workflow-schema-composer` | Build valid workflow artifacts |

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
plugins/looplia-core/skills/
├── plugin-registry-scanner/       # Domain: Discovery
│   ├── SKILL.md
│   └── scripts/
│       └── scan-plugins.ts
│
├── agent-capability-matcher/      # Domain: Analysis + Matching
│   └── SKILL.md
│
└── workflow-schema-composer/      # Domain: Construction
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

### 3.4 Skill 2: agent-capability-matcher

**Domain:** Analysis + Matching — Understand intent, recommend agents

**Location:** `plugins/looplia-core/skills/agent-capability-matcher/`

**Purpose:** Parse natural language requirements and match to available agents

**Reusability:** HIGH — Any agent recommendation system

**Pattern:** Similar to `media-reviewer` (multi-step analysis process)

#### Frontmatter

```yaml
---
name: agent-capability-matcher
description: |
  Looplia core skill for matching user requirements to available agents.
  Use when building looplia workflows to determine which agents should handle each step.
  Analyzes natural language descriptions and recommends agent sequences with rationale.
  Triggered by /build command after plugin-registry-scanner.
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

3. **Match Capabilities**
   - Score each agent by capability alignment
   - Consider skill coverage
   - Identify capability gaps

4. **Recommend Sequence**
   - Order agents by data flow dependencies
   - Suggest step names (kebab-case)
   - Provide rationale for each recommendation

5. **Flag Gaps**
   - Identify missing capabilities
   - Suggest custom agent creation if needed

#### Input

```json
{
  "description": "I want to analyze YouTube videos and create blog outlines",
  "registry": { /* output from plugin-registry-scanner */ }
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
      "agent": "content-analyzer",
      "suggestedStepId": "analyze-content",
      "matchScore": 0.92,
      "capabilities": ["content analysis", "structured output"],
      "rationale": "Handles content analysis with structured JSON output"
    },
    {
      "agent": "idea-generator",
      "suggestedStepId": "generate-ideas",
      "matchScore": 0.85,
      "capabilities": ["idea generation", "hooks and angles"],
      "rationale": "Generates hooks and angles from analysis"
    },
    {
      "agent": "writing-kit-builder",
      "suggestedStepId": "build-outline",
      "matchScore": 0.88,
      "capabilities": ["outline generation", "writing kit assembly"],
      "rationale": "Creates structured outline from ideas"
    }
  ],
  "suggestedSequence": ["analyze-content", "generate-ideas", "build-outline"],
  "dataFlow": {
    "analyze-content": { "needs": [], "provides": "analysis.json" },
    "generate-ideas": { "needs": ["analyze-content"], "provides": "ideas.json" },
    "build-outline": { "needs": ["analyze-content", "generate-ideas"], "provides": "outline.json" }
  },
  "gaps": [],
  "customAgentNeeded": false
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
  dependencies, and validation criteria. Triggered by /build command after agent-capability-matcher.
---
```

#### Process

1. **Receive Inputs**
   - Agent sequence from `agent-capability-matcher`
   - Original user requirements
   - Workflow name (derived or specified)

2. **Design Steps**
   - Create step IDs (kebab-case, meaningful)
   - Map steps to agents (`run: agents/{name}`)
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
  "matcherOutput": { /* output from agent-capability-matcher */ }
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
| `agent-capability-matcher` | `media-reviewer` | Multi-step analysis with structured output |
| `workflow-schema-composer` | `content-documenter` | Schema-driven output generation |

---

## 4. CLAUDE.md Integration

### 4.1 Pattern Consistency

Workflow building follows the same pattern as workflow execution:

| Command | Orchestration | Skills Used |
|---------|---------------|-------------|
| `/run` | CLAUDE.md instructions | `workflow-executor`, `workflow-validator` |
| `/build` | CLAUDE.md instructions | `plugin-registry-scanner`, `agent-capability-matcher`, `workflow-schema-composer` |

**No wrapper agent needed** - Claude uses skills directly based on CLAUDE.md instructions.

### 4.2 Skill Invocation Protocol

> **Critical:** Skills MUST be invoked explicitly using the Skill tool. Do NOT rely on automatic skill triggering.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXPLICIT SKILL INVOCATION                                │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Skill("plugin-registry-scanner")
        └── Output: Registry JSON (held in context)

Step 2: Skill("agent-capability-matcher")
        └── Input: User requirements + Registry JSON from Step 1
        └── Output: Agent sequence JSON (held in context)

Step 3: Skill("workflow-schema-composer")
        └── Input: Requirements + Agent sequence from Step 2
        └── Output: Complete workflow markdown
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
   └── Outputs: Registry JSON to context
   └── Claude holds: { plugins: [...], summary: {...} }

2. agent-capability-matcher
   └── Receives: User description + Registry JSON (from context)
   └── Outputs: Matcher result JSON to context
   └── Claude holds: { requirements: {...}, recommendations: [...] }

3. workflow-schema-composer
   └── Receives: Requirements + Matcher result (from context)
   └── Outputs: Complete workflow markdown
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
   - Scan installed plugins for available agents and skills
   - Output: Registry JSON with capabilities

2. **Use agent-capability-matcher skill**
   - Analyze user requirements
   - Match to available agents from registry
   - Output: Recommended agent sequence with rationale

3. **Use workflow-schema-composer skill**
   - Design workflow steps based on agent sequence
   - Generate valid v0.6.0 YAML/Markdown
   - Output: Complete workflow file

### Build Rules

- **ALWAYS** scan registry first to know available agents
- **ALWAYS** match user intent to agent capabilities before composing
- **ALWAYS** generate valid v0.6.0 workflow schema
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
   - Discover available agents and skills
   - Build capability inventory

3. **Use agent-capability-matcher skill**
   - Match requirements to agents
   - Get recommended sequence with rationale

4. **Use workflow-schema-composer skill**
   - Generate complete workflow YAML/Markdown
   - Include validation criteria

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
│ plugin-registry-    │  │ agent-capability-   │  │ workflow-schema-    │
│ scanner             │──▶│ matcher             │──▶│ composer            │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ Output: Registry    │  │ Output: Agent       │  │ Output: Workflow    │
│ (agents, skills)    │  │ sequence            │  │ markdown            │
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
│ plugin-registry-    │  │ agent-capability-   │  │ workflow-schema-    │
│ scanner             │  │ matcher             │  │ composer            │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ Input:              │  │ Input:              │  │ Input:              │
│ - Plugin directories│  │ - Description       │  │ - Agent sequence    │
│                     │  │ - Registry          │  │ - Requirements      │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ Output:             │  │ Output:             │  │ Output:             │
│ - Registry JSON     │──▶│ - Agent sequence    │──▶│ - Workflow markdown │
│   (agents, skills)  │  │ - Data flow         │  │   (complete file)   │
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
        │ Registry JSON                    │
        ▼                                  │
agent-capability-matcher                   │
        │                                  │
        │ Agent sequence + data flow       │
        ▼                                  ▼
workflow-schema-composer ◀─────── (both inputs)
        │
        │ Complete workflow markdown
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
│   ├── commands/
│   │   ├── run.md
│   │   ├── build.md                         # NEW: Replace build-workflow.md
│   │   └── list-workflows.md
│   └── skills/
│       ├── workflow-executor/
│       │   └── SKILL.md                     # MODIFY: Add "Looplia" to description
│       ├── workflow-validator/
│       │   └── SKILL.md                     # MODIFY: Add "Looplia" to description
│       ├── plugin-registry-scanner/         # NEW: Discovery skill
│       │   ├── SKILL.md
│       │   └── scripts/
│       │       └── scan-plugins.ts
│       ├── agent-capability-matcher/        # NEW: Matching skill
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

### 8.3 Phase 1: Skills

**New Skills (in order):**
1. `plugin-registry-scanner`
2. `agent-capability-matcher`
3. `workflow-schema-composer`

**Update Existing Skills:**
1. `workflow-executor` - Add "Looplia core skill" to description
2. `workflow-validator` - Add "Looplia core skill" to description

Each skill follows the established pattern:
- YAML frontmatter with `name` and `description` (include "Looplia" keyword)
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

## Cross-References

- **Workflow Schema:** See [DESIGN-0.6.0.md](./DESIGN-0.6.0.md) for v0.6.0 schema specification
- **Context Injection:** See [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) for skill loading
- **Plugin Architecture:** See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) for plugin structure
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md) for term definitions

---

*This document serves as the single source of truth for Looplia-Core v0.6.1 workflow builder architecture.*
