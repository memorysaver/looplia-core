# Looplia-Core Architecture Design v0.6.4

> **FEATURE RELEASE:** Interactive Build Wizard with Multi-Turn Clarification
>
> **Version:** 0.6.4
> **Date:** 2025-12-25
> **Related:** [DESIGN-0.6.3.md](./DESIGN-0.6.3.md) | [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Wizard Flow Architecture](#4-wizard-flow-architecture)
5. [AI-Generated Clarifications](#5-ai-generated-clarifications)
6. [TUI Component Architecture](#6-tui-component-architecture)
7. [Live Preview System](#7-live-preview-system)
8. [State Management](#8-state-management)
9. [Keyboard Navigation](#9-keyboard-navigation)
10. [Command Integration](#10-command-integration)
11. [Implementation Guide](#11-implementation-guide)
12. [File Changes Summary](#12-file-changes-summary)

---

## 1. Executive Summary

### Feature Release: v0.6.3 → v0.6.4

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.3 | Flexible Input System | Workflows support 0 to N named inputs |
| **v0.6.4** | **Interactive Build Wizard** | **Multi-turn TUI for clarifying workflow requirements** |

### What Changes in v0.6.4

v0.6.4 implements a comprehensive interactive workflow builder:

1. **WIZARD-STYLE TUI:** Tab-based navigation through clarification sections
2. **AI-GENERATED QUESTIONS:** skill-capability-matcher extended to generate clarifying questions
3. **LIVE PREVIEW:** Client-side workflow preview updates as user answers questions
4. **MULTI-QUESTION SECTIONS:** Each tab can contain multiple questions
5. **ITERATIVE REFINEMENT:** User answers inform final workflow generation

### Design Principle

> **AI-First, Human-Refinable**
>
> The build wizard embodies looplia's core philosophy: AI proposes, human refines.
> Rather than requiring users to write YAML, the wizard guides them through
> natural language clarification, with AI-inferred defaults that users confirm or change.

### The Shift

```
BEFORE (v0.6.3):
  looplia build "analyze videos"        # Immediate generation, may miss details
  looplia build                         # Error: description required

AFTER (v0.6.4):
  looplia build                         # Opens interactive wizard
  looplia build "analyze videos"        # Wizard with pre-filled description
  looplia build --no-interactive "..."  # Batch mode (unchanged)
```

---

## 2. Problem Statement

### 2.1 The Immediate Generation Problem

Current (v0.6.3) build command requires a complete description upfront:

```bash
looplia build "analyze YouTube videos and create blog outlines"
```

This fails for common user patterns:

| User Pattern | Current Behavior | Desired Behavior |
|--------------|-----------------|------------------|
| Exploratory: "I want to build something" | Error: no description | Guided wizard |
| Vague: "process videos" | Generates possibly wrong workflow | Ask clarifying questions |
| Complex: multi-step workflow | May miss requirements | Step-by-step refinement |

### 2.2 Missing Interactive Mode

The `/build` command's design doc (DESIGN-0.6.1.md Section 6.4) specified a 4-phase TUI:

| Phase | Design Status | Implementation Status |
|-------|--------------|----------------------|
| Phase 1: Requirements | Specified | **Not Implemented** |
| Phase 2: Processing | Specified | Implemented |
| Phase 3: Preview | Specified | Partial |
| Phase 4: Save | Specified | Partial |

**The TUI jumps directly to Phase 2**, skipping the critical requirements gathering phase.

### 2.3 Error Observed

```bash
$ looplia build

❌ Build failed: Build command requires workflow description.
   Please provide: /build [description] or /build --name <name> [description]
```

---

## 3. Solution Overview

### 3.1 Wizard-Style TUI

Implement a multi-phase interactive wizard that guides users through workflow creation:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          BUILD WIZARD FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

   User runs: looplia build
              │
              ▼
   ┌──────────────────────┐
   │ 1. Description Input │  ← Text input for initial description
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │ 2. Analyze & Generate│  ← plugin-registry-scanner + skill-capability-matcher
   │    Questions         │    (extended to return clarifying questions)
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ 3. Wizard UI - Tab Navigation                                        │
   │  ┌────────────────────────────────────────────────────────────────┐  │
   │  │  [Input ✓]  [Goals]  [Output]  [Review]                        │  │
   │  │ ════════════════════════════════════════════════════════════   │  │
   │  │                                                                │  │
   │  │  What are the primary goals for this workflow?                 │  │
   │  │                                                                │  │
   │  │    ● Analyze and extract key insights                         │  │
   │  │    ○ Generate creative content ideas                          │  │
   │  │    ○ Create structured summaries                              │  │
   │  │    ○ Build comprehensive reports                              │  │
   │  │                                                                │  │
   │  │  ──────────────────────────────────────────────────────────── │  │
   │  │  [←/→] Tabs  [↑/↓] Select  [Space] Toggle  [Enter] Next       │  │
   │  └────────────────────────────────────────────────────────────────┘  │
   └──────────┬───────────────────────────────────────────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │ 4. Generate Workflow │  ← workflow-schema-composer with full context
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │ 5. Preview & Save    │  ← Show result, confirm save
   └──────────────────────┘
```

### 3.2 Key Components

| Component | Purpose |
|-----------|---------|
| **Description Phase** | Collect initial natural language description |
| **Analysis Phase** | AI generates clarifying questions based on description + registry |
| **Clarification Phase** | Tab-based UI for answering questions section by section |
| **Preview Phase** | Live workflow preview that updates with answers |
| **Generation Phase** | Final workflow creation with full context |

---

## 4. Wizard Flow Architecture

### 4.1 Phase 1: Description Input

The first phase collects the user's initial workflow description:

```
┌─ Workflow Builder ────────────────────────────────────────────────────┐
│                                                                       │
│  What should this workflow do?                                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ analyze YouTube videos and create blog outlines█                │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  [Enter] Continue   [Esc] Cancel                                      │
└───────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Text input with cursor
- Enter submits and moves to Phase 2
- Esc cancels the wizard
- If CLI provides `--name` or initial description, pre-fill the input

### 4.2 Phase 2: Analysis & Question Generation

After receiving the description, the wizard:

1. Calls `plugin-registry-scanner` to discover available skills
2. Calls `skill-capability-matcher` with description + registry
3. Matcher returns:
   - `recommendations[]` - Matched skills for goals
   - `clarifications{}` - AI-generated questions organized by section

```
┌─ Workflow Builder ────────────────────────────────────────────────────┐
│                                                                       │
│  ⠙ Analyzing your requirements...                                    │
│                                                                       │
│  ✓ Scanned plugin registry (7 skills available)                      │
│  ⠙ Generating clarifying questions...                                │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 4.3 Phase 3: Clarification (Tab Navigation)

The main wizard UI with tab-based navigation:

```
┌─ Workflow Builder ────────────────────────────────────────────────────┐
│  [Input ✓]  [Goals ●]  [Output]  [Review]                            │
│ ══════════════════════════════════════════════════════════════════════│
│                                                                       │
│  What are the primary goals for this workflow?                        │
│                                                                       │
│    ● Analyze and extract key insights                                │
│    ○ Generate creative content ideas                                 │
│    ○ Create structured summaries                                     │
│    ○ Build comprehensive reports                                     │
│                                                                       │
│  ─────────────────────────────────────────────────────────────────── │
│  How deep should the analysis be?                                     │
│                                                                       │
│    ○ Quick overview (1-2 key points)                                 │
│    ● Standard analysis (5-7 key points)                              │
│    ○ Deep analysis (comprehensive)                                   │
│                                                                       │
│  ─────────────────────────────────────────────────────────────────── │
│  [←/→] Tabs  [↑/↓] Select  [Space] Toggle  [Enter] Next              │
└───────────────────────────────────────────────────────────────────────┘
```

**Tabs:**
- `[Input]` - Content type, source format
- `[Goals]` - What to accomplish, depth of analysis
- `[Output]` - Output format, structure
- `[Review]` - Summary + live preview

### 4.4 Phase 4: Review with Live Preview

The Review tab shows answers and a live workflow preview:

```
┌─ Workflow Builder ────────────────────────────────────────────────────┐
│  [Input ✓]  [Goals ✓]  [Output ✓]  [Review ●]                        │
│ ══════════════════════════════════════════════════════════════════════│
│                                                                       │
│  ── Your Answers ──────────────────────────────────────────────────  │
│  Input:  Video transcripts                                           │
│  Goals:  Analyze insights, Create summaries                          │
│  Output: Structured JSON                                             │
│                                                                       │
│  ── Workflow Preview ──────────────────────────────────────────────  │
│  video-analyzer (3 steps)                                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 1. analyze-content                                             │  │
│  │    skill: media-reviewer                                       │  │
│  │    output: analysis.json                                       │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ 2. generate-summary                                            │  │
│  │    skill: content-documenter                                   │  │
│  │    needs: [analyze-content]                                    │  │
│  │    output: summary.json                                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  [Enter] Generate & Save   [←] Edit Answers   [Esc] Cancel           │
└───────────────────────────────────────────────────────────────────────┘
```

### 4.5 Phase 5: Generation & Save

Final generation uses `workflow-schema-composer` with full context:
- Original description
- User answers from all sections
- Skill recommendations
- Inferred workflow structure

```
┌─ Workflow Builder ────────────────────────────────────────────────────┐
│                                                                       │
│  ✅ Workflow created successfully!                                    │
│                                                                       │
│  Path: ~/.looplia/workflows/video-analyzer.md                        │
│  Steps: 3                                                            │
│                                                                       │
│  Run with:                                                           │
│    looplia run video-analyzer --file <transcript.md>                 │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 5. AI-Generated Clarifications

### 5.1 Enhanced skill-capability-matcher

Extend the existing `skill-capability-matcher` skill to return clarifying questions.

**File:** `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md`

**New Output Schema:**

```json
{
  "requirements": {
    "inputType": "video transcript",
    "goals": ["extract key points"],
    "outputFormat": "structured JSON"
  },
  "recommendations": [
    {
      "goalId": "analyze",
      "skill": "media-reviewer",
      "stepId": "analyze-content",
      "matchScore": 0.92,
      "rationale": "Primary analysis skill for content understanding"
    },
    {
      "goalId": "summarize",
      "skill": "content-documenter",
      "stepId": "generate-summary",
      "matchScore": 0.88,
      "rationale": "Transforms analysis into structured output"
    }
  ],
  "clarificationNeeded": true,
  "clarifications": {
    "sections": [
      {
        "id": "input",
        "title": "Input",
        "completed": false,
        "questions": [
          {
            "id": "content-type",
            "text": "What type of content will this workflow process?",
            "type": "single-select",
            "options": [
              { "id": "video", "label": "Video transcripts", "inferred": true },
              { "id": "audio", "label": "Audio transcripts" },
              { "id": "text", "label": "Text articles" },
              { "id": "web", "label": "Web pages (fetched via search)" }
            ],
            "reason": "Inferred 'video' from description, confirm or change"
          }
        ]
      },
      {
        "id": "goals",
        "title": "Goals",
        "completed": false,
        "questions": [
          {
            "id": "primary-goal",
            "text": "What are the primary goals for this workflow?",
            "type": "multi-select",
            "options": [
              { "id": "analyze", "label": "Analyze and extract key insights" },
              { "id": "summarize", "label": "Create structured summaries" },
              { "id": "generate", "label": "Generate creative content ideas" },
              { "id": "document", "label": "Build comprehensive reports" }
            ]
          },
          {
            "id": "depth",
            "text": "How deep should the analysis be?",
            "type": "single-select",
            "options": [
              { "id": "quick", "label": "Quick overview (1-2 key points)" },
              { "id": "standard", "label": "Standard analysis (5-7 key points)" },
              { "id": "deep", "label": "Deep analysis (comprehensive)" }
            ]
          }
        ]
      },
      {
        "id": "output",
        "title": "Output",
        "completed": false,
        "questions": [
          {
            "id": "format",
            "text": "What output format do you need?",
            "type": "single-select",
            "options": [
              { "id": "json", "label": "Structured JSON" },
              { "id": "markdown", "label": "Markdown document" },
              { "id": "both", "label": "Both JSON and Markdown" }
            ]
          }
        ]
      },
      {
        "id": "review",
        "title": "Review",
        "completed": false,
        "questions": []
      }
    ]
  }
}
```

### 5.2 Question Types

| Type | Description | UI Component |
|------|-------------|--------------|
| `single-select` | Choose one option | Radio buttons (○/●) |
| `multi-select` | Choose multiple options | Checkboxes (☐/✓) |
| `text` | Free-form text input | Text input with cursor |

### 5.3 Inference Markers

Questions can include `inferred: true` on options that the AI pre-selected based on the description:

```json
{
  "options": [
    { "id": "video", "label": "Video transcripts", "inferred": true },
    { "id": "audio", "label": "Audio transcripts" }
  ],
  "reason": "Inferred 'video' from description mentioning 'YouTube'"
}
```

The TUI shows these as pre-selected, with a note explaining the inference.

---

## 6. TUI Component Architecture

### 6.1 Component Hierarchy

```
apps/cli/src/components/
├── inputs/                          # Reusable input primitives
│   ├── text-input.tsx               # Text input with cursor
│   ├── select-input.tsx             # Single-select (radio)
│   ├── multi-select-input.tsx       # Multi-select (checkbox)
│   └── index.ts                     # Exports
│
└── build/                           # Build wizard components
    ├── wizard.tsx                   # Main orchestrator (state machine)
    ├── tab-bar.tsx                  # Section navigation tabs
    ├── question-card.tsx            # Renders individual question
    ├── section-view.tsx             # Renders all questions in a section
    ├── review-panel.tsx             # Summary + live preview
    ├── preview-builder.ts           # Client-side preview generation
    └── index.tsx                    # Exports + renderBuildWizard()
```

### 6.2 Input Components

#### TextInput

```typescript
// apps/cli/src/components/inputs/text-input.tsx
import { useInput } from "ink";
import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
};

export function TextInput({ value, onChange, onSubmit, onCancel, placeholder }: Props) {
  useInput((input, key) => {
    if (key.return) {
      onSubmit();
    } else if (key.escape) {
      onCancel();
    } else if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      onChange(value + input);
    }
  });

  return (
    <Box>
      <Text>{value || placeholder}</Text>
      <Text color="cyan">█</Text>
    </Box>
  );
}
```

#### SelectInput

```typescript
// apps/cli/src/components/inputs/select-input.tsx
type Option = {
  id: string;
  label: string;
  inferred?: boolean;
};

type Props = {
  options: Option[];
  selected: string;
  onChange: (id: string) => void;
  onSubmit: () => void;
};

export function SelectInput({ options, selected, onChange, onSubmit }: Props) {
  const [focusIndex, setFocusIndex] = useState(
    options.findIndex(o => o.id === selected) || 0
  );

  useInput((input, key) => {
    if (key.upArrow) {
      setFocusIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setFocusIndex(i => Math.min(options.length - 1, i + 1));
    } else if (key.return || input === ' ') {
      onChange(options[focusIndex].id);
      onSubmit();
    }
  });

  return (
    <Box flexDirection="column">
      {options.map((opt, i) => (
        <Box key={opt.id}>
          <Text color={i === focusIndex ? "cyan" : undefined}>
            {opt.id === selected ? "●" : "○"} {opt.label}
            {opt.inferred && <Text dimColor> (inferred)</Text>}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

#### MultiSelectInput

```typescript
// apps/cli/src/components/inputs/multi-select-input.tsx
type Props = {
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onSubmit: () => void;
};

export function MultiSelectInput({ options, selected, onChange, onSubmit }: Props) {
  const [focusIndex, setFocusIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setFocusIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setFocusIndex(i => Math.min(options.length - 1, i + 1));
    } else if (input === ' ') {
      const id = options[focusIndex].id;
      if (selected.includes(id)) {
        onChange(selected.filter(s => s !== id));
      } else {
        onChange([...selected, id]);
      }
    } else if (key.return) {
      onSubmit();
    }
  });

  return (
    <Box flexDirection="column">
      {options.map((opt, i) => (
        <Box key={opt.id}>
          <Text color={i === focusIndex ? "cyan" : undefined}>
            {selected.includes(opt.id) ? "✓" : "☐"} {opt.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

### 6.3 Wizard Components

#### TabBar

```typescript
// apps/cli/src/components/build/tab-bar.tsx
type Section = {
  id: string;
  title: string;
  completed: boolean;
};

type Props = {
  sections: Section[];
  currentIndex: number;
  onNavigate: (index: number) => void;
};

export function TabBar({ sections, currentIndex, onNavigate }: Props) {
  useInput((input, key) => {
    if (key.leftArrow && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    } else if (key.rightArrow && currentIndex < sections.length - 1) {
      onNavigate(currentIndex + 1);
    }
  });

  return (
    <Box>
      {sections.map((section, i) => (
        <Box key={section.id} marginRight={2}>
          <Text
            bold={i === currentIndex}
            color={i === currentIndex ? "cyan" : undefined}
          >
            [{section.title} {section.completed ? "✓" : i === currentIndex ? "●" : ""}]
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

---

## 7. Live Preview System

### 7.1 Client-Side Preview Generation

The live workflow preview is generated **client-side** based on the skill-capability-matcher's recommendations and user answers. This avoids calling the AI repeatedly as answers change.

**File:** `apps/cli/src/components/build/preview-builder.ts`

```typescript
type Recommendation = {
  goalId: string;
  skill: string;
  stepId: string;
};

type Answers = {
  input: Record<string, string | string[]>;
  goals: Record<string, string | string[]>;
  output: Record<string, string | string[]>;
};

type PreviewWorkflow = {
  name: string;
  steps: Array<{
    id: string;
    skill: string;
    needs: string[];
    output: string;
  }>;
};

export function buildPreview(
  answers: Answers,
  recommendations: Recommendation[],
  description: string
): PreviewWorkflow {
  // Get selected goals
  const selectedGoals = (answers.goals['primary-goal'] || []) as string[];

  // Filter recommendations to match selected goals
  const matchedRecommendations = recommendations.filter(r =>
    selectedGoals.includes(r.goalId)
  );

  // Build steps with dependencies
  const steps = matchedRecommendations.map((r, i) => ({
    id: r.stepId,
    skill: r.skill,
    needs: i > 0 ? [matchedRecommendations[i - 1].stepId] : [],
    output: `$\{{ sandbox }}/outputs/${r.stepId}.json`,
  }));

  // Derive workflow name from description
  const name = deriveWorkflowName(description);

  return { name, steps };
}

function deriveWorkflowName(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .join('-') || 'workflow';
}
```

### 7.2 Preview Update Flow

```
User changes answer in Goals tab
         ↓
onChange callback in SectionView
         ↓
WizardState.answers updated
         ↓
buildPreview(answers, recommendations, description)
         ↓
PreviewWorkflow re-computed
         ↓
ReviewPanel re-renders with new preview
```

This is **synchronous and instant** - no API calls needed.

---

## 8. State Management

### 8.1 Wizard State Machine

```typescript
// apps/cli/src/components/build/wizard.tsx

type WizardPhase =
  | 'description'    // Phase 1: Initial text input
  | 'analyzing'      // Phase 2: Calling skill-capability-matcher
  | 'clarifying'     // Phase 3: Tab navigation through sections
  | 'generating'     // Phase 4: Calling workflow-schema-composer
  | 'preview'        // Phase 5: Show result
  | 'complete'       // Done
  | 'error';         // Error state

type WizardState = {
  phase: WizardPhase;
  description: string;
  sections: Section[];
  currentSectionIndex: number;
  answers: Record<string, Record<string, string | string[]>>;
  recommendations: Recommendation[];
  workflow: WorkflowDefinition | null;
  error: Error | null;
};

type Section = {
  id: string;
  title: string;
  completed: boolean;
  questions: Question[];
};

type Question = {
  id: string;
  text: string;
  type: 'single-select' | 'multi-select' | 'text';
  options?: Array<{ id: string; label: string; inferred?: boolean }>;
  reason?: string;
};
```

### 8.2 State Transitions

```
                    ┌──────────────────┐
                    │   description    │
                    └────────┬─────────┘
                             │ Enter
                    ┌────────▼─────────┐
                    │    analyzing     │
                    └────────┬─────────┘
                             │ Questions received
                    ┌────────▼─────────┐
         ┌──────────│   clarifying     │◄─────────┐
         │          └────────┬─────────┘          │
         │ ←/→               │ Enter on Review    │ ← (edit)
         └──────────────────►│                    │
                    ┌────────▼─────────┐          │
                    │   generating     │          │
                    └────────┬─────────┘          │
                             │ Workflow created   │
                    ┌────────▼─────────┐          │
                    │     preview      │──────────┘
                    └────────┬─────────┘
                             │ Save
                    ┌────────▼─────────┐
                    │    complete      │
                    └──────────────────┘
```

---

## 9. Keyboard Navigation

### 9.1 Global Controls

| Key | Action |
|-----|--------|
| `Ctrl+C` | Cancel wizard at any phase |
| `Esc` | Cancel / Go back |

### 9.2 Phase-Specific Controls

| Phase | Key | Action |
|-------|-----|--------|
| Description | `Enter` | Submit description, go to analyzing |
| Description | `Esc` | Cancel wizard |
| Clarifying | `←` | Previous tab |
| Clarifying | `→` | Next tab |
| Clarifying | `↑` | Previous question/option |
| Clarifying | `↓` | Next question/option |
| Clarifying | `Space` | Toggle selection (multi-select) |
| Clarifying | `Enter` | Confirm section / Next section |
| Clarifying | `Tab` | Jump to next section |
| Review | `Enter` | Generate workflow |
| Review | `←` | Go back to edit answers |
| Review | `Esc` | Cancel wizard |
| Preview | `s` | Save workflow |
| Preview | `r` | Regenerate (go back to clarifying) |
| Preview | `Esc` | Cancel without saving |

---

## 10. Command Integration

### 10.1 Build Command Changes

**File:** `apps/cli/src/commands/build.ts`

```typescript
import { renderBuildWizard } from "../components/build";

async function executeStreaming(
  args: BuildArgs,
  workspace: string
): Promise<BuildResult> {
  // Interactive mode: use wizard
  if (isInteractive() && !args.noInteractive) {
    return renderBuildWizard({
      initialDescription: args.description,
      workflowName: args.name,
      workspace,
    });
  }

  // Non-interactive: require description
  if (!args.description) {
    return {
      status: "error",
      error: "Description required in non-interactive mode. Use --no-interactive with a description.",
    };
  }

  // Batch mode: existing streaming flow (unchanged)
  const prompt = buildPrompt(args);
  return executeBatch(prompt, workspace);
}
```

### 10.2 CLI Behavior Matrix

| Invocation | Behavior |
|------------|----------|
| `looplia build` | Opens interactive wizard |
| `looplia build "description"` | Opens wizard with pre-filled description |
| `looplia build --name foo "desc"` | Opens wizard with name + description |
| `looplia build --no-interactive "desc"` | Batch mode (no wizard) |
| `looplia build --no-interactive` | Error: description required |

---

## 11. Implementation Guide

### 11.1 Implementation Order

| Phase | Components | Dependencies |
|-------|------------|--------------|
| 1 | Input components (text, select, multi-select) | Ink useInput |
| 2 | Tab bar component | None |
| 3 | Question card component | Input components |
| 4 | Section view component | Question card |
| 5 | Preview builder (client-side) | None |
| 6 | Review panel component | Preview builder |
| 7 | Wizard orchestrator | All above |
| 8 | skill-capability-matcher update | None |
| 9 | build.ts integration | Wizard |

### 11.2 Testing Strategy

| Test Category | Coverage |
|---------------|----------|
| Unit Tests | Input components, preview builder |
| Component Tests | TabBar, QuestionCard, SectionView |
| Integration Tests | Wizard flow end-to-end |
| E2E Tests | `looplia build` command |

### 11.3 Key Test Cases

1. **Wizard opens when no description provided**
2. **Description pre-fills when provided via CLI**
3. **Tab navigation with ←/→ keys**
4. **Question answers persist across tab switches**
5. **Live preview updates on answer change**
6. **Cancel at any phase exits cleanly**
7. **Final workflow matches user selections**
8. **--no-interactive mode bypasses wizard**

---

## 12. File Changes Summary

### 12.1 Files to Create

| File | Purpose | LOC (est.) |
|------|---------|------------|
| `apps/cli/src/components/inputs/text-input.tsx` | Reusable text input | 40 |
| `apps/cli/src/components/inputs/select-input.tsx` | Single-select input | 50 |
| `apps/cli/src/components/inputs/multi-select-input.tsx` | Multi-select input | 55 |
| `apps/cli/src/components/inputs/index.ts` | Exports | 5 |
| `apps/cli/src/components/build/tab-bar.tsx` | Section navigation | 45 |
| `apps/cli/src/components/build/question-card.tsx` | Question renderer | 60 |
| `apps/cli/src/components/build/section-view.tsx` | Section with questions | 80 |
| `apps/cli/src/components/build/review-panel.tsx` | Summary + live preview | 100 |
| `apps/cli/src/components/build/preview-builder.ts` | Client-side preview | 50 |
| `apps/cli/src/components/build/wizard.tsx` | Main orchestrator | 200 |
| `apps/cli/src/components/build/index.tsx` | Exports + renderBuildWizard | 40 |
| **Total** | | **~725** |

### 12.2 Files to Modify

| File | Changes |
|------|---------|
| `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md` | Add `clarifications` output schema |
| `apps/cli/src/commands/build.ts` | Use wizard in interactive mode |
| `apps/cli/src/components/index.ts` | Export new components |

---

## Cross-References

- **Workflow Building (v0.6.1):** See [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) for 3-skill pipeline
- **Skill-Capability-Matcher:** See [DESIGN-0.6.1.md § 3.4](./DESIGN-0.6.1.md#34-skill-2-skill-capability-matcher)
- **Flexible Inputs (v0.6.3):** See [DESIGN-0.6.3.md](./DESIGN-0.6.3.md) for input system
- **Plugin Architecture:** See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) for plugin structure

---

*This document serves as the single source of truth for Looplia-Core v0.6.4 Interactive Build Wizard architecture.*
