# Looplia-Core Architecture Design v0.5.2

> Two-Plugin Architecture: Core Infrastructure + Domain Plugins
>
> **Version:** 0.5.2
> **Date:** 2025-12-18
> **Related:** [DESIGN-0.5.1.md](./DESIGN-0.5.1.md) | [GLOSSARY.md](./GLOSSARY.md) | [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Philosophy](#2-design-philosophy)
3. [Two-Plugin Architecture](#3-two-plugin-architecture)
4. [Plugin 1: looplia-core](#4-plugin-1-looplia-core)
5. [Plugin 2: looplia-writer](#5-plugin-2-looplia-writer)
6. [Workflow Files Solution](#6-workflow-files-solution)
7. [CLI and Installation](#7-cli-and-installation)
8. [Command Specifications](#8-command-specifications)
9. [Implementation Plan](#9-implementation-plan)
10. [Migration from v0.5.1](#10-migration-from-v051)

---

## 1. Executive Summary

### Evolution from v0.5.1 to v0.5.2

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.5.1 | Workflow Generalization | Workflow.md format, Validation Skill, Generic Interpreter |
| **v0.5.2** | **Plugin Separation** | **Two-plugin architecture, Claude Code alignment, Slash commands** |

### Key Architectural Change

v0.5.2 splits the single `looplia-writer` plugin into **two plugins**:

| Plugin | Purpose | Contents |
|--------|---------|----------|
| **looplia-core** | Infrastructure | Workflow engine, validation, commands (`/run`, `/build-workflow`) |
| **looplia-writer** | Domain | Writing-kit workflow, content analysis agents, writing skills |

### Benefits

1. **Separation of Concerns** - Infrastructure vs domain logic clearly separated
2. **Reusability** - Core plugin reusable across different domain plugins
3. **Claude Code Alignment** - Proper plugin structure with commands, hooks
4. **Extensibility** - Easy to add new domain plugins (looplia-research, looplia-code, etc.)

### What's New

| Feature | Description |
|---------|-------------|
| **Unified Execution Model** | CLI wraps `/run` command - single execution path |
| **Slash Commands** | `/run`, `/build-workflow`, `/list-workflows` via commands/ |
| **workflow-executor Skill** | Core skill containing ALL workflow logic |
| **Thin CLI Wrapper** | CLI reduced from ~500 lines to ~50 lines |
| **Minimal Hooks** | Logging hooks for workflow lifecycle |

---

## 2. Design Philosophy

### 2.0 Unified Execution Model

> **Principle:** CLI is a thin wrapper that injects the `/run` slash command. Single execution path for both CLI and Claude Code.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED EXECUTION MODEL                                  │
└─────────────────────────────────────────────────────────────────────────────┘

User: looplia run writing-kit --file article.md
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLI Layer (Thin Wrapper - ~50 lines)                                         │
│                                                                             │
│ 1. Parse args → workflow-id, file path, options                             │
│ 2. Ensure workspace initialized                                             │
│ 3. Build prompt: "/run {workflow-id} --file {abs-path}"                     │
│ 4. Invoke Claude Agent SDK with the prompt                                  │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Agent receives: "/run writing-kit --file /path/to/article.md"               │
│                                                                             │
│ 1. Agent reads commands/run.md → understands /run command                   │
│ 2. Agent uses workflow-executor skill (contains ALL logic)                  │
│    ├─ Create session, generate validation.json                              │
│    ├─ Parse workflow.md, resolve dependencies                               │
│    ├─ Invoke subagents via Task tool                                        │
│    ├─ Validate outputs with workflow-validator skill                        │
│    └─ Return final artifact                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Single execution path (CLI and Claude Code use same logic)
- All workflow logic in workflow-executor skill (not scattered in CLI)
- CLI is trivial to maintain (~50 lines vs ~500 lines)
- Same behavior whether invoked via CLI or Claude Code directly

### 2.1 Infrastructure vs Domain

> **Principle:** Separate the workflow engine (how to run workflows) from domain logic (what workflows do).

**Infrastructure (looplia-core):**
- How to parse workflow.md files
- How to execute outputs in dependency order
- How to validate artifacts
- How to expose workflows via commands

**Domain (looplia-writer):**
- Writing-specific agents (content-analyzer, idea-generator)
- Writing-specific skills (media-reviewer, writing-enhancer)
- Writing-specific workflow (writing-kit.md)

### 2.2 Claude Code Plugin Alignment

> **Principle:** Align with Claude Code's plugin model while extending it for workflows.

**Standard Claude Code Components:**
- `.claude-plugin/plugin.json` - Plugin manifest
- `commands/*.md` - Slash commands
- `agents/*.md` - Subagent definitions
- `skills/*/SKILL.md` - Agent skills
- `hooks/hooks.json` - Event handlers

**Looplia Extension:**
- `workflows/*.md` - Workflow definitions (Looplia-specific)

### 2.3 Commands as Entry Points

> **Principle:** Users interact via slash commands, not direct API calls.

```
User: /run writing-kit --file article.md
  │
  ├─ Command parses arguments
  ├─ workflow-executor skill loads workflow
  ├─ Subagents execute outputs
  ├─ workflow-validator skill validates
  └─ Final artifact returned
```

---

## 3. Two-Plugin Architecture

### 3.1 Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TWO-PLUGIN ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐    ┌─────────────────────────────────────┐
│        LOOPLIA-CORE              │    │         LOOPLIA-WRITER               │
│     (Infrastructure Plugin)      │    │        (Domain Plugin)               │
├─────────────────────────────────┤    ├─────────────────────────────────────┤
│ commands/                        │    │ agents/                              │
│   ├── run.md                     │    │   ├── content-analyzer.md            │
│   ├── build-workflow.md          │    │   ├── idea-generator.md              │
│   └── list-workflows.md          │    │   └── writing-kit-builder.md         │
├─────────────────────────────────┤    ├─────────────────────────────────────┤
│ skills/                          │    │ skills/                              │
│   ├── workflow-executor/         │    │   ├── media-reviewer/                │
│   └── workflow-validator/        │    │   ├── content-documenter/            │
│       └── scripts/validate.ts    │    │   ├── user-profile-reader/           │
├─────────────────────────────────┤    │   └── writing-enhancer/               │
│ hooks/                           │    ├─────────────────────────────────────┤
│   └── hooks.json                 │    │ workflows/                           │
├─────────────────────────────────┤    │   └── writing-kit.md                  │
│ CLAUDE.md                        │    ├─────────────────────────────────────┤
│   (Generic interpreter)          │    │ README.md                            │
└─────────────────────────────────┘    │   (Domain documentation)              │
                                        └─────────────────────────────────────┘
                │                                      │
                └──────────────┬───────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PROJECT WORKSPACE (after install)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ .claude/                                                                     │
│   ├── agents/                   # From looplia-writer                       │
│   │   ├── content-analyzer.md                                               │
│   │   ├── idea-generator.md                                                 │
│   │   └── writing-kit-builder.md                                            │
│   └── skills/                   # From both plugins                         │
│       ├── workflow-executor/    # From looplia-core                         │
│       ├── workflow-validator/   # From looplia-core                         │
│       ├── media-reviewer/       # From looplia-writer                       │
│       └── ...                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ commands/                       # From looplia-core                         │
│   ├── run.md                                                                │
│   ├── build-workflow.md                                                     │
│   └── list-workflows.md                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ workflows/                      # From looplia-writer (Looplia extension)   │
│   └── writing-kit.md                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ hooks/                          # From looplia-core                         │
│   └── hooks.json                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ CLAUDE.md                       # From looplia-core                         │
│ user-profile.json               # User configuration                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Dependency Flow

```
looplia-writer (domain)
        │
        │ depends on
        ▼
looplia-core (infrastructure)
        │
        │ uses
        ▼
Claude Code Plugin System
```

### 3.3 File Ownership

| Directory | Owner Plugin | Purpose |
|-----------|--------------|---------|
| `commands/` | looplia-core | Slash commands for workflow execution |
| `.claude/skills/workflow-*` | looplia-core | Execution and validation skills |
| `.claude/skills/{domain}` | looplia-writer | Domain-specific skills |
| `.claude/agents/` | looplia-writer | Domain-specific agents |
| `workflows/` | looplia-writer | Domain workflow definitions |
| `hooks/` | looplia-core | Lifecycle event handlers |
| `CLAUDE.md` | looplia-core | Generic workflow interpreter |

---

## 4. Plugin 1: looplia-core

### 4.1 Directory Structure

```
plugins/looplia-core/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── commands/
│   ├── run.md                   # /run <workflow-id> --file <path>
│   ├── build-workflow.md        # /build-workflow <name>
│   └── list-workflows.md        # /list-workflows
├── skills/
│   ├── workflow-executor/
│   │   └── SKILL.md             # Workflow interpretation skill
│   └── workflow-validator/
│       ├── SKILL.md             # Validation skill
│       └── scripts/
│           └── validate.ts      # Deterministic validation script
├── hooks/
│   └── hooks.json               # Minimal logging hooks
└── CLAUDE.md                    # Generic workflow interpreter
```

### 4.2 Plugin Manifest

**File:** `.claude-plugin/plugin.json`

```json
{
  "name": "looplia-core",
  "version": "0.5.2",
  "description": "Looplia workflow engine - run, build, and validate agentic workflows",
  "author": {
    "name": "Looplia",
    "url": "https://github.com/looplia"
  },
  "homepage": "https://github.com/memorysaver/looplia-core",
  "keywords": ["workflow", "agentic", "orchestration", "validation"]
}
```

### 4.3 Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **run.md** | Parse workflow-id, invoke workflow-executor skill |
| **build-workflow.md** | Scaffold new workflow.md file |
| **list-workflows.md** | List available workflows in workspace |
| **workflow-executor** | Parse workflow.md, orchestrate agents, track state |
| **workflow-validator** | Validate artifacts against criteria |
| **hooks.json** | Log workflow lifecycle events |
| **CLAUDE.md** | Teach Claude how to interpret any workflow |

### 4.4 workflow-executor Skill (THE CORE)

This skill contains **ALL workflow execution logic** - moved from CLI for unified execution.

**File:** `skills/workflow-executor/SKILL.md`

```markdown
---
name: workflow-executor
description: |
  Execute workflow-as-markdown definitions. Handles session creation,
  YAML parsing, dependency resolution, subagent orchestration, and validation.
  This is the central brain of the Looplia workflow system.
---

# Workflow Executor Skill

Execute workflows defined in `workflows/*.md` files. Contains ALL workflow logic.

## Full Execution Protocol

### 1. Session Management (moved from CLI)
- If `--file` provided:
  - Generate unique session ID: `{slug}-{timestamp}-{random}`
  - Create folder: `contentItem/{session-id}/`
  - Copy content to: `contentItem/{session-id}/content.md`
- If `--session-id` provided:
  - Load existing session folder
  - Verify session exists

### 2. Workflow Loading
- Read `workflows/{workflow-id}.md`
- Parse YAML frontmatter → outputs, agents, dependencies, validation criteria
- Parse markdown body → custom instructions

### 3. Validation State Management (moved from CLI)
- Generate `contentItem/{id}/validation.json` from workflow frontmatter
- Structure:
  ```json
  {
    "workflow": "workflow-id",
    "outputs": {
      "output-name": {
        "artifact": "file.json",
        "criteria": { ... },
        "validated": false
      }
    }
  }
  ```

### 4. Dependency Resolution
- Build topological order from `requires` fields
- Example: summary → ideas → writing-kit

### 5. Output Execution Loop
For each output (in dependency order):
  IF artifact exists AND validated: true:
    Skip (already complete - smart continuation)
  ELSE:
    - Invoke subagent via Task tool (subagent_type = agent name)
    - Subagent writes artifact
    - Use workflow-validator skill to check artifact
    - IF passed: Update validation.json with validated: true
    - IF failed: Retry with feedback (max 2 times) or report error

### 6. Return Final
- When output with `final: true` passes validation
- Read its artifact content
- Return as structured result

## Error Handling

- Workflow not found: Report "No workflow: {id}"
- Circular dependency: Report "Circular dependency detected"
- Validation failure: Retry up to 2 times, then report
- Missing agent: Report "Agent not found: {name}"
```

## Capabilities Summary

| Capability | Previously In | Now In |
|------------|---------------|--------|
| Session creation | CLI (session-manager.ts) | workflow-executor skill |
| validation.json generation | CLI (looplia-runtime.ts) | workflow-executor skill |
| Workflow YAML parsing | CLI (workflow-parser.ts) | workflow-executor skill |
| Dependency resolution | CLI (workflow-parser.ts) | workflow-executor skill |
| Subagent orchestration | CLI (looplia-runtime.ts) | workflow-executor skill |
| Smart continuation | CLI (looplia-runtime.ts) | workflow-executor skill |

## Usage Protocol

### Step 1: Load Workflow
```
Read workflows/{workflow-id}.md
Parse YAML frontmatter → outputs, agents, validation criteria
Parse markdown body → custom instructions
```

### Step 2: Initialize State
```
Create/read contentItem/{id}/validation.json
Check which outputs have validated: true
```

### Step 3: Execute Loop
```
For each output in dependency order:
  IF validated AND artifact exists:
    Skip (already complete)
  ELSE:
    Invoke subagent via Task tool
    Use workflow-validator skill to validate
    IF passed: Update validation.json
    IF failed: Retry or report
```

### Step 4: Return Final
```
When output with final: true passes:
  Read its artifact
  Return as result
```

## Execution Order Algorithm

Given outputs with `requires` fields, compute topological order:

```
Input:
  summary: { requires: [] }
  ideas: { requires: [summary] }
  writing-kit: { requires: [summary, ideas], final: true }

Output order: [summary, ideas, writing-kit]
```

## Error Handling

- **Missing workflow**: Report "Workflow not found: {id}"
- **Circular dependency**: Report "Circular dependency detected"
- **Validation failure**: Retry subagent up to 2 times, then report
- **Missing agent**: Report "Agent not found: {name}"
```

### 4.5 Hooks Configuration

**File:** `hooks/hooks.json`

```json
{
  "description": "Looplia workflow lifecycle logging",
  "hooks": {
    "SubagentStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '[looplia] Subagent started'",
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '[looplia] Subagent completed'",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

---

## 5. Plugin 2: looplia-writer

### 5.1 Directory Structure

```
plugins/looplia-writer/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── agents/
│   ├── content-analyzer.md      # Deep content analysis
│   ├── idea-generator.md        # Creative idea generation
│   └── writing-kit-builder.md   # Final kit assembly
├── skills/
│   ├── media-reviewer/
│   │   └── SKILL.md             # Media content analysis
│   ├── content-documenter/
│   │   └── SKILL.md             # Structured output generation
│   ├── id-generator/
│   │   └── SKILL.md             # Session ID generation
│   ├── user-profile-reader/
│   │   └── SKILL.md             # User preference loading
│   └── writing-enhancer/
│       └── SKILL.md             # Content enhancement
├── workflows/
│   └── writing-kit.md           # Writing kit workflow definition
└── README.md                    # Domain documentation
```

### 5.2 Plugin Manifest

**File:** `.claude-plugin/plugin.json`

```json
{
  "name": "looplia-writer",
  "version": "0.5.2",
  "description": "Writing assistant plugin - transform content into structured writing kits with AI-powered analysis",
  "author": {
    "name": "Looplia",
    "url": "https://github.com/looplia"
  },
  "homepage": "https://github.com/memorysaver/looplia-core",
  "keywords": ["writing", "content", "analysis", "ideas", "outline"],
  "dependencies": ["looplia-core"]
}
```

### 5.3 Files to Delete

| File | Reason |
|------|--------|
| `pipelines/writing-kit.yaml` | Superseded by `workflows/writing-kit.md` |
| `skills/workflow-validator/` | Moved to looplia-core |

### 5.4 Writing-Kit Workflow

The existing `workflows/writing-kit.md` remains unchanged - it's already in the correct format from v0.5.1.

---

## 6. Workflow Files Solution

### 6.1 The Problem

`workflows/` is not part of the Claude Code plugin specification. Claude Code plugins have:
- `commands/`, `agents/`, `skills/`, `hooks/`

But NOT `workflows/`.

### 6.2 The Solution

Treat `workflows/` as a **Looplia extension** to the Claude Code plugin model:

1. **Domain plugins** (looplia-writer) include `workflows/` directory
2. **Core plugin** (looplia-core) provides `workflow-executor` skill that knows how to find and execute workflows
3. **CLI** copies workflows from domain plugins to project workspace

### 6.3 Workflow Discovery

The `workflow-executor` skill and `/run` command look for workflows in:

```
{workspace}/workflows/*.md
```

This location is:
- Populated by domain plugins during installation
- Follows the convention established by Looplia
- Separate from Claude Code standard directories

### 6.4 Why Not Commands?

One might ask: "Why not make each workflow a command?"

**Answer:** Workflows are **data**, not code. A workflow definition describes WHAT to do, while a command describes HOW to invoke workflows. The `/run` command is the single entry point that can execute ANY workflow.

```
/run writing-kit --file article.md    # Invoke writing-kit workflow
/run research-paper --file notes.md   # Invoke research-paper workflow (future)
/run code-review --file main.ts       # Invoke code-review workflow (future)
```

---

## 7. CLI and Installation

### 7.1 Installation Flow

```
looplia init
    │
    ├─ Install looplia-core plugin
    │   ├─ Copy commands/ → {workspace}/commands/
    │   ├─ Copy skills/ → {workspace}/.claude/skills/
    │   ├─ Copy hooks/ → {workspace}/hooks/
    │   └─ Copy CLAUDE.md → {workspace}/CLAUDE.md
    │
    └─ Install looplia-writer plugin
        ├─ Copy agents/ → {workspace}/.claude/agents/
        ├─ Copy skills/ → {workspace}/.claude/skills/
        └─ Copy workflows/ → {workspace}/workflows/
```

### 7.2 Workspace Structure After Init

```
~/.looplia/
├── CLAUDE.md                    # From looplia-core
├── user-profile.json            # User configuration
├── commands/                    # From looplia-core
│   ├── run.md
│   ├── build-workflow.md
│   └── list-workflows.md
├── hooks/                       # From looplia-core
│   └── hooks.json
├── workflows/                   # From looplia-writer
│   └── writing-kit.md
├── .claude/
│   ├── agents/                  # From looplia-writer
│   │   ├── content-analyzer.md
│   │   ├── idea-generator.md
│   │   └── writing-kit-builder.md
│   └── skills/                  # From both plugins
│       ├── workflow-executor/   # looplia-core
│       ├── workflow-validator/  # looplia-core
│       ├── media-reviewer/      # looplia-writer
│       ├── content-documenter/  # looplia-writer
│       ├── id-generator/        # looplia-writer
│       ├── user-profile-reader/ # looplia-writer
│       └── writing-enhancer/    # looplia-writer
└── contentItem/                 # Session data
    └── {id}/
        ├── content.md
        ├── validation.json
        └── *.json
```

### 7.3 CLI as Thin Wrapper

The CLI is simplified to a thin wrapper that injects the `/run` command:

**Before (v0.5.1) - Complex CLI:**
```
apps/cli/src/
├── commands/run.ts           # ~200 lines, complex orchestration
├── runtime/looplia-runtime.ts # ~550 lines, ALL workflow logic
├── runtime/session-manager.ts # Session creation logic
└── parsers/workflow-parser.ts # Workflow YAML parsing
```

**After (v0.5.2) - Thin Wrapper:**
```
apps/cli/src/
├── commands/run.ts           # ~50 lines, just inject /run command
└── runtime/looplia-runtime.ts # Minimal - just invoke SDK
```

**Simplified run.ts:**

```typescript
// apps/cli/src/commands/run.ts

async function runCommand(args: string[]): Promise<void> {
  // 1. Parse args
  const { workflowId, file, sessionId, options } = parseArgs(args);

  // 2. Ensure workspace initialized
  await ensureWorkspace();

  // 3. Build /run command prompt
  const prompt = sessionId
    ? `/run ${workflowId} --session-id ${sessionId}`
    : `/run ${workflowId} --file ${path.resolve(file)}`;

  // 4. Invoke SDK with prompt
  const result = await executePrompt(prompt);

  // 5. Display result
  renderResult(result);
}
```

**Key Change:** All complex logic (session creation, validation.json, workflow parsing, subagent orchestration) moves to the `workflow-executor` skill.

### 7.4 Workspace Bootstrap

**File:** `packages/provider/src/claude-agent-sdk/workspace.ts`

Update `bootstrapFromPlugin()` to support two plugins:

```typescript
type PluginSource = {
  name: string;
  path: string;
};

async function bootstrapWorkspace(
  workspaceDir: string,
  plugins: PluginSource[]
): Promise<void> {
  for (const plugin of plugins) {
    await copyPluginContents(workspaceDir, plugin.path);
  }
}

async function copyPluginContents(
  workspaceDir: string,
  pluginDir: string
): Promise<void> {
  // Copy standard Claude Code plugin directories
  await copyIfExists(join(pluginDir, "commands"), join(workspaceDir, "commands"));
  await copyIfExists(join(pluginDir, "agents"), join(workspaceDir, ".claude/agents"));
  await copyIfExists(join(pluginDir, "skills"), join(workspaceDir, ".claude/skills"));
  await copyIfExists(join(pluginDir, "hooks"), join(workspaceDir, "hooks"));

  // Copy Looplia extension
  await copyIfExists(join(pluginDir, "workflows"), join(workspaceDir, "workflows"));

  // Copy root files
  await copyIfExists(join(pluginDir, "CLAUDE.md"), join(workspaceDir, "CLAUDE.md"));
}
```

---

## 8. Command Specifications

### 8.1 /run Command

**File:** `commands/run.md`

```markdown
---
description: Run a Looplia workflow on content
---

# Run Workflow

Execute a workflow from `workflows/` on provided content.

## Usage

```
/run <workflow-id> --file <path>
/run <workflow-id> --session-id <id>
```

## Arguments

- `workflow-id`: Name of workflow to execute (e.g., "writing-kit")
- `--file <path>`: Path to content file (creates new session)
- `--session-id <id>`: Resume existing session

## Execution Protocol

1. **Validate workflow exists**
   - Check `workflows/{workflow-id}.md` exists
   - Report error if not found

2. **Initialize session**
   - If `--file`: Create new session, copy content
   - If `--session-id`: Load existing session

3. **Use workflow-executor skill**
   - Parse workflow definition
   - Execute outputs in dependency order
   - Validate each output

4. **Return final artifact**
   - Read output marked `final: true`
   - Return as structured result

## Examples

```
/run writing-kit --file ~/documents/article.md
/run writing-kit --session-id article-2025-12-18-abc123
```

## Error Handling

- Workflow not found: "No workflow found: {id}. Run /list-workflows to see available."
- File not found: "Cannot read file: {path}"
- Validation failure: Show failed checks, offer retry
```

### 8.2 /build-workflow Command

**File:** `commands/build-workflow.md`

```markdown
---
description: Scaffold a new workflow definition
---

# Build Workflow

Create a new workflow.md file with standard structure.

## Usage

```
/build-workflow <name>
```

## Arguments

- `name`: Workflow identifier (e.g., "research-paper")

## Generated File

Creates `workflows/{name}.md`:

```yaml
---
name: {name}
description: TODO - describe what this workflow does

outputs:
  output-1:
    artifact: output-1.json
    agent: agent-name
    validate:
      required_fields: []
---

# {Name} Workflow

## Purpose

TODO - describe the purpose of this workflow.

## Custom Instructions

TODO - add workflow-specific instructions.

## Output Schemas

TODO - document expected output schemas.
```

## Next Steps

After creating workflow:
1. Define outputs in YAML frontmatter
2. Create agents in `.claude/agents/`
3. Add validation criteria
4. Test with `/run {name} --file test.md`
```

### 8.3 /list-workflows Command

**File:** `commands/list-workflows.md`

```markdown
---
description: List available workflows
---

# List Workflows

Show all available workflows in the workspace.

## Usage

```
/list-workflows
```

## Output

Lists workflows from `workflows/` directory:

```
Available workflows:
  - writing-kit: Transform content into structured writing kit

Run a workflow: /run <workflow-id> --file <path>
```

## Implementation

1. Read `workflows/` directory
2. For each .md file:
   - Parse YAML frontmatter
   - Extract name and description
3. Format and display list
```

---

## 9. Implementation Plan

### Phase 1: Create looplia-core Plugin

| Task | Description |
|------|-------------|
| 1.1 | Create `plugins/looplia-core/` directory |
| 1.2 | Create `.claude-plugin/plugin.json` |
| 1.3 | Move `workflow-validator/` from looplia-writer |
| 1.4 | Create `workflow-executor/SKILL.md` |
| 1.5 | Create `CLAUDE.md` (copy and refine from looplia-writer README) |

### Phase 2: Create Commands

| Task | Description |
|------|-------------|
| 2.1 | Create `commands/run.md` |
| 2.2 | Create `commands/build-workflow.md` |
| 2.3 | Create `commands/list-workflows.md` |

### Phase 3: Add Hooks

| Task | Description |
|------|-------------|
| 3.1 | Create `hooks/hooks.json` with minimal logging |

### Phase 4: Clean Up looplia-writer

| Task | Description |
|------|-------------|
| 4.1 | Delete `pipelines/` directory |
| 4.2 | Delete `skills/workflow-validator/` (moved to core) |
| 4.3 | Update `.claude-plugin/plugin.json` with v0.5.2 |
| 4.4 | Add `dependencies: ["looplia-core"]` to manifest |

### Phase 5: Update CLI/Provider

| Task | Description |
|------|-------------|
| 5.1 | Update `workspace.ts` to support multiple plugins |
| 5.2 | Update `workspace.ts` to copy `commands/` and `hooks/` |
| 5.3 | Update `init.ts` to install both plugins |

### Phase 6: Update Documentation

| Task | Description |
|------|-------------|
| 6.1 | Update `docs/README.md` with v0.5.2 references |
| 6.2 | Create `docs/AGENTIC_CONCEPT-0.5.md` |
| 6.3 | Update `docs/GLOSSARY.md` with new terms |

---

## 10. Migration from v0.5.1

### 10.1 Breaking Changes

| v0.5.1 | v0.5.2 | Impact |
|--------|--------|--------|
| Single plugin | Two plugins | Re-run `looplia init` |
| `looplia run` CLI | `/run` command | Use slash command in Claude Code |
| workflow-validator in writer | workflow-validator in core | Automatic via init |

### 10.2 Migration Steps

1. **Run `looplia init`** - Installs both plugins
2. **Use `/run` command** - Instead of `looplia run` CLI
3. **Existing workflows** - Continue to work unchanged

### 10.3 Backward Compatibility

The CLI `looplia run` command continues to work for users who prefer CLI over slash commands. Both entry points invoke the same workflow-executor skill.

---

## Cross-References

- **Previous Version:** See [DESIGN-0.5.1.md](./DESIGN-0.5.1.md) for v0.5.1 architecture
- **Claude Code Plugins:** See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) for plugin reference
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md) for term definitions
- **Agent Skills Reference:** See [AGENT-SKILLS.md](./AGENT-SKILLS.md) for Anthropic SDK patterns

---

*This document serves as the single source of truth for Looplia-Core v0.5.2 architecture.*
