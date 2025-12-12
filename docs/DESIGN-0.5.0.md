# Looplia-Core Architecture Design v0.5.0

> Reliability, Validation, and Clean Architecture Refinements
>
> **Version:** 0.5.0
> **Date:** 2025-12-12
> **Related:** [GLOSSARY.md](./GLOSSARY.md) | [DESIGN-0.4.0.md](./DESIGN-0.4.0.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Analysis](#2-problem-analysis)
3. [Session Manifest System](#3-session-manifest-system)
4. [Intermediate Artifact Validation](#4-intermediate-artifact-validation)
5. [DisplayConfig Decoupling](#5-displayconfig-decoupling)
6. [Updated Architecture Overview](#6-updated-architecture-overview)
7. [Migration Strategy](#7-migration-strategy)
8. [Implementation Plan](#8-implementation-plan)

---

## 1. Executive Summary

### Evolution from v0.4.0 to v0.5.0

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.4.0 | Clean Architecture | CommandDefinition<T> abstraction |
| **v0.5.0** | **Reliability & Purity** | **Session Manifest, Validation, Architecture Refinement** |

### Friction Points Addressed

| Issue | v0.4.0 Behavior | v0.5.0 Solution |
|-------|-----------------|-----------------|
| Smart Continuation Fragility | File existence checks only | Session manifest with step states and content hashes |
| No Intermediate Validation | Only final output validated | Zod validation after each artifact write |
| DisplayConfig in Core | TUI concerns in business logic | Moved to CLI layer |

### Key Improvements

1. **Session Manifest** - `session.json` tracks step states, validation hashes, and schema versions
2. **Artifact Validation** - Each intermediate output validated against Zod schema with retry hints
3. **Clean Architecture Purity** - DisplayConfig moved from core to CLI layer

### Benefits Achieved

| Metric | v0.4.0 | v0.5.0 |
|--------|--------|--------|
| Continuation reliability | File existence (fragile) | Manifest + hash validation |
| Intermediate validation | None (fail at next step) | Per-artifact with retry hints |
| Architecture purity | DisplayConfig in core | Full layer separation |
| Session debugging | Manual file inspection | Manifest-based state visibility |
| Legacy compatibility | N/A | Auto-migration |

---

## 2. Problem Analysis

### 2.1 Smart Continuation Fragility

**v0.4.0 Behavior:**

The agent determines continuation by checking file existence in the prompt:

```typescript
// packages/core/src/commands/kit.ts (v0.4.0)
function buildPrompt(ctx: PromptContext): string {
  return `Task: Build WritingKit for session: contentItem/${ctx.contentId}

## Check Existing Progress
First, check which files already exist in contentItem/${ctx.contentId}/:
- summary.json → If exists, skip content-analyzer
- ideas.json → If exists, skip idea-generator
- writing-kit.json → If exists, return it directly
...`;
}
```

**Failure Modes:**

| Scenario | File State | Agent Decision | Actual Result |
|----------|------------|----------------|---------------|
| Partial write | `summary.json` exists (incomplete) | Skip content-analyzer | Malformed JSON breaks idea-generator |
| Schema change | `summary.json` has v0.4.0 schema | Skip content-analyzer | New fields missing, validation fails later |
| Corrupted file | `summary.json` exists (corrupted) | Skip content-analyzer | JSON parse error |
| Source changed | `content.md` modified | Skip content-analyzer | Stale analysis from old content |

**Impact:** Users experience cryptic failures deep in the pipeline rather than clear error messages at the point of failure.

### 2.2 Missing Intermediate Validation

**v0.4.0 Behavior:**

- Zod schemas exist in `packages/core/src/validation/schemas.ts`
- Only the final `StructuredOutput` is validated by the Claude Agent SDK
- Intermediate artifacts (`summary.json`, `ideas.json`, `outline.json`) are written directly by agents
- No validation occurs until the next subagent attempts to read the file

**Failure Flow:**

```
content-analyzer writes malformed summary.json
    ↓
idea-generator reads summary.json
    ↓
idea-generator fails with unclear error
    ↓
User sees: "Error during execution" (no guidance)
```

**Desired Flow:**

```
content-analyzer writes summary.json
    ↓
Validation interceptor validates against ContentSummarySchema
    ↓
IF invalid: ErrorEvent { recoverable: true, retryHint: "..." }
    ↓
Agent retries OR user gets clear error with guidance
```

### 2.3 DisplayConfig Architecture Leak

**v0.4.0 Behavior:**

`DisplayConfig` is defined in the core layer:

```typescript
// packages/core/src/commands/types.ts (v0.4.0)
export type DisplayConfig = {
  title: string;           // TUI box header
  successMessage: string;  // Post-completion message
  sessionInfoFormat?: string;
  nextStep?: { description: string; commandTemplate: string; } | null;
};

export type CommandDefinition<TOutput> = {
  name: string;
  displayConfig: DisplayConfig;  // ← TUI concerns in business logic
  promptTemplate: (context: PromptContext) => string;
  outputSchema: z.ZodType<TOutput>;
};
```

**Problem:**

- `DisplayConfig` contains TUI-specific concepts (title, success messages, next step hints)
- Core layer (business logic) shouldn't know about presentation concerns
- Violates Clean Architecture's dependency rule
- Makes core dependent on CLI changes

**Solution:** Move `DisplayConfig` entirely to CLI layer.

---

## 3. Session Manifest System

### 3.1 Overview

The Session Manifest provides a single source of truth for session state, replacing file-existence checks with explicit state tracking.

**File:** `contentItem/{id}/session.json`

### 3.2 Domain Types

**Location:** `packages/core/src/domain/session.ts`

```typescript
/**
 * Step execution status
 */
export type StepStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Individual step state with validation metadata
 */
export type StepState = {
  /** Current execution status */
  status: StepStatus;
  /** SHA-256 hash of artifact content (first 16 chars) */
  contentHash?: string;
  /** ISO timestamp when step completed */
  completedAt?: string;
  /** Error message if status is "failed" */
  errorMessage?: string;
  /** Schema version used to create artifact (for migrations) */
  schemaVersion?: string;
};

/**
 * Session Manifest - tracks session lifecycle and artifact validity
 *
 * Version field enables future migrations.
 * Steps map to artifacts: analyzing → summary.json, etc.
 */
export type SessionManifest = {
  /** Manifest format version (for migrations) */
  version: 1;
  /** Content ID this manifest belongs to */
  contentId: string;
  /** ISO timestamp of session creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Step states indexed by step name */
  steps: {
    analyzing?: StepState;        // → summary.json
    generating_ideas?: StepState; // → ideas.json
    building_outline?: StepState; // → outline.json
    assembling_kit?: StepState;   // → writing-kit.json
  };
  /** SHA-256 hash of source content.md (for change detection) */
  sourceHash: string;
};
```

### 3.3 Step-to-Artifact Mapping

| Step Name | Artifact File | Subagent |
|-----------|---------------|----------|
| `analyzing` | `summary.json` | content-analyzer |
| `generating_ideas` | `ideas.json` | idea-generator |
| `building_outline` | `outline.json` | writing-kit-builder |
| `assembling_kit` | `writing-kit.json` | writing-kit-builder |

### 3.4 Validation Schema

**Location:** `packages/core/src/validation/schemas.ts`

```typescript
export const StepStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed"
]);

export const StepStateSchema = z.object({
  status: StepStatusSchema,
  contentHash: z.string().length(16).optional(),
  completedAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
  schemaVersion: z.string().optional(),
});

export const SessionManifestSchema = z.object({
  version: z.literal(1),
  contentId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  steps: z.object({
    analyzing: StepStateSchema.optional(),
    generating_ideas: StepStateSchema.optional(),
    building_outline: StepStateSchema.optional(),
    assembling_kit: StepStateSchema.optional(),
  }),
  sourceHash: z.string().length(16),
});
```

### 3.5 Session Service

**Location:** `packages/core/src/services/session-service.ts`

The Session Service provides pure functions for manifest manipulation (no I/O):

```typescript
/**
 * Step name type
 */
export type StepName =
  | "analyzing"
  | "generating_ideas"
  | "building_outline"
  | "assembling_kit";

/**
 * Step execution order
 */
export const STEP_ORDER: StepName[] = [
  "analyzing",
  "generating_ideas",
  "building_outline",
  "assembling_kit"
];

/**
 * Map step names to artifact filenames
 */
export const STEP_TO_ARTIFACT: Record<StepName, string> = {
  analyzing: "summary.json",
  generating_ideas: "ideas.json",
  building_outline: "outline.json",
  assembling_kit: "writing-kit.json",
};

/**
 * Map artifact filenames to step names
 */
export const ARTIFACT_TO_STEP: Record<string, StepName> = {
  "summary.json": "analyzing",
  "ideas.json": "generating_ideas",
  "outline.json": "building_outline",
  "writing-kit.json": "assembling_kit",
};

/**
 * Create initial manifest for a new session
 */
export function createManifest(
  contentId: string,
  sourceHash: string
): SessionManifest;

/**
 * Check if a step can be skipped based on manifest state
 *
 * A step can be skipped if:
 * 1. Status is "completed"
 * 2. Content hash matches current artifact (if provided)
 */
export function canSkipStep(
  manifest: SessionManifest,
  step: StepName,
  currentArtifactHash?: string
): boolean;

/**
 * Get next step to execute (first non-completed step)
 */
export function getNextStep(manifest: SessionManifest): StepName | null;

/**
 * Update step status in manifest (returns new manifest, immutable)
 */
export function updateStep(
  manifest: SessionManifest,
  step: StepName,
  update: Partial<StepState>
): SessionManifest;

/**
 * Check if source content has changed
 */
export function hasSourceChanged(
  manifest: SessionManifest,
  currentSourceHash: string
): boolean;
```

### 3.6 Session I/O (Provider Layer)

**Location:** `packages/provider/src/claude-agent-sdk/session-io.ts`

The Session I/O module handles file operations for manifests:

```typescript
/**
 * Compute SHA-256 hash of content (first 16 chars)
 */
export function computeHash(content: string): string;

/**
 * Get manifest file path for a session
 */
export function getManifestPath(workspace: string, contentId: string): string;

/**
 * Read session manifest from disk
 * Returns undefined if not found or invalid
 */
export async function readManifest(
  workspace: string,
  contentId: string
): Promise<SessionManifest | undefined>;

/**
 * Write session manifest to disk (atomic write)
 */
export async function writeManifest(
  workspace: string,
  manifest: SessionManifest
): Promise<void>;

/**
 * Read artifact file and compute hash
 */
export async function readArtifactWithHash(
  workspace: string,
  contentId: string,
  filename: string
): Promise<{ content: string; hash: string } | undefined>;
```

### 3.7 Updated Session Folder Structure

```
~/.looplia/
└── contentItem/{contentId}/
    ├── content.md              # Input content (with YAML frontmatter)
    ├── session.json            # NEW: Session manifest
    ├── summary.json            # ContentSummary output
    ├── ideas.json              # WritingIdeas output
    ├── outline.json            # OutlineSection[] output
    └── writing-kit.json        # Final WritingKit output
```

### 3.8 Example Session Manifest

```json
{
  "version": 1,
  "contentId": "article-2025-12-12-a1b2c3",
  "createdAt": "2025-12-12T10:30:00.000Z",
  "updatedAt": "2025-12-12T10:35:42.000Z",
  "steps": {
    "analyzing": {
      "status": "completed",
      "contentHash": "a1b2c3d4e5f67890",
      "completedAt": "2025-12-12T10:32:15.000Z",
      "schemaVersion": "0.5.0"
    },
    "generating_ideas": {
      "status": "completed",
      "contentHash": "b2c3d4e5f6789012",
      "completedAt": "2025-12-12T10:34:30.000Z",
      "schemaVersion": "0.5.0"
    },
    "building_outline": {
      "status": "in_progress"
    }
  },
  "sourceHash": "f1e2d3c4b5a69870"
}
```

### 3.9 Updated Prompt Template

**Location:** `packages/core/src/commands/kit.ts`

```typescript
function buildPrompt(ctx: PromptContext): string {
  return `Task: Build WritingKit for session: contentItem/${ctx.contentId}

## Check Session State (REQUIRED FIRST STEP)

Read contentItem/${ctx.contentId}/session.json to determine progress.

### If session.json exists:
- Parse the manifest and check each step's status
- Skip steps where status is "completed" AND the artifact file exists
- If source content changed (compare sourceHash), restart from analyzing step

### If session.json does not exist:
- Create it with version: 1, empty steps, and sourceHash from content.md hash

## Step Completion Protocol

After writing any artifact (summary.json, ideas.json, etc.):
1. Compute the artifact's content hash
2. Update session.json with:
   - status: "completed"
   - contentHash: <computed hash>
   - completedAt: <current ISO timestamp>
   - schemaVersion: "0.5.0"

## Sequential Workflow

Step 1: analyzing → summary.json
  IF session.steps.analyzing.status !== "completed" OR summary.json missing:
  → Invoke content-analyzer subagent
  → Update session.json on completion

Step 2: generating_ideas → ideas.json
  IF session.steps.generating_ideas.status !== "completed" OR ideas.json missing:
  → Invoke idea-generator subagent
  → Update session.json on completion

Step 3: building_outline + assembling_kit → outline.json + writing-kit.json
  IF session.steps.assembling_kit.status !== "completed":
  → Invoke writing-kit-builder subagent
  → Update session.json for both steps on completion

Step 4: Return
  → Read writing-kit.json
  → Return as structured output`;
}
```

---

## 4. Intermediate Artifact Validation

### 4.1 Overview

The Validation system intercepts artifact writes and validates content against Zod schemas before marking steps as complete.

### 4.2 Artifact Validation Service

**Location:** `packages/core/src/services/artifact-validation.ts`

```typescript
/**
 * Artifact types that can be validated
 */
export type ArtifactType =
  | "summary"
  | "ideas"
  | "outline"
  | "writing-kit";

/**
 * Validation result with error details
 */
export type ValidationResult =
  | { valid: true; data: unknown }
  | { valid: false; errors: string[]; retryHint: string };

/**
 * Schema mapping
 */
const SCHEMAS: Record<ArtifactType, z.ZodType> = {
  summary: ContentSummarySchema,
  ideas: WritingIdeasSchema,
  outline: z.array(OutlineSectionSchema),
  "writing-kit": WritingKitSchema,
};

/**
 * Retry hints for each artifact type
 */
const RETRY_HINTS: Record<ArtifactType, string> = {
  summary: "Re-run content-analyzer ensuring all 15 required fields are present",
  ideas: "Re-run idea-generator ensuring hooks, angles, and questions arrays exist",
  outline: "Ensure each section has heading, notes, and keyPoints fields",
  "writing-kit": "Verify all nested objects (summary, ideas, outline) match their schemas",
};

/**
 * Validate artifact content against its schema
 */
export function validateArtifact(
  type: ArtifactType,
  content: string
): ValidationResult;

/**
 * Get artifact type from filename
 */
export function getArtifactType(filename: string): ArtifactType | undefined;

/**
 * Filename to artifact type mapping
 */
export const FILENAME_TO_TYPE: Record<string, ArtifactType> = {
  "summary.json": "summary",
  "ideas.json": "ideas",
  "outline.json": "outline",
  "writing-kit.json": "writing-kit",
};
```

### 4.3 Enhanced ErrorEvent

**Location:** `packages/core/src/commands/types.ts`

```typescript
export type ErrorEvent = {
  type: "error";
  /** Error code for categorization */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Whether the error can be recovered from */
  recoverable: boolean;
  /** Unix timestamp */
  timestamp: number;

  // NEW fields for validation errors:

  /** Guidance for fixing the error */
  retryHint?: string;
  /** List of specific validation failures */
  validationErrors?: string[];
  /** Path to the artifact that failed validation */
  artifact?: string;
};
```

### 4.4 Validation Interceptor

**Location:** `packages/provider/src/claude-agent-sdk/streaming/validation-interceptor.ts`

The interceptor monitors Write tool operations and validates artifact content:

```typescript
/**
 * Check if a tool operation is an artifact write
 */
export function isArtifactWrite(
  toolName: string,
  input: Record<string, unknown>
): { type: ArtifactType; path: string } | undefined;

/**
 * Validate artifact after write and yield error event if invalid
 */
export function* validateToolResult(
  toolName: string,
  input: Record<string, unknown>,
  result: string,
  timestamp: number
): Generator<StreamingEvent>;
```

### 4.5 Transformer Integration

**Location:** `packages/provider/src/claude-agent-sdk/streaming/transformer.ts`

The `PendingTool` type is enhanced to store input for validation:

```typescript
/**
 * Pending tool information for correlating tool_use with tool_result
 */
type PendingTool = {
  name: string;
  startTime: number;
  input?: Record<string, unknown>;  // NEW: Store input for validation
};
```

The `processToolUseBlock` function stores the input:

```typescript
function processToolUseBlock(
  block: ToolUseBlock,
  context: TransformContext,
  timestamp: number
): StreamingEvent {
  context.pendingTools.set(block.id, {
    name: block.name,
    startTime: timestamp,
    input: block.input,  // NEW: Store input
  });
  // ...
}
```

The `processToolResult` function calls the validation interceptor:

```typescript
function* processToolResult(
  block: ToolResultBlock,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  // ... existing tool_end logic ...

  // NEW: Validate artifact writes
  if (!block.is_error && pendingTool.input) {
    yield* validateToolResult(
      pendingTool.name,
      pendingTool.input,
      typeof block.content === "string" ? block.content : "",
      timestamp
    );
  }
}
```

### 4.6 Validation Flow

```
Write tool invoked with file_path: "contentItem/{id}/summary.json"
    │
    ├─ processToolUseBlock: Store input in pendingTools
    │
    ├─ Yield ToolStartEvent
    │
    ├─ SDK executes Write operation
    │
    ├─ processToolResult: Receive tool_result
    │
    ├─ Yield ToolEndEvent
    │
    ├─ validateToolResult:
    │   │
    │   ├─ isArtifactWrite? → Yes (summary.json → "summary")
    │   │
    │   ├─ Parse JSON content from input
    │   │
    │   ├─ Validate against ContentSummarySchema
    │   │
    │   └─ If invalid:
    │       │
    │       └─ Yield ErrorEvent {
    │            code: "VALIDATION_FAILED",
    │            message: "Artifact summary.json failed validation",
    │            recoverable: true,
    │            artifact: "contentItem/{id}/summary.json",
    │            validationErrors: ["headline: String must be at least 10 characters"],
    │            retryHint: "Re-run content-analyzer ensuring all 15 required fields..."
    │          }
    │
    └─ Continue to next event
```

### 4.7 TUI Display

The CLI's streaming UI should display validation errors clearly:

```
┌─ Writing Kit Builder ─────────────────────────────────────────────────┐
│                                                                       │
│  Activities:                                                          │
│    ✓ Read CLAUDE.md (2ms)                                            │
│    ✓ Read content.md (1ms)                                           │
│    ✓ Invoke content-analyzer (15.2s)                                 │
│    ⚠ Write summary.json - Validation Failed                          │
│      • headline: String must be at least 10 characters               │
│      • tldr: Required field missing                                  │
│      Hint: Re-run content-analyzer ensuring all 15 required fields   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 5. DisplayConfig Decoupling

### 5.1 Overview

Move all presentation configuration from the core layer to the CLI layer, achieving Clean Architecture purity.

### 5.2 Before (v0.4.0)

```
packages/core/src/commands/types.ts
    │
    ├─ DisplayConfig type definition
    │
    └─ CommandDefinition requires displayConfig

packages/core/src/commands/kit.ts
    │
    └─ kitCommand includes displayConfig

apps/cli/src/renderers/post-completion.ts
    │
    └─ Consumes DisplayConfig from command
```

### 5.3 After (v0.5.0)

```
apps/cli/src/config/display-config.ts
    │
    ├─ DisplayConfig type definition
    │
    ├─ DISPLAY_CONFIGS registry
    │
    └─ getDisplayConfig(commandName)

packages/core/src/commands/types.ts
    │
    └─ CommandDefinition (no displayConfig)

packages/core/src/commands/kit.ts
    │
    └─ kitCommand (no displayConfig)
```

### 5.4 New CLI Display Configuration

**Location:** `apps/cli/src/config/display-config.ts`

```typescript
/**
 * Next step hint for post-completion display
 */
export type NextStepHint = {
  description: string;
  commandTemplate: string;
};

/**
 * Display Configuration - TUI-specific presentation settings
 *
 * This is a CLI layer concern, not part of core business logic.
 */
export type DisplayConfig = {
  /** Title shown in the TUI box header */
  title: string;
  /** Success message after completion */
  successMessage: string;
  /** Session info format (placeholder: {contentId}) */
  sessionInfoFormat?: string;
  /** Next step hint (null = no next step) */
  nextStep?: NextStepHint | null;
};

/**
 * Display configurations for each command
 *
 * Centralized registry keeps presentation logic in CLI layer.
 */
export const DISPLAY_CONFIGS: Record<string, DisplayConfig> = {
  kit: {
    title: "Writing Kit Builder",
    successMessage: "Writing kit complete",
    sessionInfoFormat: "~/.looplia/contentItem/{contentId}/writing-kit.json",
    nextStep: null,
  },
  summarize: {
    title: "Content Summarizer",
    successMessage: "Summary complete",
    sessionInfoFormat: "~/.looplia/contentItem/{contentId}/summary.json",
    nextStep: {
      description: "Next step:",
      commandTemplate: "looplia kit --session-id {contentId}",
    },
  },
};

/**
 * Get display configuration for a command
 */
export function getDisplayConfig(commandName: string): DisplayConfig | undefined {
  return DISPLAY_CONFIGS[commandName];
}
```

### 5.5 Updated CommandDefinition

**Location:** `packages/core/src/commands/types.ts`

```typescript
/**
 * Command Definition - the core abstraction
 *
 * Defines the business logic for a command:
 * - What prompt to send (promptTemplate)
 * - What output to expect (outputSchema)
 *
 * NOTE: Display configuration is handled by CLI layer separately.
 * This ensures clean separation between business logic and presentation.
 */
export type CommandDefinition<TOutput = unknown> = {
  /** Unique command name */
  name: string;
  /** Function that generates the prompt from context */
  promptTemplate: (context: PromptContext) => string;
  /** Zod schema for output validation */
  outputSchema: z.ZodType<TOutput>;
};
```

### 5.6 Updated Command Definitions

**Location:** `packages/core/src/commands/kit.ts`

```typescript
export const kitCommand: CommandDefinition<WritingKit> = {
  name: "kit",
  promptTemplate: buildPrompt,
  outputSchema: WritingKitSchema,
  // NOTE: displayConfig removed - handled by CLI layer
};
```

**Location:** `packages/core/src/commands/summarize.ts`

```typescript
export const summarizeCommand: CommandDefinition<ContentSummary> = {
  name: "summarize",
  promptTemplate: buildPrompt,
  outputSchema: ContentSummarySchema,
  // NOTE: displayConfig removed - handled by CLI layer
};
```

### 5.7 Updated CLI Consumers

**Location:** `apps/cli/src/runtime/looplia-runtime.ts`

```typescript
import { getDisplayConfig } from "../config/display-config";

private async executeStreaming<T>(
  command: CommandDefinition<T>,
  prompt: string,
  contentId: string,
  contentTitle: string
): Promise<CommandResult<T>> {
  // Get display config from CLI registry (not from command)
  const displayConfig = getDisplayConfig(command.name);

  const { result } = await renderStreamingQuery<T>({
    title: displayConfig?.title ?? command.name,
    subtitle: contentTitle,
    // ...
  });

  return result;
}
```

**Location:** `apps/cli/src/renderers/kit-renderer.ts`

```typescript
import { getDisplayConfig } from "../config/display-config";

export function renderKitResult(
  result: CommandResult<WritingKit>,
  config: KitConfig
): void {
  // ...

  // Get display config from CLI registry
  const displayConfig = getDisplayConfig("kit");
  if (displayConfig) {
    displayPostCompletion(displayConfig, data.contentId);
  }

  // ...
}
```

---

## 6. Updated Architecture Overview

### 6.1 Layer Diagram (v0.5.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLI Layer (apps/cli/)                             │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  commands/  │  │  parsers/   │  │  runtime/   │  │ renderers/  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  config/display-config.ts  ← NEW: DisplayConfig lives here      │       │
│  └─────────────────────────────────────────────────────────────────┘       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Provider Layer (packages/provider/)                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  session-io.ts  ← NEW: Session manifest file operations          │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  streaming/validation-interceptor.ts  ← NEW: Artifact validation │       │
│  └─────────────────────────────────────────────────────────────────┘       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Core Layer (packages/core/)                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  domain/session.ts  ← NEW: SessionManifest, StepState types      │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  services/session-service.ts  ← NEW: Manifest manipulation       │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  services/artifact-validation.ts  ← NEW: Schema validation       │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  commands/types.ts  ← MODIFIED: CommandDefinition without display│       │
│  └─────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 New File Summary

| Layer | File | Purpose |
|-------|------|---------|
| Core | `domain/session.ts` | SessionManifest, StepState types |
| Core | `services/session-service.ts` | Pure functions for manifest manipulation |
| Core | `services/artifact-validation.ts` | Zod validation for artifacts |
| Provider | `session-io.ts` | Manifest file read/write operations |
| Provider | `session-migration.ts` | Legacy session migration |
| Provider | `streaming/validation-interceptor.ts` | Intercept Write operations, validate |
| CLI | `config/display-config.ts` | DisplayConfig type and registry |

### 6.3 Updated Smart Continuation Flow

```
CLI: looplia kit --session-id abc123
    │
    ▼
AgentExecutor.executeStreaming(prompt, schema, options)
    │
    ▼
Main Agent Session:
    │
    ├─ 1. Read session.json
    │   │
    │   ├─ IF exists: Parse manifest, check step states
    │   │   │
    │   │   ├─ steps.analyzing.status === "completed"? Skip content-analyzer
    │   │   ├─ steps.generating_ideas.status === "completed"? Skip idea-generator
    │   │   └─ sourceHash changed? Restart from analyzing
    │   │
    │   └─ IF not exists: Create new manifest
    │
    ├─ 2. Execute needed steps:
    │   │
    │   ├─ content-analyzer → summary.json
    │   │   │
    │   │   ├─ Write summary.json
    │   │   ├─ Validation interceptor validates content
    │   │   ├─ IF valid: Update session.json (status: completed, hash)
    │   │   └─ IF invalid: ErrorEvent emitted, agent retries
    │   │
    │   ├─ idea-generator → ideas.json
    │   │   └─ Same validation flow
    │   │
    │   └─ writing-kit-builder → outline.json, writing-kit.json
    │       └─ Same validation flow
    │
    └─ 3. Return writing-kit.json via StructuredOutput
```

---

## 7. Migration Strategy

### 7.1 Legacy Session Migration

**Location:** `packages/provider/src/claude-agent-sdk/session-migration.ts`

Sessions created before v0.5.0 don't have `session.json`. The migration module creates manifests from existing artifact files:

```typescript
/**
 * Migrate legacy session (without manifest) to v0.5.0 format
 *
 * Scans for existing artifact files and creates manifest accordingly.
 */
export async function migrateLegacySession(
  workspace: string,
  contentId: string
): Promise<void>;

/**
 * Ensure session has manifest (migrate if needed)
 */
export async function ensureManifest(
  workspace: string,
  contentId: string
): Promise<void>;
```

### 7.2 Migration Logic

```typescript
async function migrateLegacySession(
  workspace: string,
  contentId: string
): Promise<void> {
  // 1. Read source content for hash
  const sourceContent = await readArtifactWithHash(
    workspace,
    contentId,
    "content.md"
  );

  if (!sourceContent) return; // No content, nothing to migrate

  // 2. Create manifest with completed steps from existing files
  const manifest = createManifest(contentId, sourceContent.hash);

  const artifactFiles = [
    "summary.json",
    "ideas.json",
    "outline.json",
    "writing-kit.json"
  ];

  for (const filename of artifactFiles) {
    const artifact = await readArtifactWithHash(workspace, contentId, filename);

    if (artifact) {
      const step = ARTIFACT_TO_STEP[filename];
      manifest.steps[step] = {
        status: "completed",
        contentHash: artifact.hash,
        completedAt: new Date().toISOString(),
        schemaVersion: "0.4.0", // Legacy version marker
      };
    }
  }

  // 3. Write manifest
  await writeManifest(workspace, manifest);
}
```

### 7.3 Migration Flow

```
User runs: looplia kit --session-id legacy-session
    │
    ▼
SessionManager.prepare({ sessionId: "legacy-session" })
    │
    ├─ ensureManifest(workspace, "legacy-session")
    │   │
    │   ├─ Check: session.json exists?
    │   │
    │   └─ IF not: migrateLegacySession()
    │       │
    │       ├─ Read content.md → compute sourceHash
    │       │
    │       ├─ For each artifact file that exists:
    │       │   ├─ Read file, compute hash
    │       │   └─ Add to manifest.steps with schemaVersion: "0.4.0"
    │       │
    │       └─ Write session.json
    │
    └─ Continue with normal execution
```

### 7.4 DisplayConfig Breaking Change

Moving `DisplayConfig` out of core is a breaking change for any code that imports it from `@looplia-core/core`.

**Migration Path:**

```typescript
// Before (v0.4.0)
import { DisplayConfig } from "@looplia-core/core";

// After (v0.5.0)
import { DisplayConfig } from "../config/display-config";
// OR
import type { DisplayConfig } from "@looplia-core/cli"; // if exported
```

Since this is an internal monorepo, the migration is straightforward - update all imports in `apps/cli/`.

---

## 8. Implementation Plan

### 8.1 Phase Order

| Phase | Focus | Risk | Dependencies |
|-------|-------|------|--------------|
| 1 | DisplayConfig Decoupling | Low | None |
| 2 | Session Manifest Types | Low | None |
| 3 | Session Service & I/O | Medium | Phase 2 |
| 4 | Prompt Template Updates | Medium | Phase 3 |
| 5 | Artifact Validation | Medium-High | Phase 2 |
| 6 | Tests & Documentation | Low | All phases |

### 8.2 Phase 1: DisplayConfig Decoupling

**Files to Create:**
- `apps/cli/src/config/display-config.ts`
- `apps/cli/src/config/index.ts`

**Files to Modify:**
- `packages/core/src/commands/types.ts` - Remove DisplayConfig
- `packages/core/src/commands/kit.ts` - Remove displayConfig property
- `packages/core/src/commands/summarize.ts` - Remove displayConfig property
- `packages/core/src/commands/index.ts` - Update exports
- `packages/core/src/index.ts` - Remove DisplayConfig export
- `apps/cli/src/runtime/looplia-runtime.ts` - Import from CLI config
- `apps/cli/src/renderers/kit-renderer.ts` - Import from CLI config
- `apps/cli/src/renderers/summarize-renderer.ts` - Import from CLI config

### 8.3 Phase 2: Session Manifest Types

**Files to Create:**
- `packages/core/src/domain/session.ts`

**Files to Modify:**
- `packages/core/src/domain/index.ts` - Export session types
- `packages/core/src/validation/schemas.ts` - Add manifest schemas
- `packages/core/src/index.ts` - Export session types

### 8.4 Phase 3: Session Service & I/O

**Files to Create:**
- `packages/core/src/services/session-service.ts`
- `packages/provider/src/claude-agent-sdk/session-io.ts`
- `packages/provider/src/claude-agent-sdk/session-migration.ts`

**Files to Modify:**
- `packages/core/src/services/index.ts` - Export session service
- `packages/provider/src/claude-agent-sdk/index.ts` - Export session I/O
- `apps/cli/src/runtime/session-manager.ts` - Call ensureManifest

### 8.5 Phase 4: Prompt Template Updates

**Files to Modify:**
- `packages/core/src/commands/kit.ts` - Update promptTemplate
- `packages/core/src/commands/summarize.ts` - Update promptTemplate

### 8.6 Phase 5: Artifact Validation

**Files to Create:**
- `packages/core/src/services/artifact-validation.ts`
- `packages/provider/src/claude-agent-sdk/streaming/validation-interceptor.ts`

**Files to Modify:**
- `packages/core/src/commands/types.ts` - Enhance ErrorEvent
- `packages/core/src/services/index.ts` - Export validation service
- `packages/provider/src/claude-agent-sdk/streaming/transformer.ts` - Integrate validation
- `packages/provider/src/claude-agent-sdk/streaming/types.ts` - Update PendingTool

### 8.7 Phase 6: Tests & Documentation

**Test Files to Create:**
- `packages/core/src/services/__tests__/session-service.test.ts`
- `packages/core/src/services/__tests__/artifact-validation.test.ts`
- `packages/provider/src/claude-agent-sdk/__tests__/session-io.test.ts`
- `packages/provider/src/claude-agent-sdk/__tests__/session-migration.test.ts`

**Documentation to Update:**
- `docs/GLOSSARY.md` - Add new terms
- `docs/README.md` - Add DESIGN-0.5.0.md to index

---

## Cross-References

- **Previous Version:** See [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) for v0.4.0 architecture
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md) for term definitions
- **Agentic Concept:** See [AGENTIC_CONCEPT-0.2.md](./AGENTIC_CONCEPT-0.2.md) for agent system design
- **Test Plan:** See [TEST_PLAN-0.2.md](./TEST_PLAN-0.2.md) for testing strategy

---

*This document serves as the single source of truth for Looplia-Core v0.5.0 architecture improvements.*
