# Context Injection Flow

> **Version:** 0.6.1
> **Last Updated:** December 2025
> **Related:** [AGENTIC_CONCEPT_1.0.md](./AGENTIC_CONCEPT_1.0.md) | [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)

This document illustrates what content gets injected into Claude's context when running a Looplia workflow.

---

## Overview

When you run `looplia run writing-kit --file article.md`, multiple layers of context are injected into Claude's session. This document traces the complete injection flow from CLI invocation to final artifact generation.

---

## Context Injection Diagram

```
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                    CONTEXT INJECTION FLOW: looplia run writing-kit --file article.md  ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ CLI Layer (apps/cli/src/commands/run.ts)                                                │
│ • Creates sandbox folder: ~/.looplia/sandbox/{id}/                                      │
│ • Copies article.md → sandbox/{id}/inputs/content.md                                    │
│ • Builds prompt: "/run writing-kit --sandbox-id {id}"                                   │
│ • Calls Claude Agent SDK with workspace = ~/.looplia                                    │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │
                                            ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BOX 1: ~/.looplia/CLAUDE.md (Workspace Instructions - AUTO-LOADED)                      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ • "You execute workflows in workflows/*.md using workflow-executor skill"               ┃
┃ • Lists available commands: /run, /build-workflow, /list-workflows                      ┃
┃ • Describes workspace structure (sandbox/, .claude/agents/, skills/)                    ┃
┃ • Explains workflow-executor and workflow-validator skills                              ┃
┃ • Validation-driven completion rules                                                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                            │
                                            │ Claude receives: "/run writing-kit --sandbox-id article-2025-12-18-xk7m"
                                            ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BOX 2: commands/run.md (Slash Command Definition - READ BY CLAUDE)                      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ • Usage: /run <workflow-id> --file <path> or --sandbox-id <id>                          ┃
┃ • "Use workflow-executor skill to handle all execution"                                 ┃
┃ • Sandbox handling instructions                                                         ┃
┃ • Error handling guidance                                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                            │
                                            │ Claude uses Skill tool: workflow-executor
                                            ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BOX 3: .claude/skills/workflow-executor/SKILL.md (Core Skill - LOADED VIA Skill TOOL)   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ • Phase 1: Sandbox management (create/resume)                                           ┃
┃ • Phase 2: Workflow loading (parse workflows/writing-kit.md)                            ┃
┃ • Phase 3: Generate validation.json state                                               ┃
┃ • Phase 4: Dependency resolution (topological sort)                                     ┃
┃ • Phase 5-7: Output execution loop, subagent invocation, validation                     ┃
┃ • Phase 8: Return final artifact                                                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                            │
                                            │ Claude reads workflow definition
                                            ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BOX 4: workflows/writing-kit.md (Workflow Definition - READ BY CLAUDE) [v0.6.1]         ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ YAML Frontmatter (skills-first format):                                                 ┃
┃ • steps[0]: id=summary, skill=media-reviewer, mission="Analyze content..."              ┃
┃ • steps[1]: id=ideas, skill=idea-synthesis, mission="Generate angles...", needs=[summary]┃
┃ • steps[2]: id=writing-kit, skill=writing-kit-assembler, needs=[summary,ideas]          ┃
┃                                                                                         ┃
┃ Key: `skill:` + `mission:` → Task tool `subagent_type: "skill-executor"`                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                            │
                                            │ Claude generates validation.json, then invokes subagents
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ SUBAGENT SPAWN (via Task tool with subagent_type: "skill-executor") [v0.6.1]            │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │
          ┌─────────────────────────────────┼─────────────────────────────────────────────┐
          │                                 │                                             │
          ▼                                 ▼                                             ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BOX 5: skill-executor Subagent (UNIVERSAL - Same for ALL workflow steps)                ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                         ┃
┃  Task tool invocation (same subagent_type for every step):                              ┃
┃  {                                                                                      ┃
┃    "subagent_type": "skill-executor",                                                   ┃
┃    "prompt": "Execute {skill} skill with mission: {mission}"                            ┃
┃  }                                                                                      ┃
┃                                                                                         ┃
┃  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────────┐         ┃
┃  │ Step 1: summary    │  │ Step 2: ideas      │  │ Step 3: writing-kit        │         ┃
┃  │ skill: media-      │  │ skill: idea-       │  │ skill: writing-kit-        │         ┃
┃  │        reviewer    │  │        synthesis   │  │        assembler           │         ┃
┃  │ mission: Analyze   │  │ mission: Generate  │  │ mission: Combine summary   │         ┃
┃  │ content...         │  │ angles...          │  │ and ideas...               │         ┃
┃  └────────────────────┘  └────────────────────┘  └────────────────────────────┘         ┃
┃                                                                                         ┃
┃  The skill-executor:                                                                    ┃
┃  • Loads the specified skill's SKILL.md                                                 ┃
┃  • Executes the mission using skill's guidance                                          ┃
┃  • Writes output to the step's defined output path                                      ┃
┃                                                                                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
          │                                 │                                             │
          │ Each step loads its skill       │                                             │
          ▼                                 ▼                                             ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BOX 6: skills/{name}/SKILL.md (Skills - LOADED WHEN SUBAGENT USES Skill TOOL)           ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ • media-reviewer/SKILL.md      → Content analysis expertise                             ┃
┃ • content-documenter/SKILL.md  → Structured output formatting                           ┃
┃ • user-profile-reader/SKILL.md → User preferences integration                           ┃
┃ • id-generator/SKILL.md        → ContentId generation                                   ┃
┃ • writing-enhancer/SKILL.md    → Writing quality improvement                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                            │
                                            │ After each artifact write → PostToolUse hook
                                            ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BOX 7: workflow-validator/SKILL.md + scripts/validate.ts (Validation - AFTER WRITE)    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ • Read validation criteria from sandbox/{id}/validation.json                            ┃
┃ • Run: bun validate.ts outputs/summary.json '{"required_fields":[...],"min_quotes":3}'  ┃
┃ • Returns: { passed: true, checks: [...] }                                              ┃
┃ • Update validation.json: outputs.summary.validated = true                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                            │
                                            │ If context compacts (long workflow)
                                            ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BOX 8: compact-inject-state.sh (Hook - ON CONTEXT COMPACT)                              ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Triggers: SessionStart:compact                                                          ┃
┃ Re-injects:                                                                             ┃
┃   "=== Active Sandbox: article-2025-12-18-xk7m ==="                                     ┃
┃   "Workflow: writing-kit"                                                               ┃
┃   "Progress:"                                                                           ┃
┃   "  - summary: ✓ validated"                                                            ┃
┃   "  - ideas: ⏳ pending"                                                               ┃
┃   "  - writing-kit: ⏳ pending"                                                         ┃
┃   "Next: Complete pending outputs in dependency order."                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Sandbox Folder Structure

Each workflow execution creates an isolated sandbox:

```
~/.looplia/sandbox/article-2025-12-18-xk7m/
├── inputs/
│   └── content.md           ← Original article (copied by CLI)
├── outputs/
│   ├── summary.json         ← Written by content-analyzer
│   ├── ideas.json           ← Written by idea-generator
│   └── writing-kit.json     ← Written by writing-kit-builder (FINAL)
├── validation.json          ← Tracks validated: true/false per output
└── logs/
    └── query-*.log          ← Session logs
