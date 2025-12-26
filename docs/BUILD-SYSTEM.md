# Looplia Workflow Build System

> **Overview:** How `looplia build` creates workflows via two distinct modes.
>
> **Version:** 0.6.4
> **Related:** [DESIGN-0.6.4.md](./DESIGN-0.6.4.md) | [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)

---

## Two Build Modes

| Mode | Invocation | Execution |
|------|------------|-----------|
| **Slash Command** (Batch) | `looplia build "description"` or `--no-interactive` | Server-side (agent) |
| **Interactive Wizard** | `looplia build` (no args, TTY) | Client-side (Ink TUI) |

---

## Mode 1: Slash Command (Batch)

**When Used:** Non-interactive terminals, CI/CD, `--no-interactive` flag

**Flow:**

```
looplia build "analyze videos" --name my-workflow
           |
   buildPrompt() -> "/build --name my-workflow analyze videos"
           |
   executor.executePrompt(prompt)
           |
   Agent executes /build command (3-skill pipeline):
     1. plugin-registry-scanner -> discover skills
     2. skill-capability-matcher -> match to requirements
     3. workflow-schema-composer -> generate workflow
           |
   Agent writes workflow file
```

**Characteristics:**
- Single API call
- No user interaction
- Agent handles everything (discovery, matching, generation)
- Uses plugin's `/build` command definition

**Files:** `build.ts` -> `/build` plugin command

---

## Mode 2: Interactive Wizard

**When Used:** TTY terminal, no `--no-interactive` flag

**Flow:**

```
looplia build
    |
Phase 1: Description Input (user types/confirms)
    |
Phase 2: analyzeDescription()
    -> Agent uses skill-capability-matcher
    -> Returns recommendations + clarification questions
    |
Phase 3: Clarification (Tab UI)
    -> User answers questions across tabs
    -> Each question = one tab
    |
Phase 4: buildPreview() <- CLIENT-SIDE, no API call!
    -> Matches answers to skill recommendations
    -> Constructs workflow locally
    |
CLI writes workflow file directly
```

**Characteristics:**
- 1 API call (analysis only)
- Multi-turn dialog with user
- Workflow built client-side (`preview-builder.ts`)
- More responsive (no agent round-trips for editing)

**Files:** `build.ts` -> `wizard.tsx` -> `skill-analyzer.ts` -> `preview-builder.ts`

---

## Skill Usage Comparison

| Phase | Slash Command | Wizard |
|-------|--------------|--------|
| **Skill Discovery** | Agent runs `plugin-registry-scanner` | Agent runs `plugin-registry-scanner` |
| **Skill Matching** | Agent runs `skill-capability-matcher` | Agent returns recommendations in JSON |
| **Workflow Generation** | Agent runs `workflow-schema-composer` | **Client-side** `buildPreview()` |
| **File Write** | Agent writes file | CLI writes file |

**Key Insight:** The wizard gets skill recommendations during analysis, then builds the workflow locally. This makes editing instant (no API latency).

---

## skill-capability-matcher Enhancement (v0.6.4)

The skill was enhanced to return **clarification questions** alongside recommendations.

### Before (v0.6.3)

Only returned skill recommendations:

```json
{
  "recommendations": [
    { "skill": "media-reviewer", "matchScore": 0.9 }
  ],
  "suggestedSequence": ["analyze", "generate"]
}
```

### After (v0.6.4)

Added `clarifications` schema for wizard UI:

```json
{
  "recommendations": [
    { "goalId": "analyze", "skill": "media-reviewer", "matchScore": 0.9 }
  ],
  "clarificationNeeded": true,
  "clarifications": {
    "sections": [
      {
        "id": "source",
        "title": "Source",
        "questions": [
          {
            "id": "content-type",
            "text": "What type of content?",
            "type": "single-select",
            "options": [
              { "id": "video", "label": "Video transcripts", "inferred": true }
            ],
            "reason": "Inferred 'video' from description"
          }
        ]
      }
    ]
  }
}
```

### New Fields

| Field | Purpose |
|-------|---------|
| `clarificationNeeded` | Should wizard show questions? |
| `clarifications.sections` | Tab structure for wizard UI |
| `question.type` | `single-select`, `multi-select`, `text` |
| `option.inferred` | Pre-select if matched from description |
| `recommendation.goalId` | Link skill to user-selected goal |

---

## Component Architecture

```
apps/cli/src/components/
|-- inputs/                    # Reusable input primitives
|   |-- text-input.tsx         # Text input with cursor
|   |-- select-input.tsx       # Single-select (radio)
|   |-- multi-select-input.tsx # Multi-select (checkbox)
|   +-- index.ts
|
+-- wizard/                    # Build wizard components
    |-- wizard.tsx             # Main orchestrator (state machine)
    |-- tab-bar.tsx            # Section navigation tabs
    |-- question-card.tsx      # Renders individual question
    |-- section-view.tsx       # Renders section content
    |-- review-panel.tsx       # Summary + live preview
    |-- preview-builder.ts     # Client-side preview generation
    |-- skill-analyzer.ts      # Calls skill-capability-matcher
    |-- render.tsx             # renderBuildWizard() entry point
    |-- types.ts               # Type definitions
    +-- index.ts               # Re-exports
```

---

## When to Use Each Mode

| Scenario | Recommended Mode |
|----------|-----------------|
| Quick workflow from clear description | Batch (`--no-interactive`) |
| Exploratory "I want to build something" | Wizard (interactive) |
| CI/CD automation | Batch |
| Complex multi-step workflow | Wizard |
| First-time users | Wizard |

---

## Cross-References

- **Wizard Design:** [DESIGN-0.6.4.md](./DESIGN-0.6.4.md)
- **3-Skill Pipeline:** [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)
- **Input System:** [DESIGN-0.6.3.md](./DESIGN-0.6.3.md)
