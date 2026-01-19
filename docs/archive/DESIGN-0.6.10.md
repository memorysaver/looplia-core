# Looplia-Core Architecture Design v0.6.10

> **BUG FIX RELEASE:** Unified Command Initialization
>
> **Version:** 0.6.10
> **Date:** 2026-01-03
> **Related:** [DESIGN-0.6.9.md](./DESIGN-0.6.9.md) | [DESIGN-0.6.6.md](./DESIGN-0.6.6.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution: Shared Command Initialization](#3-solution-shared-command-initialization)
4. [Implementation Details](#4-implementation-details)
5. [File Changes Summary](#5-file-changes-summary)
6. [Testing Plan](#6-testing-plan)
7. [Migration Notes](#7-migration-notes)

---

## 1. Executive Summary

### Bug Fix Release: v0.6.9 → v0.6.10

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.9 | Unified Skill Executor + SDK Compatibility | All providers use general-purpose subagent |
| **v0.6.10** | **Unified Command Initialization** | **build and run commands share identical settings/API key logic** |

### What Changes in v0.6.10

v0.6.10 fixes a critical inconsistency between `build` and `run` commands:

1. **SHARED INITIALIZATION:** Extract settings loading and API key validation into a shared function
2. **FIX BUILD COMMAND:** Load workspace settings BEFORE validating API key (same as run)
3. **IMPROVED ERROR MESSAGES:** Guide users to all API key configuration options

### The Bug: Settings Load Order

```
BEFORE (v0.6.9 - BUG):
  build.ts:
    1. parseArgs()
    2. validateEnvironment()  ← TOO EARLY! Settings not loaded
    3. ensureWorkspace()
    4. executeBuild()

  run.ts (CORRECT):
    1. parseArgs()
    2. ensureWorkspace()
    3. readLoopliaSettings() + injectLoopliaSettingsEnv()  ← Settings first
    4. validateEnvironment()  ← After injection
    5. executeWorkflow()

AFTER (v0.6.10 - FIXED):
  build.ts & run.ts:
    1. parseArgs()
    2. ensureWorkspace()
    3. initializeCommandEnvironment({ mock })  ← Shared function
    4. execute()
```

### Why This Matters

When a user configures a ZenMux preset:

```bash
looplia config provider preset zenmux-deepseek-v3.2
export ZENMUX_API_KEY=sk-xxx
```

The `injectLoopliaSettingsEnv()` function maps `ZENMUX_API_KEY` to `ANTHROPIC_API_KEY`. But if validation happens BEFORE this injection:

| Command | v0.6.9 Behavior | v0.6.10 Behavior |
|---------|-----------------|------------------|
| `looplia run` | Works | Works |
| `looplia build` | **FAILS: "ANTHROPIC_API_KEY required"** | Works |

---

## 2. Problem Statement

### 2.1 Inconsistent Initialization Order

The `build` command and `run` command have different initialization flows:

**build.ts (lines 615-628) - BROKEN:**

```typescript
export async function runBuildCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  try {
    // 1. Validate environment ← BUG: Before settings loaded!
    validateEnvironment(parsed.mock);

    // 2. Ensure workspace
    const workspace = ensureWorkspace(parsed.mock);
    // ... execute
```

**run.ts (lines 740-757) - CORRECT:**

```typescript
export async function runRunCommand(args: string[]): Promise<void> {
  // ...
  try {
    // 1. Ensure workspace (needed to check workflow definition)
    const workspace = ensureWorkspace(parsed.mock);

    // 2. Resolve or create sandbox
    const allowInputless = checkWorkflowInputless(workspace, parsed.workflowId);
    const sandboxId = resolveSandboxId(workspace, parsed, allowInputless);

    // 3. Load and inject provider settings (v0.6.6)
    // Must happen BEFORE env validation so ZenMux API key is available
    const settings = await readLoopliaSettings();
    if (settings) {
      injectLoopliaSettingsEnv(settings);
    }

    // 4. Validate environment (after settings injection for ZenMux support)
    validateEnvironment(parsed.mock);
    // ... execute
```

### 2.2 API Key Sources Not Discovered

The `validateEnvironment()` function only checks for:
- `ANTHROPIC_API_KEY`
- `CLAUDE_CODE_OAUTH_TOKEN`

It doesn't know about:
- `ZENMUX_API_KEY` (mapped by `injectLoopliaSettingsEnv()`)
- `authToken` from settings file (injected by `injectLoopliaSettingsEnv()`)

### 2.3 Duplicated Logic

Both commands implement similar initialization logic separately:

| Logic | build.ts | run.ts |
|-------|----------|--------|
| Settings loading | Missing | Lines 749-754 |
| Settings injection | Missing | Lines 752-754 |
| API key validation | Lines 210-223 | Line 757 + import |

This duplication leads to:
1. **Inconsistent behavior** - Different commands behave differently
2. **Maintenance burden** - Changes must be applied to multiple places
3. **Bug-prone** - Easy to forget to update one location

### 2.4 Poor Error Messages

Current error message:

```
Error: ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN required
Get your API key from: https://console.anthropic.com
Or use --mock flag to run without API key
```

Missing guidance for:
- ZenMux users who should set `ZENMUX_API_KEY`
- Users who should configure via `looplia config provider preset`

---

## 3. Solution: Shared Command Initialization

### 3.1 Architecture

Extract the initialization logic from `run.ts` into a shared function that both commands use:

```
┌─────────────────────────────────────────────────────────────┐
│                  initializeCommandEnvironment()              │
│                                                              │
│  Step 1: Load settings from ~/.looplia/looplia.setting.json │
│          └── readLoopliaSettings()                           │
│                                                              │
│  Step 2: Inject settings into environment variables          │
│          └── injectLoopliaSettingsEnv()                      │
│              ├── ANTHROPIC_BASE_URL (for ZenMux/custom)     │
│              ├── ANTHROPIC_API_KEY (from authToken/env)     │
│              └── LOOPLIA_AGENT_MODEL_* (model config)       │
│                                                              │
│  Step 3: Validate API key presence (unless mock mode)        │
│          └── validateApiKeyPresence()                        │
│                                                              │
│  Returns: { settings: LoopliaSettings | null }               │
└─────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
      ┌─────────────┐           ┌─────────────┐
      │  build.ts   │           │   run.ts    │
      │             │           │             │
      │ parseArgs() │           │ parseArgs() │
      │ workspace() │           │ workspace() │
      │ init()  ────┼───────────┼─── init()   │
      │ execute()   │           │ execute()   │
      └─────────────┘           └─────────────┘
```

### 3.2 Reference Implementation: run.ts

The `run` command has the correct behavior. The shared function extracts this exact logic:

```typescript
// run.ts lines 749-757 (v0.6.6)

// 3. Load and inject provider settings (v0.6.6)
// Must happen BEFORE env validation so ZenMux API key is available
const settings = await readLoopliaSettings();
if (settings) {
  injectLoopliaSettingsEnv(settings);
}

// 4. Validate environment (after settings injection for ZenMux support)
validateEnvironment(parsed.mock);
```

### 3.3 Shared Function Design

**File:** `packages/provider/src/claude-agent-sdk/command-init.ts`

```typescript
import {
  readLoopliaSettings,
  injectLoopliaSettingsEnv,
  type LoopliaSettings,
} from "./model-provider";

export interface CommandInitOptions {
  mock?: boolean;
}

export interface CommandInitResult {
  settings: LoopliaSettings | null;
}

/**
 * Initialize command environment with settings and API key validation.
 * Extracted from run.ts v0.6.6 - this is the reference implementation.
 *
 * Order is critical:
 * 1. Load settings first (may contain authToken or trigger ZENMUX_API_KEY mapping)
 * 2. Inject settings into environment variables
 * 3. THEN validate API key presence
 *
 * @param options.mock - If true, skip API key validation
 * @returns The loaded settings (null if no settings file exists)
 */
export async function initializeCommandEnvironment(
  options: CommandInitOptions = {}
): Promise<CommandInitResult> {
  // Step 1: Load settings from ~/.looplia/looplia.setting.json
  // (Same as run.ts line 751)
  const settings = await readLoopliaSettings();

  // Step 2: Inject settings into environment
  // (Same as run.ts lines 752-754)
  if (settings) {
    injectLoopliaSettingsEnv(settings);
  }

  // Step 3: Validate API key (unless mock mode)
  // (Same as run.ts line 757, but with improved error messages)
  if (!options.mock) {
    validateApiKeyPresence();
  }

  return { settings };
}

/**
 * Validate that an API key is available.
 * Called AFTER settings injection so all key sources are available.
 */
function validateApiKeyPresence(): void {
  if (!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN)) {
    console.error("Error: API key required");
    console.error("");
    console.error("Options:");
    console.error("  1. Set ANTHROPIC_API_KEY environment variable");
    console.error("  2. Set ZENMUX_API_KEY with a ZenMux preset");
    console.error("  3. Configure via: looplia config provider preset <name>");
    console.error("  4. Use --mock flag for testing without API");
    console.error("");
    console.error("Get your API key from: https://console.anthropic.com");
    console.error("Or use ZenMux at: https://zenmux.ai");
    process.exit(1);
  }
}
```

### 3.4 Why Order Matters

The `injectLoopliaSettingsEnv()` function performs critical transformations:

```typescript
// From model-provider.ts
export function injectLoopliaSettingsEnv(settings: LoopliaSettings): void {
  if (settings.apiProvider.type !== "anthropic") {
    // Set endpoint URL for ZenMux/custom providers
    if (settings.apiProvider.baseUrl && !process.env.ANTHROPIC_BASE_URL) {
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
        // CRITICAL: Maps ZENMUX_API_KEY → ANTHROPIC_API_KEY
        process.env.ANTHROPIC_API_KEY = process.env.ZENMUX_API_KEY;
      }
    }
  }

  // Inject model tier environment variables
  injectModelTierEnv(settings.agents.main, settings.agents.executor);
}
```

If validation happens BEFORE this function runs, the `ZENMUX_API_KEY → ANTHROPIC_API_KEY` mapping never occurs, causing false-negative validation failures.

---

## 4. Implementation Details

### 4.1 New File: command-init.ts

**Location:** `packages/provider/src/claude-agent-sdk/command-init.ts`

```typescript
/**
 * Shared command initialization for build and run commands.
 * v0.6.10: Extracted from run.ts to ensure consistent behavior.
 *
 * @module command-init
 */

import {
  readLoopliaSettings,
  injectLoopliaSettingsEnv,
  type LoopliaSettings,
} from "./model-provider";

export interface CommandInitOptions {
  /**
   * If true, skip API key validation.
   * Used for --mock flag or offline testing.
   */
  mock?: boolean;
}

export interface CommandInitResult {
  /**
   * The loaded settings, or null if no settings file exists.
   * Can be used by commands that need access to settings.
   */
  settings: LoopliaSettings | null;
}

/**
 * Initialize command environment with settings and API key validation.
 *
 * This function ensures consistent initialization across all commands by:
 * 1. Loading settings from ~/.looplia/looplia.setting.json
 * 2. Injecting settings into environment variables (API key, base URL, models)
 * 3. Validating API key presence (after injection, so all sources are available)
 *
 * **Order is critical:** Settings must be loaded and injected BEFORE validation
 * because injectLoopliaSettingsEnv() may map ZENMUX_API_KEY to ANTHROPIC_API_KEY.
 *
 * @example
 * ```typescript
 * // In build.ts or run.ts
 * const workspace = ensureWorkspace(parsed.mock);
 * await initializeCommandEnvironment({ mock: parsed.mock });
 * // Now safe to execute - API key is validated
 * ```
 */
export async function initializeCommandEnvironment(
  options: CommandInitOptions = {}
): Promise<CommandInitResult> {
  // Step 1: Load settings from ~/.looplia/looplia.setting.json
  const settings = await readLoopliaSettings();

  // Step 2: Inject settings into environment
  // This may set ANTHROPIC_API_KEY from authToken or ZENMUX_API_KEY
  if (settings) {
    injectLoopliaSettingsEnv(settings);
  }

  // Step 3: Validate API key (unless mock mode)
  if (!options.mock) {
    validateApiKeyPresence();
  }

  return { settings };
}

/**
 * Validate that an API key is available.
 *
 * Called AFTER settings injection so all key sources are available:
 * - ANTHROPIC_API_KEY (direct or mapped from ZENMUX_API_KEY)
 * - CLAUDE_CODE_OAUTH_TOKEN (OAuth flow)
 *
 * Exits with code 1 if no key is found, displaying helpful guidance.
 */
function validateApiKeyPresence(): void {
  if (!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN)) {
    console.error("Error: API key required");
    console.error("");
    console.error("Options:");
    console.error("  1. Set ANTHROPIC_API_KEY environment variable");
    console.error("  2. Set ZENMUX_API_KEY with a ZenMux preset");
    console.error("  3. Configure via: looplia config provider preset <name>");
    console.error("  4. Use --mock flag for testing without API");
    console.error("");
    console.error("Get your API key from: https://console.anthropic.com");
    console.error("Or use ZenMux at: https://zenmux.ai");
    process.exit(1);
  }
}
```

### 4.2 Update build.ts

**Before (lines 615-628):**

```typescript
export async function runBuildCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  try {
    // 1. Validate environment
    validateEnvironment(parsed.mock);

    // 2. Ensure workspace
    const workspace = ensureWorkspace(parsed.mock);
```

**After:**

```typescript
import { initializeCommandEnvironment } from "@looplia-core/provider/claude-agent-sdk";

export async function runBuildCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  try {
    // 1. Ensure workspace
    const workspace = ensureWorkspace(parsed.mock);

    // 2. Load settings, inject env vars, validate API key (v0.6.10)
    await initializeCommandEnvironment({ mock: parsed.mock });
```

**Remove deprecated function:**

The local `validateEnvironment()` function (lines 210-223) can be removed or marked deprecated since it's now handled by the shared function.

### 4.3 Update run.ts

**Before (lines 749-757):**

```typescript
// 3. Load and inject provider settings (v0.6.6)
// Must happen BEFORE env validation so ZenMux API key is available
const settings = await readLoopliaSettings();
if (settings) {
  injectLoopliaSettingsEnv(settings);
}

// 4. Validate environment (after settings injection for ZenMux support)
validateEnvironment(parsed.mock);
```

**After:**

```typescript
import { initializeCommandEnvironment } from "@looplia-core/provider/claude-agent-sdk";

// 3. Load settings, inject env vars, validate API key (v0.6.10)
// Uses shared logic extracted from this file
await initializeCommandEnvironment({ mock: parsed.mock });
```

### 4.4 Export from index.ts

**File:** `packages/provider/src/claude-agent-sdk/index.ts`

Add export for the new module:

```typescript
// Command initialization (v0.6.10)
export {
  initializeCommandEnvironment,
  type CommandInitOptions,
  type CommandInitResult,
} from "./command-init";
```

---

## 5. File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/provider/src/claude-agent-sdk/command-init.ts` | **NEW** | Shared initialization function extracted from run.ts |
| `packages/provider/src/claude-agent-sdk/index.ts` | MODIFY | Export new command-init module |
| `apps/cli/src/commands/build.ts` | MODIFY | Use `initializeCommandEnvironment()`, fix order |
| `apps/cli/src/commands/run.ts` | MODIFY | Refactor to use shared function |

### Lines of Code Impact

| File | Lines Added | Lines Removed | Net Change |
|------|-------------|---------------|------------|
| command-init.ts | ~80 | 0 | +80 |
| build.ts | ~3 | ~15 | -12 |
| run.ts | ~2 | ~8 | -6 |
| index.ts | ~5 | 0 | +5 |
| **Total** | ~90 | ~23 | **+67** |

The increase in lines is due to comprehensive documentation in the new shared module.

---

## 6. Testing Plan

### 6.1 Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | `looplia build` with `ANTHROPIC_API_KEY` set | Works (existing behavior) |
| 2 | `looplia build` with `ZENMUX_API_KEY` + preset configured | **Works (was broken)** |
| 3 | `looplia build` with `authToken` in settings file | **Works (was broken)** |
| 4 | `looplia build --mock` | Skips validation (existing behavior) |
| 5 | `looplia run` with `ANTHROPIC_API_KEY` set | Works (no regression) |
| 6 | `looplia run` with `ZENMUX_API_KEY` + preset configured | Works (no regression) |
| 7 | `looplia run` with `authToken` in settings file | Works (no regression) |
| 8 | `looplia run --mock` | Skips validation (no regression) |
| 9 | No API key configured | Shows improved error message |

### 6.2 Manual Test Commands

```bash
# Test 1: Direct Anthropic key
export ANTHROPIC_API_KEY=sk-ant-xxx
looplia build "create a test workflow"

# Test 2: ZenMux with preset
looplia config provider preset zenmux-deepseek-v3.2
export ZENMUX_API_KEY=sk-xxx
unset ANTHROPIC_API_KEY
looplia build "create a test workflow"

# Test 3: Settings file authToken
looplia config provider set auth-token sk-xxx
unset ANTHROPIC_API_KEY
unset ZENMUX_API_KEY
looplia build "create a test workflow"

# Test 4: Mock mode (no API key needed)
unset ANTHROPIC_API_KEY
unset ZENMUX_API_KEY
looplia build --mock "create a test workflow"

# Test 5: Error message display
unset ANTHROPIC_API_KEY
unset ZENMUX_API_KEY
looplia config provider reset
looplia build "create a test workflow"
# Should show improved error message with all options
```

### 6.3 Error Message Verification

Expected error output when no API key is configured:

```
Error: API key required

Options:
  1. Set ANTHROPIC_API_KEY environment variable
  2. Set ZENMUX_API_KEY with a ZenMux preset
  3. Configure via: looplia config provider preset <name>
  4. Use --mock flag for testing without API

Get your API key from: https://console.anthropic.com
Or use ZenMux at: https://zenmux.ai
```

---

## 7. Migration Notes

### 7.1 Backward Compatibility

This is a **bug fix release** with no breaking changes:

- API remains the same
- CLI flags remain the same
- Settings file format remains the same
- Environment variables remain the same

### 7.2 Deprecation

The following functions are candidates for deprecation:

| Function | Location | Replacement |
|----------|----------|-------------|
| `validateEnvironment()` | `apps/cli/src/commands/build.ts` | `initializeCommandEnvironment()` |
| `validateEnvironment()` | `apps/cli/src/commands/run.ts` | `initializeCommandEnvironment()` |

These can be removed in v0.7.0 after confirming no external dependencies.

### 7.3 Future Considerations

The shared initialization function could be extended to handle:

1. **Model availability validation** - Warn if configured model is not available
2. **Preset compatibility check** - Verify preset matches SDK capabilities
3. **Settings migration** - Handle settings file version upgrades

These are out of scope for v0.6.10 but the shared function provides a natural extension point.

---

## Summary

v0.6.10 fixes a critical bug where `looplia build` fails for ZenMux users and users with `authToken` configured in settings. The fix extracts the correct initialization logic from `run.ts` into a shared `initializeCommandEnvironment()` function that both commands use.

**Key insight:** The order of operations matters. Settings must be loaded and injected BEFORE API key validation because `injectLoopliaSettingsEnv()` performs critical transformations like mapping `ZENMUX_API_KEY` to `ANTHROPIC_API_KEY`.

**Result:** Both `build` and `run` commands now have identical, consistent initialization behavior.