```

---

## Context Injection Order

| Order | Content | Source File | Trigger |
|-------|---------|-------------|---------|
| 1 | Workspace instructions | `CLAUDE.md` | Auto-loaded on session start |
| 2 | Slash command definition | `commands/run.md` | When `/run` is invoked |
| 3 | Core execution skill | `skills/workflow-executor/SKILL.md` | Via `Skill` tool |
| 4 | Workflow definition | `workflows/writing-kit.md` | Read by workflow-executor |
| 5 | skill-executor subagent | (universal - no file) | Via `Task` tool with step's skill+mission |
| 6 | Step skill | `skills/{skill}/SKILL.md` | Via `Skill` tool in skill-executor |
| 7 | Validation hook | `post-write-validate.sh` | After artifact write |
| 8 | State re-injection | `compact-inject-state.sh` | On context compaction |

---

## Box Details

### BOX 1: CLAUDE.md (Workspace Root)

**Location:** `~/.looplia/CLAUDE.md`
**Trigger:** Auto-loaded when Claude Agent SDK starts a session in this workspace

This is the entry point that tells Claude it's a Looplia workflow interpreter. Contains:
- Available slash commands
- Workspace structure overview
- Core skill references
- Validation-driven completion rules

### BOX 2: commands/run.md

**Location:** `~/.looplia/commands/run.md`
**Trigger:** When user or CLI sends `/run` command

Defines the `/run` command syntax and behavior. Instructs Claude to:
- Validate workflow exists
- Handle sandbox creation/resume
- Delegate to workflow-executor skill

### BOX 3: workflow-executor/SKILL.md

**Location:** `~/.looplia/.claude/skills/workflow-executor/SKILL.md`
**Trigger:** Claude uses the `Skill` tool with `workflow-executor`

The core execution engine. Contains the 8-phase protocol:
1. Sandbox management
2. Workflow loading
3. Validation state generation
4. Dependency resolution
5. Output execution loop
6. Subagent invocation
7. Validation
8. Return final artifact

### BOX 4: workflows/{name}.md

**Location:** `~/.looplia/workflows/writing-kit.md`
**Trigger:** Read by workflow-executor during Phase 2

Workflow definition with YAML frontmatter (v0.6.1 skills-first format):
- `steps:` array with ordered step definitions
- `skill:` specifies which skill to load
- `mission:` provides natural language guidance for the skill
- `needs:` defines dependencies between steps
- `final: true` marks the final output step

**Critical mapping:** `skill:` + `mission:` → `subagent_type: "skill-executor"`

### BOX 5: skill-executor Subagent (v0.6.1)

**Trigger:** Via `Task` tool with `subagent_type: "skill-executor"`

In v0.6.1, ONE universal subagent handles all workflow steps:
- Receives skill name and mission from workflow step
- Loads the specified skill's SKILL.md
- Executes the mission using skill's domain expertise
- Writes output to the step's defined path

**Key change from v0.6.0:** No more per-step agent definitions. The skill-executor is universal.

### BOX 6: Skills

**Location:** `~/.looplia/.claude/skills/{name}/SKILL.md`
**Trigger:** Via `Skill` tool within subagent context

Domain-specific expertise loaded on demand:
- `media-reviewer` - Content analysis
- `content-documenter` - Structured output
- `user-profile-reader` - Personalization
- `id-generator` - ContentId generation

### BOX 7: workflow-validator

**Location:** `~/.looplia/.claude/skills/workflow-validator/`
**Trigger:** After each artifact is written

Deterministic validation (no LLM tokens):
- Runs `scripts/validate.ts` via Bun
- Checks required fields, array lengths, etc.
- Updates `validation.json` state

### BOX 8: compact-inject-state.sh

**Location:** `~/.looplia/scripts/hooks/compact-inject-state.sh`
**Trigger:** `SessionStart:compact` hook event

Ensures workflow continuity after context compaction:
- Finds most recent active sandbox
- Reads validation.json progress
- Re-injects state summary into new context

---

## Hook System: Validation Protection

The hook system provides **deterministic guardrails** that protect workflow validation integrity. These hooks run outside the LLM context, ensuring validation cannot be bypassed.

### Hook Configuration

**Location:** `~/.looplia/hooks/hooks.json`

```json
{
  "hooks": [
    { "event": "SessionStart", "command": "echo '>>> Looplia session started'" },
    { "event": "PostToolUse", "matcher": "Write", "command": "post-write-validate.sh" },
    { "event": "Stop", "command": "stop-guard.sh" },
    { "event": "SessionStart", "matcher": "compact", "command": "compact-inject-state.sh" }
  ]
}
```

### Hook Protection Diagram

```
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                         HOOK SYSTEM: VALIDATION PROTECTION                             ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝

                              ┌──────────────────────┐
                              │   WORKFLOW START     │
                              └──────────┬───────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ HOOK 1: SessionStart                                                                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Trigger: Session begins                                                                 │
