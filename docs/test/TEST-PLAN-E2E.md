# Looplia-Core E2E Test Plan

> **Version:** 0.6.6
> **Date:** December 2025
> **Focus:** Model Provider Configuration & Dual-Strategy Execution
> **Related:** [DESIGN-0.6.6.md](../DESIGN-0.6.6.md) | [TEST_PLAN-0.6.md](../archive/TEST_PLAN-0.6.md)

This document provides comprehensive **end-to-end manual testing** procedures for validating Looplia-Core v0.6.6 features, focusing on the Model Provider Configuration and Dual-Strategy Execution patterns.

---

## Table of Contents

1. [Test Overview](#1-test-overview)
2. [Prerequisites](#2-prerequisites)
3. [Build and Link CLI](#3-build-and-link-cli)
4. [Init Command - Two-Plugin Verification](#4-init-command---two-plugin-verification)
5. [Test Anthropic Haiku (Subagent Strategy)](#5-test-anthropic-haiku-subagent-strategy)
6. [Test ZenMux GLM-4.7 (Inline Strategy)](#6-test-zenmux-glm-47-inline-strategy)
7. [Test ZenMux MiniMax-M2.1 (Inline Strategy)](#7-test-zenmux-minimax-m21-inline-strategy)
8. [Environment Injection Patterns](#8-environment-injection-patterns)
9. [Verification Checklists](#9-verification-checklists)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Test Overview

### v0.6.6 Key Features

| Feature | Description |
|---------|-------------|
| **Model Provider Configuration** | Switch between Anthropic Direct and proxy providers (ZenMux) via CLI |
| **Dual-Strategy Execution** | Anthropic uses Task subagents; ZenMux uses inline execution |
| **Preset System** | Pre-configured provider/model combinations |
| **Auto API Key Mapping** | `ZENMUX_API_KEY` auto-mapped to `ANTHROPIC_API_KEY` |

### Dual-Strategy Execution Pattern

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         DUAL-STRATEGY EXECUTION                             │
└────────────────────────────────────────────────────────────────────────────┘

                         Provider Detection
                         ┌──────────────────────────────────────────────────┐
                         │ isProxyProvider = settings?.apiProvider.type !== │
                         │                   "anthropic"                     │
                         └─────────────────────┬────────────────────────────┘
                                               │
                   ┌───────────────────────────┴───────────────────────────┐
                   │                                                       │
                   ▼                                                       ▼
     ┌─────────────────────────────┐             ┌─────────────────────────────┐
     │ ANTHROPIC DIRECT            │             │ PROXY PROVIDER (ZenMux)     │
     │ isProxyProvider = false     │             │ isProxyProvider = true      │
     ├─────────────────────────────┤             ├─────────────────────────────┤
     │ Skill: workflow-executor    │             │ Skill: workflow-executor-   │
     │ Execution: Task subagents   │             │        inline               │
     │ Agent: skill-executor       │             │ Execution: Inline (no Task) │
     │ Logs: Task tool invocations │             │ Logs: Direct Skill calls    │
     └─────────────────────────────┘             └─────────────────────────────┘
```

### Test Matrix

| Test Case | Provider | Strategy | Expected Logs |
|-----------|----------|----------|---------------|
| Anthropic Haiku | `anthropic` | Subagent | Task tool + `skill-executor` |
| ZenMux GLM-4.7 | `zenmux` | Inline | NO Task, direct Skill calls |
| ZenMux MiniMax-M2.1 | `zenmux` | Inline | NO Task, direct Skill calls |

---

## 2. Prerequisites

### Environment Setup

Create a `.env` file in the project root:

```bash
# For Anthropic Direct testing
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# For ZenMux testing (auto-mapped to ANTHROPIC_API_KEY by looplia)
ZENMUX_API_KEY=sk-ai-v1-your-zenmux-key-here
```

**Note:** Looplia automatically maps `ZENMUX_API_KEY` to `ANTHROPIC_API_KEY` when using ZenMux presets. You don't need to set both for the same test.

### Required Tools

- `bun` (package manager)
- `jq` (JSON processor for log analysis)

### Test Content

The test uses the example file included in the repository:

```
./examples/ai-healthcare.md
```

---

## 3. Build and Link CLI

Before testing, build the project and link the CLI globally.

### Step 1: Build the Project

```bash
# From project root
bun run build
```

### Step 2: Link CLI Globally

```bash
cd apps/cli
bun link
```

### Step 3: Verify Link

```bash
which looplia
# Expected: ~/.bun/bin/looplia

looplia --version
# Expected: current version number (e.g., 0.6.6)
```

### Step 4: Verify Working Directory

```bash
# Return to project root
cd /path/to/looplia-core

# Confirm you're in the project folder
pwd
# Expected: /path/to/looplia-core
```

**Important:** Running tests from the project root folder proves that the sandbox is correctly created at `~/.looplia/` rather than relative to the current directory.

---

## 4. Init Command - Two-Plugin Verification

The `init` command bootstraps the workspace with both plugins merged.

### Step 1: Clean Existing Workspace

```bash
rm -rf ~/.looplia
```

### Step 2: Initialize Workspace

```bash
looplia init --yes
```

### Step 3: Verify Two-Plugin Skill Structure

```bash
ls ~/.looplia/.claude/skills/
```

**Expected skills from looplia-core (6 skills):**

| Skill | Purpose |
|-------|---------|
| `workflow-executor/` | Subagent-based workflow execution (Anthropic) |
| `workflow-executor-inline/` | Inline workflow execution (ZenMux) |
| `workflow-validator/` | JSON output validation |
| `plugin-registry-scanner/` | Discover available skills |
| `skill-capability-matcher/` | Match requirements to skills |
| `workflow-schema-composer/` | Generate workflow definitions |

**Expected skills from looplia-writer (5 skills):**

| Skill | Purpose |
|-------|---------|
| `media-reviewer/` | Deep content analysis |
| `content-documenter/` | Structure content documentation |
| `idea-synthesis/` | Generate hooks, angles, questions |
| `writing-kit-assembler/` | Assemble final writing kit |
| `user-profile-reader/` | Read user preferences |

### Step 4: Verify Workflows

```bash
ls ~/.looplia/workflows/
# Expected: writing-kit.md
```

### Step 5: Verify CLAUDE.md Entry Point

```bash
ls ~/.looplia/CLAUDE.md
# Expected: file exists
```

### Verification Checklist

- [ ] `~/.looplia/.claude/skills/` contains 11 skill folders
- [ ] `~/.looplia/workflows/writing-kit.md` exists
- [ ] `~/.looplia/CLAUDE.md` exists

---

## 5. Test Anthropic Haiku (Subagent Strategy)

This test validates that Anthropic Direct mode uses Task subagents with `skill-executor`.

### Setup: Remove Provider Config (Use Defaults)

```bash
rm -f ~/.looplia/looplia.setting.json
```

Or explicitly set Anthropic preset:

```bash
looplia config provider preset ANTHROPIC_CLAUDE_HAIKU
```

### Execute Workflow

```bash
# From project root
cd /path/to/looplia-core

# Run workflow with env injection
env $(cat .env) looplia run writing-kit --file ./examples/ai-healthcare.md
```

**Expected:** Workflow completes with 3 steps (analyze → ideas → writing-kit)

### Log Verification

```bash
# Find the latest sandbox
SANDBOX_ID=$(ls ~/.looplia/sandbox/ | tail -1)
echo "Sandbox: $SANDBOX_ID"

# Find the log file
LOG_FILE=$(ls ~/.looplia/sandbox/$SANDBOX_ID/logs/*.log | head -1)
echo "Log: $LOG_FILE"
```

#### Verify Subagent Strategy

```bash
echo "=== Subagent Strategy Verification ==="

# CRITICAL: Must see Task tool with skill-executor
echo "Subagent types found:"
grep -o '"subagent_type"[^,]*' $LOG_FILE
# Expected: "subagent_type": "skill-executor" (appears 3 times)

# CRITICAL: Must see 3 Task invocations (one per workflow step)
echo "Task invocations count:"
grep -c '"name".*"Task"' $LOG_FILE
# Expected: 3

# Must see Skill tool usage
echo "Skill invocations count:"
grep -c '"name".*"Skill"' $LOG_FILE
# Expected: >= 3

# MUST NOT see inline executor
echo "Inline executor usage (should be 0):"
grep -c "workflow-executor-inline" $LOG_FILE
# Expected: 0
```

### Output Verification

```bash
# Verify outputs created
echo "Output files:"
ls ~/.looplia/sandbox/$SANDBOX_ID/outputs/
# Expected: analysis.json OR summary.json, ideas.json, writing-kit.json

# Check validation state
echo "Validation state:"
cat ~/.looplia/sandbox/$SANDBOX_ID/validation.json | jq '.steps | to_entries[] | {name: .key, validated: .value.validated}'
# Expected: All steps show validated: true
```

### Expected Log Pattern (Anthropic)

```json
{
  "type": "tool_use",
  "name": "Task",
  "input": {
    "subagent_type": "skill-executor",
    "description": "Execute step: analyze-content",
    "prompt": "Execute skill 'media-reviewer' for step 'analyze-content'..."
  }
}
```

---

## 6. Test ZenMux GLM-4.7 (Inline Strategy)

This test validates that proxy providers use inline execution WITHOUT Task subagents.

### Setup: Apply ZenMux GLM Preset

```bash
looplia config provider preset ZENMUX_ZAI_GLM47
```

### Verify Configuration

```bash
looplia config provider show
```

**Expected output:**
```
Model Provider Configuration:
  Status: configured
  Preset: ZENMUX_ZAI_GLM47
  Provider: https://zenmux.ai/api/anthropic

  Agent Models:
    Main: z-ai/glm-4.7
    Executor: z-ai/glm-4.7
```

### Verify Settings File

```bash
cat ~/.looplia/looplia.setting.json | jq '.apiProvider.type'
# Expected: "zenmux"
```

### Execute Workflow

```bash
# Ensure ZENMUX_API_KEY is in .env
env $(cat .env) looplia run writing-kit --file ./examples/ai-healthcare.md
```

### Log Verification (Inline Strategy)

```bash
SANDBOX_ID=$(ls ~/.looplia/sandbox/ | tail -1)
LOG_FILE=$(ls ~/.looplia/sandbox/$SANDBOX_ID/logs/*.log | head -1)

echo "=== Inline Strategy Verification ==="

# CRITICAL: Must NOT see Task/subagent usage
echo "Subagent spawning (should be 0):"
grep -c '"subagent_type"' $LOG_FILE
# Expected: 0

echo "Task tool usage (should be 0):"
grep -c '"name".*"Task"' $LOG_FILE
# Expected: 0

# Must see Skill tool invocations (inline execution)
echo "Skill invocations (should be >= 3):"
grep -c '"name".*"Skill"' $LOG_FILE
# Expected: >= 3

# Check system prompt hint for inline mode
echo "Inline mode hint present:"
grep -c "Inline.*Proxy\|workflow-executor-inline" $LOG_FILE
# Expected: >= 0 (confirms system prompt injection)
```

### Output Verification

```bash
# Same as Anthropic - verify outputs
ls ~/.looplia/sandbox/$SANDBOX_ID/outputs/
cat ~/.looplia/sandbox/$SANDBOX_ID/validation.json | jq '.steps | to_entries[] | {name: .key, validated: .value.validated}'
# Expected: All validated: true
```

### Expected Log Pattern (ZenMux)

NO Task tool invocations. Instead, direct Skill usage:

```json
{
  "type": "tool_use",
  "name": "Skill",
  "input": {
    "skill": "media-reviewer"
  }
}
```

---

## 7. Test ZenMux MiniMax-M2.1 (Inline Strategy)

### Setup: Apply MiniMax Preset

```bash
looplia config provider preset ZENMUX_MINIMAX_M21
```

### Verify Configuration

```bash
looplia config provider show
# Expected: Main: minimax/minimax-m2.1
```

### Execute Workflow

```bash
env $(cat .env) looplia run writing-kit --file ./examples/ai-healthcare.md
```

### Verification

Same as GLM-4.7 - verify inline strategy:
- NO Task tool invocations
- NO `subagent_type` in logs
- Direct Skill tool calls present

---

## 8. Environment Injection Patterns

### Recommended Pattern

```bash
# Always use this pattern
env $(cat .env) looplia run writing-kit --file test.md
```

### Why NOT xargs

```bash
# DON'T use xargs - can break special characters in API keys
# BAD: env $(cat .env | xargs) looplia run ...
```

Special characters in API keys (like `+`, `=`, `/`) may be corrupted by xargs.

### Alternative: Export

```bash
export $(cat .env)
looplia run writing-kit --file test.md
```

**Note:** This exports variables to your shell session. You may want to use a subshell:

```bash
(export $(cat .env) && looplia run writing-kit --file test.md)
```

### Environment Variable Precedence

| Priority | Source | Description |
|----------|--------|-------------|
| 1 (highest) | Shell environment | `export LOOPLIA_AGENT_MODEL_MAIN=...` |
| 2 | looplia.setting.json | `~/.looplia/looplia.setting.json` |
| 3 (lowest) | Hardcoded defaults | `claude-haiku-4-5-20251001` |

---

## 9. Verification Checklists

### Anthropic Mode (Subagent Strategy)

- [ ] Provider config removed OR set to `ANTHROPIC_CLAUDE_HAIKU`
- [ ] Workflow completes successfully
- [ ] Log shows `"subagent_type": "skill-executor"` (3 occurrences)
- [ ] Log shows Task tool invocations (count: 3)
- [ ] Log shows Skill tool invocations (count: >= 3)
- [ ] Log does NOT show `workflow-executor-inline`
- [ ] All outputs created in `sandbox/{id}/outputs/`
- [ ] All steps show `validated: true` in validation.json

### ZenMux GLM-4.7 Mode (Inline Strategy)

- [ ] Provider preset set to `ZENMUX_ZAI_GLM47`
- [ ] `looplia.setting.json` shows `apiProvider.type: "zenmux"`
- [ ] Workflow completes successfully
- [ ] Log does NOT show `subagent_type` (count: 0)
- [ ] Log does NOT show Task tool invocations (count: 0)
- [ ] Log shows Skill tool invocations (count: >= 3)
- [ ] All outputs created in `sandbox/{id}/outputs/`
- [ ] All steps show `validated: true` in validation.json

### ZenMux MiniMax-M2.1 Mode (Inline Strategy)

- [ ] Provider preset set to `ZENMUX_MINIMAX_M21`
- [ ] Same verification as GLM-4.7
- [ ] Model string is `minimax/minimax-m2.1`

### Plugin System Verification

- [ ] looplia-core skills present (6 skills)
- [ ] looplia-writer skills present (5 skills)
- [ ] `workflows/writing-kit.md` exists
- [ ] Sandbox created at `~/.looplia/sandbox/`

---

## 10. Troubleshooting

### API Key Issues

```bash
# Verify API key is set
echo $ANTHROPIC_API_KEY | head -c 20
# or
echo $ZENMUX_API_KEY | head -c 20

# Verify .env file content
cat .env | grep -E "ANTHROPIC|ZENMUX"
```

### bun link Issues

```bash
# Rebuild and relink
bun run build
cd apps/cli
bun unlink
bun link

# Verify linked version
looplia --version
```

### Subagent Not Using Custom Type (Anthropic)

If logs show no `subagent_type` when using Anthropic:

1. Verify no `looplia.setting.json` exists OR it has `apiProvider.type: "anthropic"`
2. Check that `ANTHROPIC_API_KEY` is set (not `ZENMUX_API_KEY`)
3. Run `looplia init` to refresh workspace

### Task Subagents in ZenMux Mode

If logs show Task tool usage when using ZenMux:

1. Verify `looplia.setting.json` has `apiProvider.type: "zenmux"`
2. Check provider detection in `query-executor.ts:117`
3. Restart and try again

### Validation Failures

```bash
# Check validation.json for failed checks
cat ~/.looplia/sandbox/*/validation.json | jq .

# Check individual output files
cat ~/.looplia/sandbox/*/outputs/analysis.json | jq .
```

### Logs Not Being Written

If `sandbox/{id}/logs/` is empty:

1. Verify CLI creates sandbox before execution
2. Check logger initialization in `query-executor.ts`
3. Look for errors in CLI output

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts` | Provider detection (line 117), conditional agent registration |
| `packages/provider/src/claude-agent-sdk/model-provider.ts` | Settings read/write, presets, env injection |
| `plugins/looplia-core/skills/workflow-executor/SKILL.md` | Subagent strategy skill |
| `plugins/looplia-core/skills/workflow-executor-inline/SKILL.md` | Inline strategy skill |
| `~/.looplia/looplia.setting.json` | Runtime provider configuration |
| `~/.looplia/sandbox/{id}/logs/*.log` | Session logs for verification |

---

## Cross-References

- **v0.6.6 Design:** [DESIGN-0.6.6.md](../DESIGN-0.6.6.md)
- **Previous Test Plan:** [TEST_PLAN-0.6.md](../archive/TEST_PLAN-0.6.md)
- **Agent SDK Documentation:** [AGENT-SDK.md](../AGENT-SDK.md)
- **Glossary:** [GLOSSARY.md](../GLOSSARY.md)

---

*This test plan is maintained for Looplia-Core v0.6.6.*
