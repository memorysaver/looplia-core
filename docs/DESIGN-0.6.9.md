# Looplia-Core Architecture Design v0.6.9

> **FEATURE RELEASE:** Unified Skill Executor Strategy + SDK Compatibility
>
> **Version:** 0.6.9
> **Date:** 2025-12-31
> **Related:** [DESIGN-0.6.8.md](./DESIGN-0.6.8.md) | [DESIGN-0.6.6.md](./DESIGN-0.6.6.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution: Unified Skill Executor via general-purpose Subagent](#3-solution-unified-skill-executor-via-general-purpose-subagent)
4. [Solution: Optional Claude Code Path](#4-solution-optional-claude-code-path)
5. [Solution: Endpoint-Aware API Key Selection](#5-solution-endpoint-aware-api-key-selection)
6. [Implementation Details](#6-implementation-details)
7. [File Changes Summary](#7-file-changes-summary)
8. [Fix: Hook stdout Pollution Breaking SDK Communication](#8-fix-hook-stdout-pollution-breaking-sdk-communication)
9. [Summary](#summary)

---

## 1. Executive Summary

### Feature Release: v0.6.8 → v0.6.9

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.8 | Claude Code Path Resolution | Fix SDK finding wrong executable |
| **v0.6.9** | **Unified Skill Executor + SDK Compatibility** | **All providers use general-purpose subagent** |

### What Changes in v0.6.9

v0.6.9 introduces three key improvements:

1. **UNIFIED SKILL EXECUTOR:** All providers (Anthropic + ZenMux) use built-in `general-purpose` subagent for workflow step execution. The skill teaches the subagent how to execute other skills.
2. **OPTIONAL CLAUDE CODE PATH:** `findClaudeCodePath()` returns `undefined` instead of throwing, allowing SDK to use its built-in executable
3. **ENDPOINT-AWARE API KEY SELECTION:** Settings file `authToken` takes priority over environment variables, with endpoint-based fallback

### The Shift: Skill Executor Strategy

```
BEFORE (v0.6.6):
  # Provider-specific branching
  if (isProxyProvider) {
    # ZenMux: Use inline execution (no subagents)
    hint = "use workflow-executor-inline skill"
  } else {
    # Anthropic: Use custom skill-executor subagent
    agents = { "skill-executor": { ... } }
  }

AFTER (v0.6.9):
  # Unified strategy for ALL providers
  # 1. Remove isProxyProvider branching
  # 2. Use built-in general-purpose subagent
  # 3. Skill teaches subagent how to execute skills

  Task({
    subagent_type: "general-purpose",  // Built-in, works everywhere
    prompt: "## Execution Protocol\n..."  // Skill provides instructions
  })
```

### Why This Works

The `general-purpose` subagent is a **built-in Claude Agent SDK agent** that:
- Works across all API providers (Anthropic, ZenMux, custom)
- Doesn't require custom agent registration
- Can follow instructions provided in the prompt

The `workflow-executor` skill provides the **execution protocol** that teaches the general-purpose subagent how to:
1. Read input files
2. Invoke the specified skill
3. Execute the mission
4. Write JSON output to the exact path

**Result:** Conceptually still a "skill executor", but implemented via built-in agent + skill-provided instructions.

---

## 2. Problem Statement

### 2.1 Dual Execution Strategy Complexity (v0.6.6)

v0.6.6 introduced provider-specific workflow execution:

| Provider | Strategy | Implementation |
|----------|----------|----------------|
| Anthropic Direct | Custom `skill-executor` subagent | Registered via SDK `agents` option |
| ZenMux/Proxy | Inline execution | `workflow-executor-inline` skill |

**Problems:**
1. **Custom agents not registered for proxy:** SDK doesn't register custom agents when using proxy endpoints
2. **Code complexity:** `isProxyProvider` branching throughout codebase
3. **Maintenance burden:** Two separate execution paths to maintain

### 2.2 Docker E2E Failures

The Docker E2E tests started failing from v0.6.5 onwards:

| Version | Docker E2E | Reason |
|---------|------------|--------|
| v0.6.4 | PASS | SDK uses built-in executable |
| v0.6.5 | FAIL | `cwd: loopliaHome` may affect SDK path resolution |
| v0.6.8 | FAIL | `findClaudeCodePath()` throws before SDK runs |

**Root Cause:** The Claude Agent SDK has a built-in Claude Code executable. When v0.6.8 added `findClaudeCodePath()` that throws if Claude Code is not globally installed, it prevented the SDK from using its built-in fallback.

### 2.2 API Key Priority Confusion

The v0.6.6 API key selection logic had issues:

```typescript
// PROBLEM: Env var overrides settings file
if (settings.apiProvider.type === "zenmux" && process.env.ZENMUX_API_KEY) {
  process.env.ANTHROPIC_API_KEY = process.env.ZENMUX_API_KEY;
} else if (!process.env.ANTHROPIC_API_KEY && settings.apiProvider.authToken) {
  process.env.ANTHROPIC_API_KEY = settings.apiProvider.authToken;
}
```

**Issues:**
1. `ZENMUX_API_KEY` env var overrides `authToken` from settings file
2. User explicitly configuring via `looplia config provider set auth-token` is ignored if env var exists

---

## 3. Solution: Unified Skill Executor via general-purpose Subagent

### 3.1 Architecture

The skill executor is now implemented using:

1. **Built-in `general-purpose` subagent** - Works across all providers
2. **Execution protocol via skill** - `workflow-executor` SKILL.md provides instructions

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Executor                         │
│                                                              │
│  FOR EACH step:                                              │
│    Task({                                                    │
│      subagent_type: "general-purpose",                       │
│      prompt: "## Execution Protocol\n" + step instructions   │
│    })                                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              general-purpose Subagent                        │
│                                                              │
│  Receives execution protocol in prompt:                      │
│  1. Read input files                                         │
│  2. Invoke skill using Skill tool                            │
│  3. Execute mission with skill context                       │
│  4. Write JSON output using Write tool                       │
│                                                              │
│  Key: Each step = separate context window (context offload)  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Execution Protocol (Injected via Skill)

The `workflow-executor` SKILL.md provides the execution protocol that turns the general-purpose subagent into a skill executor:

```json
{
  "subagent_type": "general-purpose",
  "description": "Execute step: {step.id}",
  "prompt": "Execute skill '{step.skill}' for step '{step.id}'.\n\n## Mission\n{step.mission}\n\n## Execution Protocol\n1. Read input files (if provided)\n2. Invoke the skill using Skill tool\n3. Execute the mission with skill context\n4. Write JSON output to the specified path using Write tool\n\n## CRITICAL: Output Writing is MANDATORY\nYOU MUST CALL THE WRITE TOOL before completing.\n\n## Rules\n- ALWAYS invoke the specified skill using Skill tool\n- ALWAYS write output to the exact path using Write tool\n- NEVER return results as text - always write JSON to output file\n- ALWAYS include contentId in JSON outputs\n\nInput: {resolved input path}\nOutput: {step.output}\nValidation: {step.validate JSON}"
}
```

### 3.3 Why Context Offload Matters

Each workflow step runs in a **separate context window**:

```
Main Agent Context (stays clean)
    │
    ├── Task(step 1) → general-purpose → [fresh context]
    │
    ├── Task(step 2) → general-purpose → [fresh context]
    │
    └── Task(step 3) → general-purpose → [fresh context]
```

Benefits:
- **Isolation:** Each step can use full context for its skill
- **Clean main agent:** No context pollution from step executions
- **Parallel potential:** Steps without dependencies could run in parallel

### 3.4 Changes Required

**Removed from query-executor.ts:**
- `isProxyProvider` detection logic
- `workflowExecutionHint` conditional
- Custom `skill-executor` agent registration

**Updated in workflow-executor/SKILL.md:**
- Changed from custom `skill-executor` to built-in `general-purpose`
- Enhanced prompt template with full execution protocol

**Kept as dormant fallback:**
- `workflow-executor-inline` skill (not referenced, available if needed)

---

## 4. Solution: Optional Claude Code Path

### 4.1 Before (v0.6.8)

```typescript
// claude-code-path.ts
export function findClaudeCodePath(): string {
  // ... search for Claude Code ...
  throw new Error(`Claude Code not found...`);  // THROWS!
}

// query-executor.ts
const claudeCodePath = findClaudeCodePath();  // Fails in Docker
query({ options: { pathToClaudeCodeExecutable: claudeCodePath } });
```

### 4.2 After (v0.6.9)

```typescript
// claude-code-path.ts
export function findClaudeCodePath(): string | undefined {
  // ... search for Claude Code ...
  return undefined;  // Let SDK use built-in
}

// query-executor.ts
const claudeCodePath = findClaudeCodePath();
query({
  options: {
    // Only pass path if found, otherwise SDK uses built-in
    ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
  }
});
```

### 4.3 Behavior

| Scenario | Result |
|----------|--------|
| Claude Code globally installed | Uses explicit path |
| Claude Code NOT installed (Docker) | SDK uses built-in executable |

---

## 5. Solution: Endpoint-Aware API Key Selection

### 5.1 New Priority Order

```typescript
export function injectLoopliaSettingsEnv(settings: LoopliaSettings): void {
  if (settings.apiProvider.type !== "anthropic") {
    // Set endpoint URL
    if (settings.apiProvider.baseUrl) {
      process.env.ANTHROPIC_BASE_URL = settings.apiProvider.baseUrl;
    }

    // Priority 1: authToken from settings file (user explicitly configured)
    if (settings.apiProvider.authToken) {
      process.env.ANTHROPIC_API_KEY = settings.apiProvider.authToken;
    }
    // Priority 2: Endpoint-specific env var fallback
    else {
      const isZenmuxEndpoint =
        settings.apiProvider.type === "zenmux" ||
        settings.apiProvider.baseUrl?.includes("zenmux.ai");

      if (isZenmuxEndpoint && process.env.ZENMUX_API_KEY) {
        process.env.ANTHROPIC_API_KEY = process.env.ZENMUX_API_KEY;
      }
      // Custom endpoints: ANTHROPIC_API_KEY used as-is
    }
  }
}
```

### 5.2 Key Selection Matrix

| Endpoint | authToken set? | Key Used |
|----------|---------------|----------|
| ZenMux | Yes | `authToken` from settings |
| ZenMux | No | `ZENMUX_API_KEY` env |
| Anthropic | Yes | `authToken` from settings |
| Anthropic | No | `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` env |
| Custom | Yes | `authToken` from settings |
| Custom | No | `ANTHROPIC_API_KEY` env |

### 5.3 Why Settings File First?

When user runs:
```bash
looplia config provider set auth-token sk-my-token
```

They are **explicitly configuring** a token for the current preset. This should take priority over any environment variable.

---

## 6. Implementation Details

### 6.1 Claude Code Path Changes

**File:** `packages/provider/src/claude-agent-sdk/claude-code-path.ts`

```typescript
// Return type changed from string to string | undefined
export function findClaudeCodePath(): string | undefined {
  // ... search logic unchanged ...

  // Instead of throwing, return undefined
  return undefined;
}
```

### 6.2 Query Executor Changes

**File:** `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts`

```typescript
// Conditionally pass pathToClaudeCodeExecutable
const claudeCodePath = findClaudeCodePath();

const result = query({
  prompt,
  options: {
    ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
    // ... other options
  },
});
```

### 6.3 Model Provider Changes

**File:** `packages/provider/src/claude-agent-sdk/model-provider.ts`

Updated `injectLoopliaSettingsEnv()` to use new priority order.

---

## 7. File Changes Summary

| File | Change |
|------|--------|
| `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts` | Removed `isProxyProvider`, `workflowExecutionHint`, `skill-executor` agent; conditionally pass `pathToClaudeCodeExecutable` |
| `plugins/looplia-core/skills/workflow-executor/SKILL.md` | Changed to `general-purpose` subagent with full execution protocol |
| `packages/provider/src/claude-agent-sdk/claude-code-path.ts` | Return `undefined` instead of throwing |
| `packages/provider/src/claude-agent-sdk/model-provider.ts` | Settings file `authToken` takes priority; `executor` reserved for future |
| `packages/provider/test/claude-agent-sdk/model-provider.test.ts` | Updated tests for new priority |
| `plugins/looplia-core/hooks/hooks.json` | Removed SessionStart echo hook that polluted SDK JSON stream |
| `plugins/looplia-core/scripts/hooks/post-write-validate.sh` | Changed echo output to stderr to prevent SDK pollution |

---

## 8. Fix: Hook stdout Pollution Breaking SDK Communication

### 8.1 Problem Discovery

After v0.6.9 release, Docker E2E tests failed with:
```
JSON Parse error: Unexpected identifier "looplia"
```

### 8.2 Root Cause

A **SessionStart hook** was outputting to stdout, polluting the Claude Agent SDK's JSON communication stream:

```json
{
  "event": "SessionStart",
  "command": "echo '🚀 Looplia session started'",
  "description": "Log session start"
}
```

**Why it broke in v0.6.5+ but not v0.6.4:**

| Version | Plugin Loading | Hooks Loaded? |
|---------|---------------|---------------|
| v0.6.4 | `settingSources: ["project"]` with `cwd: workspace` | No (no `.claude/` in sandbox) |
| v0.6.5+ | `plugins: pluginPaths` explicit loading | Yes (hooks run immediately) |

### 8.3 Solution

1. **Remove SessionStart echo hook** - It was just logging, not part of validation system

2. **Fix post-write-validate.sh** - Line 79 echo should go to stderr:
   ```bash
   # Before
   echo "✓ Validated: $ARTIFACT.json"

   # After
   echo "✓ Validated: $ARTIFACT.json" >&2
   ```

### 8.4 Hook stdout Usage Guidelines

| Hook | Event | stdout Usage | Reason |
|------|-------|--------------|--------|
| stop-guard.sh | Stop | JSON protocol | **Required** - Claude Code expects `{"decision": "block", ...}` |
| compact-inject-state.sh | SessionStart:compact | Human-readable | **OK** - Has `matcher: "compact"`, runs during compaction |
| post-write-validate.sh | PostToolUse:Write | stderr only | **Fixed** - Success messages to stderr |

### 8.5 CLI vs SDK Output Architecture

**Question:** Does CLI interactive output pollute JSON?

**Answer:** No. Different processes, different stdout destinations:

| Mode | stdout Destination |
|------|-------------------|
| Interactive CLI (`looplia`) | Terminal via Ink |
| SDK Mode (subprocess) | SDK JSON parser |

Only hook stdout during SDK execution matters. CLI Ink rendering is a separate process.

---

## 9. Summary

v0.6.9 introduces a **unified skill executor strategy**: ALL providers (Anthropic, ZenMux, custom) now use the built-in `general-purpose` subagent for workflow step execution. The `workflow-executor` skill provides the execution protocol that teaches the subagent how to invoke other skills. This achieves context offload (each step runs in a separate context window) while simplifying the codebase by removing provider-specific branching.

Additionally, v0.6.9 fixes Docker E2E failures by making Claude Code path optional (SDK uses built-in) and improves API key selection by giving settings file priority over environment variables with endpoint-based fallback.

**Post-release fix:** Removed a SessionStart echo hook that was polluting the SDK's JSON communication stream. The hook output "🚀 Looplia session started" to stdout before SDK communication was established, causing JSON parse errors. Also fixed `post-write-validate.sh` to redirect success messages to stderr.
