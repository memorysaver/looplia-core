# Looplia-Core Architecture Design v0.6.9

> **FEATURE RELEASE:** SDK Compatibility & API Key Selection Improvements
>
> **Version:** 0.6.9
> **Date:** 2025-12-31
> **Related:** [DESIGN-0.6.8.md](./DESIGN-0.6.8.md) | [DESIGN-0.6.6.md](./DESIGN-0.6.6.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution: Optional Claude Code Path](#3-solution-optional-claude-code-path)
4. [Solution: Endpoint-Aware API Key Selection](#4-solution-endpoint-aware-api-key-selection)
5. [Implementation Details](#5-implementation-details)
6. [File Changes Summary](#6-file-changes-summary)

---

## 1. Executive Summary

### Feature Release: v0.6.8 → v0.6.9

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.8 | Claude Code Path Resolution | Fix SDK finding wrong executable |
| **v0.6.9** | **SDK Compatibility + API Key Priority** | **Docker E2E fix + Settings file takes priority** |

### What Changes in v0.6.9

v0.6.9 introduces two key improvements:

1. **OPTIONAL CLAUDE CODE PATH:** `findClaudeCodePath()` returns `undefined` instead of throwing, allowing SDK to use its built-in executable
2. **ENDPOINT-AWARE API KEY SELECTION:** Settings file `authToken` takes priority over environment variables, with endpoint-based fallback

### The Shift

```
BEFORE (v0.6.8):
  # findClaudeCodePath() THROWS if Claude Code not installed
  # Docker E2E fails because Claude Code not in container
  const claudeCodePath = findClaudeCodePath();  // THROWS!

  # API key priority: env var > settings file
  if (ZENMUX_API_KEY) use ZENMUX_API_KEY
  else if (authToken) use authToken

AFTER (v0.6.9):
  # findClaudeCodePath() returns undefined, SDK uses built-in
  const claudeCodePath = findClaudeCodePath();  // Returns undefined
  // SDK falls back to built-in executable

  # API key priority: settings file > env var (based on endpoint)
  if (authToken) use authToken  // User explicitly configured
  else if (isZenmuxEndpoint && ZENMUX_API_KEY) use ZENMUX_API_KEY
```

---

## 2. Problem Statement

### 2.1 Docker E2E Failures

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

## 3. Solution: Optional Claude Code Path

### 3.1 Before (v0.6.8)

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

### 3.2 After (v0.6.9)

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

### 3.3 Behavior

| Scenario | Result |
|----------|--------|
| Claude Code globally installed | Uses explicit path |
| Claude Code NOT installed (Docker) | SDK uses built-in executable |

---

## 4. Solution: Endpoint-Aware API Key Selection

### 4.1 New Priority Order

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

### 4.2 Key Selection Matrix

| Endpoint | authToken set? | Key Used |
|----------|---------------|----------|
| ZenMux | Yes | `authToken` from settings |
| ZenMux | No | `ZENMUX_API_KEY` env |
| Anthropic | Yes | `authToken` from settings |
| Anthropic | No | `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` env |
| Custom | Yes | `authToken` from settings |
| Custom | No | `ANTHROPIC_API_KEY` env |

### 4.3 Why Settings File First?

When user runs:
```bash
looplia config provider set auth-token sk-my-token
```

They are **explicitly configuring** a token for the current preset. This should take priority over any environment variable.

---

## 5. Implementation Details

### 5.1 Claude Code Path Changes

**File:** `packages/provider/src/claude-agent-sdk/claude-code-path.ts`

```typescript
// Return type changed from string to string | undefined
export function findClaudeCodePath(): string | undefined {
  // ... search logic unchanged ...

  // Instead of throwing, return undefined
  return undefined;
}
```

### 5.2 Query Executor Changes

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

### 5.3 Model Provider Changes

**File:** `packages/provider/src/claude-agent-sdk/model-provider.ts`

Updated `injectLoopliaSettingsEnv()` to use new priority order.

---

## 6. File Changes Summary

| File | Change |
|------|--------|
| `packages/provider/src/claude-agent-sdk/claude-code-path.ts` | Return `undefined` instead of throwing |
| `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts` | Conditionally pass `pathToClaudeCodeExecutable` |
| `packages/provider/src/claude-agent-sdk/model-provider.ts` | Settings file `authToken` takes priority |
| `packages/provider/test/claude-agent-sdk/model-provider.test.ts` | Updated tests for new priority |

---

## Summary

v0.6.9 fixes Docker E2E failures by making Claude Code path optional (SDK uses built-in) and improves API key selection by giving settings file priority over environment variables with endpoint-based fallback.