│ Action:  echo '>>> Looplia session started'                                            │
│ Purpose: Log session initialization for debugging                                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  WORKFLOW EXECUTION  │
                              │  (subagent loop)     │
                              └──────────┬───────────┘
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │                              │                              │
          ▼                              ▼                              ▼
   ┌─────────────┐                ┌─────────────┐                ┌─────────────┐
   │ Subagent    │                │ Subagent    │                │ Subagent    │
   │ writes      │                │ writes      │                │ writes      │
   │ summary.json│                │ ideas.json  │                │ writing-kit │
   └──────┬──────┘                └──────┬──────┘                └──────┬──────┘
          │                              │                              │
          ▼                              ▼                              ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ HOOK 2: PostToolUse (Write) — post-write-validate.sh                                   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                        ┃
┃  Trigger: EVERY Write tool call completes                                              ┃
┃  Matcher: Write tool only                                                              ┃
┃                                                                                        ┃
┃  ┌─────────────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ INPUT: { "tool_input": { "file_path": "sandbox/{id}/outputs/summary.json" } }   │   ┃
┃  └─────────────────────────────────────────────────────────────────────────────────┘   ┃
┃                                         │                                              ┃
┃                                         ▼                                              ┃
┃  ┌─────────────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ CHECK 1: Is path in sandbox/?                                                   │   ┃
┃  │          if [[ "$FILE_PATH" != *"/sandbox/"* ]]; then exit 0; fi                │   ┃
┃  └─────────────────────────────────────────────────────────────────────────────────┘   ┃
┃                                         │ YES                                          ┃
┃                                         ▼                                              ┃
┃  ┌─────────────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ CHECK 2: Is path in outputs/?                                                   │   ┃
┃  │          if [[ "$FILE_PATH" != *"/outputs/"* ]]; then exit 0; fi                │   ┃
┃  └─────────────────────────────────────────────────────────────────────────────────┘   ┃
┃                                         │ YES                                          ┃
┃                                         ▼                                              ┃
┃  ┌─────────────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ CHECK 3: Does validation.json exist?                                            │   ┃
┃  │          if [[ ! -f "$VALIDATION_JSON" ]]; then exit 0; fi                      │   ┃
┃  └─────────────────────────────────────────────────────────────────────────────────┘   ┃
┃                                         │ YES                                          ┃
┃                                         ▼                                              ┃
┃  ┌─────────────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ CHECK 4: Is artifact valid JSON?                                                │   ┃
┃  │          if ! jq empty "$FILE_PATH"; then exit 2; fi  ← BLOCKS ON INVALID JSON  │   ┃
┃  └─────────────────────────────────────────────────────────────────────────────────┘   ┃
┃                                         │ VALID                                        ┃
┃                                         ▼                                              ┃
┃  ┌─────────────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ ACTION: Update validation.json                                                  │   ┃
┃  │         jq '.steps[$art].validated = true' validation.json > tmp && mv         │   ┃
┃  │         echo "✓ Validated: summary.json"                                        │   ┃
┃  └─────────────────────────────────────────────────────────────────────────────────┘   ┃
┃                                                                                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  ALL OUTPUTS DONE?   │
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  CLAUDE ATTEMPTS TO  │
                              │  STOP / COMPLETE     │
                              └──────────┬───────────┘
                                         │
                                         ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ HOOK 3: Stop — stop-guard.sh                                                           ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                        ┃
┃  Trigger: Claude agent attempts to stop/complete                                       ┃
┃  Purpose: BLOCK completion if ANY output is not validated                              ┃
┃                                                                                        ┃
┃  ┌─────────────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ 1. Find active sandbox (most recently modified)                                 │   ┃
┃  │    SANDBOX_DIR=$(ls -td "$SANDBOX_BASE"/*/ | head -1)                           │   ┃
┃  └─────────────────────────────────────────────────────────────────────────────────┘   ┃
┃                                         │                                              ┃
┃                                         ▼                                              ┃
┃  ┌─────────────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ 2. Read validation.json                                                         │   ┃
┃  │    Check: .steps | to_entries[] | select(.value.validated == false)            │   ┃
┃  └─────────────────────────────────────────────────────────────────────────────────┘   ┃
┃                                         │                                              ┃
┃                     ┌───────────────────┴───────────────────┐                          ┃
┃                     │                                       │                          ┃
┃                     ▼                                       ▼                          ┃
┃  ┌─────────────────────────────────┐     ┌─────────────────────────────────────────┐   ┃
┃  │ PENDING OUTPUTS FOUND           │     │ ALL OUTPUTS VALIDATED                   │   ┃
┃  │                                 │     │                                         │   ┃
┃  │ Output:                         │     │ Output: (none - exit 0)                 │   ┃
┃  │ {                               │     │                                         │   ┃
┃  │   "decision": "block",          │     │ Result: ALLOW STOP                      │   ┃
┃  │   "reason": "Workflow           │     │                                         │   ┃
┃  │     incomplete. Pending         │     │                                         │   ┃
┃  │     outputs: ideas, writing-kit"│     │                                         │   ┃
┃  │ }                               │     │                                         │   ┃
┃  │                                 │     │                                         │   ┃
┃  │ Result: BLOCK STOP              │     │                                         │   ┃
┃  │ Claude must continue working    │     │                                         │   ┃
┃  └─────────────────────────────────┘     └─────────────────────────────────────────┘   ┃
┃                                                                                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                         │
                                         │ If context becomes too long...
                                         ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ HOOK 4: SessionStart:compact — compact-inject-state.sh                                 ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                        ┃
┃  Trigger: Context compaction (conversation too long, summarized)                       ┃
┃  Matcher: "compact" event subtype                                                      ┃
┃  Purpose: Re-inject workflow state so Claude knows where it left off                   ┃
┃                                                                                        ┃
┃  ┌─────────────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ 1. Find most recent sandbox                                                     │   ┃
┃  │ 2. Read validation.json                                                         │   ┃
┃  │ 3. Output progress summary:                                                     │   ┃
┃  │                                                                                 │   ┃
┃  │    === Active Sandbox: article-2025-12-18-xk7m ===                              │   ┃
┃  │    Workflow: writing-kit                                                        │   ┃
┃  │                                                                                 │   ┃
┃  │    Progress:                                                                    │   ┃
┃  │      - summary: ✓ validated                                                     │   ┃
┃  │      - ideas: ✓ validated                                                       │   ┃
┃  │      - writing-kit: ⏳ pending                                                  │   ┃
┃  │                                                                                 │   ┃
┃  │    Next: Complete pending outputs in dependency order.                          │   ┃
┃  └─────────────────────────────────────────────────────────────────────────────────┘   ┃
┃                                                                                        ┃
┃  This ensures Claude resumes from the correct step after context compaction.           ┃
┃                                                                                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │   WORKFLOW COMPLETE  │
                              │   (all validated)    │
                              └──────────────────────┘
```

### Hook Summary Table

| Hook | Event | Script | Protection |
|------|-------|--------|------------|
| **SessionStart** | Session begins | `echo` | Logging/debugging |
| **PostToolUse:Write** | After Write tool | `post-write-validate.sh` | Auto-validates artifacts, blocks invalid JSON |
| **Stop** | Agent tries to stop | `stop-guard.sh` | Blocks completion until all outputs validated |
| **SessionStart:compact** | Context compacted | `compact-inject-state.sh` | Re-injects state for continuity |

### Why Hooks Protect Validation

1. **Deterministic Execution**: Hooks run as shell scripts outside the LLM - they cannot be "convinced" to skip validation

2. **Automatic Triggering**: PostToolUse hooks fire on EVERY Write call - Claude cannot write to `outputs/` without triggering validation

3. **Completion Blocking**: The Stop hook enforces that ALL outputs must be validated before the workflow can complete

4. **State Recovery**: The compact hook ensures long-running workflows don't lose progress when context is summarized

### Hook Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              HOOK DATA FLOW                                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
                    │           validation.json               │
                    │  {                                      │
                    │    "workflow": "writing-kit",           │
                    │    "outputs": {                         │
                    │      "summary": { "validated": true },  │◄──┐
                    │      "ideas": { "validated": true },    │◄──┤ Updated by
                    │      "writing-kit": { "validated": false}│◄──┤ post-write-validate.sh
                    │    }                                    │   │
                    │  }                                      │   │
                    └──────────────────┬──────────────────────┘   │
                                       │                          │
                    ┌──────────────────┴──────────────────────┐   │
                    │                                         │   │
                    ▼                                         ▼   │
        ┌───────────────────────┐             ┌───────────────────────┐
        │   stop-guard.sh       │             │ compact-inject-state  │
        │   reads to check      │             │ reads to re-inject    │
        │   completion status   │             │ progress state        │
        └───────────────────────┘             └───────────────────────┘
                    │                                         │
                    ▼                                         ▼
        ┌───────────────────────┐             ┌───────────────────────┐
        │ IF pending:           │             │ Outputs to Claude:    │
        │ {"decision":"block"}  │             │ "summary: ✓ validated"│
        │                       │             │ "ideas: ⏳ pending"   │
        │ ELSE: allow stop      │             │                       │
        └───────────────────────┘             └───────────────────────┘
```

### Protection Scenarios

**Scenario 1: Invalid JSON Written**
```
Subagent writes: { invalid json
  ↓
PostToolUse:Write hook triggers
  ↓
jq empty fails → exit 2
  ↓
Write is rejected, validation.json NOT updated
  ↓
Claude receives error, must retry
```

**Scenario 2: Claude Tries to Stop Early**
```
Claude: "I'm done!" (attempts to stop)
  ↓
Stop hook triggers
  ↓
Reads validation.json: ideas.validated = false
  ↓
Returns: {"decision": "block", "reason": "Pending: ideas, writing-kit"}
  ↓
Claude forced to continue working
```

**Scenario 3: Context Compaction Mid-Workflow**
```
Context gets too long → compaction triggered
  ↓
New session starts (history summarized)
  ↓
SessionStart:compact hook triggers
  ↓
Outputs: "=== Active Sandbox: ... ==="
         "summary: ✓ validated"
         "ideas: ⏳ pending"
  ↓
Claude knows to continue from ideas step
```

---

## Execution Flow Example

```
$ looplia run writing-kit --file ~/articles/draft.md

1. [CLI] Create sandbox: sandbox/draft-2025-12-18-xk7m/
2. [CLI] Copy: draft.md → sandbox/.../inputs/content.md
3. [CLI] Call Claude Agent SDK with prompt: "/run writing-kit --sandbox-id draft-2025-12-18-xk7m"

4. [CLAUDE] Load CLAUDE.md (BOX 1)
5. [CLAUDE] Read commands/run.md (BOX 2)
6. [CLAUDE] Use workflow-executor skill (BOX 3)
7. [CLAUDE] Read workflows/writing-kit.md (BOX 4)
8. [CLAUDE] Generate validation.json
9. [CLAUDE] Compute order: [summary, ideas, writing-kit]

10. [CLAUDE] Task tool → skill-executor (BOX 5) with skill=media-reviewer
    [SUBAGENT] Load media-reviewer skill (BOX 6)
    [SUBAGENT] Execute mission: "Analyze content..."
    [SUBAGENT] Read inputs/content.md
    [SUBAGENT] Write outputs/summary.json
    [HOOK] PostToolUse:Write → post-write-validate.sh → validates JSON
11. [CLAUDE] Update validation.json: summary.validated = true

12. [CLAUDE] Task tool → skill-executor (BOX 5) with skill=idea-synthesis
    [SUBAGENT] Load idea-synthesis skill (BOX 6)
    [SUBAGENT] Execute mission: "Generate angles..."
    [SUBAGENT] Read outputs/summary.json + user-profile.json
    [SUBAGENT] Write outputs/ideas.json
    [HOOK] PostToolUse:Write → validates JSON
13. [CLAUDE] Update validation.json: ideas.validated = true

14. [CLAUDE] Task tool → skill-executor (BOX 5) with skill=writing-kit-assembler
    [SUBAGENT] Load writing-kit-assembler skill (BOX 6)
    [SUBAGENT] Execute mission: "Combine summary and ideas..."
    [SUBAGENT] Read summary.json + ideas.json
    [SUBAGENT] Write outputs/writing-kit.json
    [HOOK] PostToolUse:Write → validates JSON
15. [CLAUDE] Update validation.json: writing-kit.validated = true (all done)

16. [CLAUDE] Return final artifact: writing-kit.json
    [HOOK] Stop → stop-guard.sh → all validated → allows completion
```

---

## Related Documents

- [AGENTIC_CONCEPT_1.0.md](./AGENTIC_CONCEPT_1.0.md) - Skills-first architecture overview
- [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) - v0.6.1 skills-first architecture
- [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) - v0.6.2 schema-in-skill architecture
- [HOOK_VALIDATOR.md](./HOOK_VALIDATOR.md) - Hook system implementation
- [archive/AGENTIC_CONCEPT-0.5.md](./archive/AGENTIC_CONCEPT-0.5.md) - Agent system design (historical)

---

*This document illustrates the context injection flow for Looplia-Core v0.6.1.*
