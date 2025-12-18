# Looplia-Core Test Plan

> **Version:** 0.5
> **Date:** December 2025
> **Test Framework:** Bun Test (`bun:test`)
> **Related:** [AGENTIC_CONCEPT-0.4.md](./AGENTIC_CONCEPT-0.4.md) | [DESIGN-0.5.1.md](./DESIGN-0.5.1.md)

This document describes the test architecture for Looplia-Core v0.5, including the new **Real API Testing** workflow with subagent and skill verification.

---

## Table of Contents

1. [Test Architecture Overview](#1-test-architecture-overview)
2. [Test Inventory](#2-test-inventory)
3. [Local Development & Husky](#3-local-development--husky)
4. [Real API Testing with bun link](#4-real-api-testing-with-bun-link)
5. [Log Analysis for Subagent & Skill Verification](#5-log-analysis-for-subagent--skill-verification)
6. [CI/CD Pipeline](#6-cicd-pipeline)
7. [Docker E2E Testing](#7-docker-e2e-testing)
8. [LLM-as-Judge Evaluation](#8-llm-as-judge-evaluation)
9. [Test Patterns & Best Practices](#9-test-patterns--best-practices)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Test Architecture Overview

### Test Pyramid

```
                    /\
                   /  \
                  /    \
                 / Real  \       <- Real API (subagent/skill verification)
                /   API   \
               /----------\
              /  Docker    \     <- Docker E2E (LLM-as-Judge)
             /    E2E      \
            /--------------\
           /  CLI E2E       \   <- Binary execution (--mock flag)
          /------------------\
         /   Integration      \ <- Workflow orchestration (mock providers)
        /----------------------\
       /      Unit Tests        \ <- Isolated components (full mocking)
      /--------------------------\
```

### v0.5 Test Layers

| Layer | Purpose | API Usage | Speed |
|-------|---------|-----------|-------|
| **Unit** | Component isolation | None | ~ms |
| **Integration** | Service composition | Mock | ~100ms |
| **CLI E2E** | Binary execution | --mock flag | ~1s |
| **Real API** | Subagent/skill verification | Real Claude API | ~30-120s |
| **Docker E2E** | Production simulation | Real Claude API | ~60-180s |
| **LLM-as-Judge** | Semantic quality | Real Claude API | ~30-60s |

### v0.5 Key Changes

1. **3-Stage Pipeline**: content-analyzer → idea-generator → writing-kit-builder
2. **Custom Subagents**: Task tool with `subagent_type` instead of `general-purpose`
3. **Skills Auto-Loading**: `skills:` frontmatter field in agent definitions
4. **Validation-Driven**: workflow-validator skill with deterministic scripts
5. **Log Verification**: Verify subagent/skill invocation patterns in logs

---

## 2. Test Inventory

### Summary

| Package | Test Files | Categories |
|---------|------------|------------|
| `apps/cli/test/` | 4 files | Unit + CLI E2E |
| `packages/core/test/` | 4 files | Unit |
| `packages/provider/test/` | 11 files | Unit |
| **Total** | **19 files** | |

### CLI Package (`apps/cli/test/`)

| File | Category | Description |
|------|----------|-------------|
| `e2e/cli.test.ts` | CLI E2E | Full CLI binary execution (init, run) |
| `components/streaming-query-ui.test.ts` | Unit | Streaming TUI, activity ID generation |
| `utils/terminal.test.ts` | Unit | Terminal utilities |
| `utils/workflow-validator.test.ts` | Unit | Workflow validation utilities |

### Core Package (`packages/core/test/`)

| File | Category | Description |
|------|----------|-------------|
| `domain/validation.test.ts` | Unit | Zod schemas (ContentSummary, SessionManifest, etc.) |
| `services/summarization-engine.test.ts` | Unit | Summarization service |
| `services/ranking-engine.test.ts` | Unit | Content ranking |
| `adapters/mock/mock-summarizer.test.ts` | Unit | Mock summarizer behavior |

### Provider Package (`packages/provider/test/claude-agent-sdk/`)

| File | Category | Description |
|------|----------|-------------|
| `config.test.ts` | Unit | SDK configuration, API key handling |
| `schema-converter.test.ts` | Unit | Zod to JSON schema conversion |
| `prompts.test.ts` | Unit | Prompt generation |
| `error-mapper.test.ts` | Unit | SDK error mapping |
| `workspace.test.ts` | Unit | Workspace directory operations |
| `persist-result.test.ts` | Unit | Result persistence |
| `streaming/transformer.test.ts` | Unit | SDK message transformation |
| `streaming/query-executor.test.ts` | Unit | Query execution with settingSources |
| `utils/shared/content-id.test.ts` | Unit | Content ID extraction, path traversal prevention |

---

## 3. Local Development & Husky

### Pre-commit Workflow

```
[1] TYPE CHECKING (Fast fail)
    +- turbo check-types

[2] RUN ALL TESTS
    +- bun test

[3] CODE FORMATTING (Ultracite/Biome)
    +- bun x ultracite fix

[4] COMMIT PROCEEDS
```

### Running Tests Locally

```bash
# Run all tests
bun test

# Run tests with watch mode
bun test --watch

# Run specific package tests
cd packages/core && bun test
cd packages/provider && bun test
cd apps/cli && bun run test  # Requires build first

# Run specific test file
bun test test/streaming/transformer.test.ts
```

---

## 4. Real API Testing with bun link

### Overview

Real API testing validates the complete workflow execution with actual Claude API calls. This is essential for verifying:

1. **Custom subagents are invoked** (not `general-purpose`)
2. **Skills are auto-loaded** via `skills:` frontmatter
3. **Validation runs** via workflow-validator skill
4. **3-stage pipeline executes** in correct order

### Prerequisites

1. **API Key**: Valid `ANTHROPIC_API_KEY` in `.env` file
2. **Built Project**: Latest build with `bun run build`
3. **Linked CLI**: CLI linked globally with `bun link`

### Setup: Link Latest Build

```bash
# Step 1: Build the project
bun run build

# Step 2: Link CLI globally (from project root)
cd apps/cli
bun link

# Step 3: Verify link
which looplia
# Should show: ~/.bun/bin/looplia

looplia --version
# Should show: latest version
```

### Setup: Environment Variables

```bash
# Create .env file in project root
echo "ANTHROPIC_API_KEY=sk-ant-api03-xxx" > .env

# Verify .env is in .gitignore
grep ".env" .gitignore
```

### Initialize Workspace

```bash
# Bootstrap workspace from plugin templates
looplia init --workspace ~/.looplia

# Verify workspace structure
ls -la ~/.looplia/
# Should show: CLAUDE.md, workflows/, .claude/agents/, .claude/skills/

# Verify 3 agents exist
ls ~/.looplia/.claude/agents/
# Should show: content-analyzer.md, idea-generator.md, writing-kit-builder.md

# Verify skills exist
ls ~/.looplia/.claude/skills/
# Should show: workflow-validator/, media-reviewer/, etc.
```

### Run Workflow with Real API

```bash
# Create test content file
cat > /tmp/test-article.md << 'EOF'
# The Future of AI in Software Development

AI is transforming how developers write code...

## Key Trends
1. Code generation with LLMs
2. Automated bug detection
3. AI-assisted documentation

"The developers who embrace AI tools will be 10x more productive." - Expert

## Conclusion
The future belongs to developers who can effectively collaborate with AI.
EOF

# Run workflow with real API (env injection)
env $(cat .env) looplia run writing-kit --file /tmp/test-article.md

# Or use export
export $(cat .env)
looplia run writing-kit --file /tmp/test-article.md
```

### Expected Output

```
[Processing] Executing workflow: writing-kit
[Stage 1/3] content-analyzer → summary.json ✓
[Stage 2/3] idea-generator → ideas.json ✓
[Stage 3/3] writing-kit-builder → writing-kit.json ✓

{
  "contentId": "cli-1234567890",
  "source": { ... },
  "summary": { ... },
  "ideas": { ... },
  "suggestedOutline": [ ... ],
  "meta": { ... }
}
```

### Verify Generated Artifacts (v0.5.2 Sandbox Architecture)

```bash
# List sandbox folder
ls -la ~/.looplia/sandbox/*/

# Expected structure:
# sandbox/{sandbox-id}/
# ├── inputs/
# │   └── content.md          # Input content (copied from --file)
# ├── outputs/
# │   ├── summary.json        # Stage 1 output
# │   ├── ideas.json          # Stage 2 output
# │   └── writing-kit.json    # Stage 3 output (final)
# ├── logs/
# │   └── query-*.log         # Session logs
# └── validation.json         # Validation state

# Check validation state
cat ~/.looplia/sandbox/*/validation.json | jq .

# Expected: all outputs validated: true
```

---

## 5. Log Analysis for Subagent & Skill Verification

### Overview

Log analysis is critical for verifying that the workflow system correctly:
1. Uses **custom subagent_type** (not `general-purpose`)
2. Invokes **skills auto-loaded** from agent frontmatter
3. Runs **workflow-validator** skill after each stage
4. Follows **dependency order** (summary → ideas → writing-kit)

### Log File Location (v0.5.2)

```bash
# Find the latest log file in sandbox
ls -la ~/.looplia/sandbox/*/logs/

# Log file naming: query-YYYY-MM-DDTHH-MM-SS-MMMZ.log
# Example: query-2025-12-18T09-45-18-294Z.log
```

### Key Patterns to Verify

#### 1. Custom Subagent Types (CRITICAL)

Search for Task tool invocations with custom `subagent_type`:

```bash
# Grep for subagent_type in log
grep -o '"subagent_type"[^,]*' ~/.looplia/sandbox/*/logs/*.log

# Expected output (GOOD):
# "subagent_type": "content-analyzer"
# "subagent_type": "idea-generator"
# "subagent_type": "writing-kit-builder"

# BAD pattern (should NOT see):
# "subagent_type": "general-purpose"
```

#### 2. Task Tool Invocations

```bash
# Grep for Task tool usage
grep -c '"name".*"Task"' ~/.looplia/sandbox/*/logs/*.log

# Should see 3 Task invocations (one per stage)
```

#### 3. Skill Tool Invocations

```bash
# Grep for Skill tool usage
grep -c '"Skill"' ~/.looplia/sandbox/*/logs/*.log

# Should see workflow-validator skill invocations
# Also may see auto-loaded skills: media-reviewer, content-documenter, etc.
```

#### 4. Validation Script Execution

```bash
# Grep for validate.ts execution
grep -c "validate.ts" ~/.looplia/sandbox/*/logs/*.log

# Should see Bash calls like:
# bun .claude/skills/workflow-validator/scripts/validate.ts outputs/summary.json '{"required_fields":...}'
```

#### 5. Artifacts Written

```bash
# Grep for Write tool usage with artifact names
grep -n "outputs/summary.json\|outputs/ideas.json\|outputs/writing-kit.json" ~/.looplia/sandbox/*/logs/*.log
```

### Verification Checklist

```markdown
## Real API Test Verification Checklist

### Subagent Invocation
- [ ] content-analyzer subagent invoked (not general-purpose)
- [ ] idea-generator subagent invoked (not general-purpose)
- [ ] writing-kit-builder subagent invoked (not general-purpose)

### Skills Auto-Loading
- [ ] media-reviewer skill loaded by content-analyzer
- [ ] content-documenter skill loaded by content-analyzer
- [ ] user-profile-reader skill loaded by idea-generator
- [ ] user-profile-reader skill loaded by writing-kit-builder

### Validation
- [ ] workflow-validator skill invoked after summary.json
- [ ] workflow-validator skill invoked after ideas.json
- [ ] workflow-validator skill invoked after writing-kit.json
- [ ] validate.ts script executed (Bash tool)

### Artifacts
- [ ] summary.json created
- [ ] ideas.json created
- [ ] writing-kit.json created
- [ ] validation.json shows all validated: true
```

### Example Log Analysis Session (v0.5.2)

```bash
# Step 1: Run workflow (creates sandbox automatically)
ANTHROPIC_API_KEY="sk-ant-..." looplia run writing-kit --file /tmp/test-article.md

# Step 2: Find sandbox ID (from CLI output or by listing)
SANDBOX_ID=$(ls ~/.looplia/sandbox/ | tail -1)
echo "Sandbox: $SANDBOX_ID"

# Step 3: Verify sandbox structure
ls -la ~/.looplia/sandbox/$SANDBOX_ID/
# Should show: inputs/, outputs/, logs/, validation.json

# Step 4: Find log file
LOG_FILE=$(ls ~/.looplia/sandbox/$SANDBOX_ID/logs/*.log | head -1)
echo "Log: $LOG_FILE"

# Step 5: Verify custom subagent_type
echo "=== Subagent Types ==="
grep -o '"subagent_type"[^,]*' $LOG_FILE

# Step 6: Verify Task tool invocations (count should be 3)
echo "=== Task Invocations ==="
grep -c '"name".*"Task"' $LOG_FILE

# Step 7: Verify Skill tool invocations
echo "=== Skill Invocations ==="
grep '"name".*"Skill"' $LOG_FILE

# Step 8: Verify validation script
echo "=== Validation Script ==="
grep "validate.ts" $LOG_FILE

# Step 9: Check validation.json
echo "=== Validation State ==="
cat ~/.looplia/sandbox/$SANDBOX_ID/validation.json | jq '.outputs | to_entries[] | {name: .key, validated: .value.validated}'

# Step 10: Verify outputs exist
echo "=== Outputs ==="
ls -la ~/.looplia/sandbox/$SANDBOX_ID/outputs/
```

### Expected Log Patterns

#### Good Pattern (Custom Subagents)

```json
{
  "type": "tool_use",
  "name": "Task",
  "input": {
    "subagent_type": "content-analyzer",
    "description": "Generate summary artifact",
    "prompt": "Analyze content at sandbox/my-article-2025-12-18-xk7m/inputs/content.md..."
  }
}
```

#### Bad Pattern (Generic Subagent)

```json
{
  "type": "tool_use",
  "name": "Task",
  "input": {
    "subagent_type": "general-purpose",  // ❌ WRONG!
    "prompt": "..."
  }
}
```

### Automated Log Verification Script

```bash
#!/bin/bash
# verify-workflow-log.sh

LOG_FILE=$1

if [ -z "$LOG_FILE" ]; then
  echo "Usage: ./verify-workflow-log.sh <log-file>"
  exit 1
fi

echo "=== Workflow Log Verification ==="
echo "Log: $LOG_FILE"
echo ""

# Check for custom subagent types
echo "1. Custom Subagent Types:"
if grep -q '"subagent_type": "content-analyzer"' "$LOG_FILE"; then
  echo "   ✓ content-analyzer"
else
  echo "   ✗ content-analyzer NOT FOUND"
fi

if grep -q '"subagent_type": "idea-generator"' "$LOG_FILE"; then
  echo "   ✓ idea-generator"
else
  echo "   ✗ idea-generator NOT FOUND"
fi

if grep -q '"subagent_type": "writing-kit-builder"' "$LOG_FILE"; then
  echo "   ✓ writing-kit-builder"
else
  echo "   ✗ writing-kit-builder NOT FOUND"
fi

# Check for general-purpose (should NOT exist)
if grep -q '"subagent_type": "general-purpose"' "$LOG_FILE"; then
  echo "   ✗ FAIL: general-purpose subagent detected!"
else
  echo "   ✓ No general-purpose subagent"
fi

echo ""

# Check for Task tool invocations
TASK_COUNT=$(grep -c '"name".*"Task"' "$LOG_FILE" 2>/dev/null || echo "0")
echo "2. Task Tool Invocations: $TASK_COUNT (expected: 3)"

# Check for Skill tool invocations
SKILL_COUNT=$(grep -c '"name".*"Skill"' "$LOG_FILE" 2>/dev/null || echo "0")
echo "3. Skill Tool Invocations: $SKILL_COUNT"

# Check for validation script
VALIDATE_COUNT=$(grep -c "validate.ts" "$LOG_FILE" 2>/dev/null || echo "0")
echo "4. Validation Script Calls: $VALIDATE_COUNT (expected: 3)"

echo ""
echo "=== Verification Complete ==="
```

---

## 6. CI/CD Pipeline

### Main CI Workflow

**File:** `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun x ultracite check
      - run: bun run check-types
      - run: bun test
```

### Real API Workflow (Manual)

**File:** `.github/workflows/real-api-test.yml`

```yaml
name: Real API Test
on:
  workflow_dispatch:
    inputs:
      test_file:
        description: 'Test file path'
        default: 'examples/ai-healthcare.md'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
      - run: bun link
      - run: looplia init
      - run: |
          looplia run writing-kit --file ${{ inputs.test_file }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - name: Verify subagents
        run: |
          LOG=$(ls ~/.looplia/sandbox/*/logs/*.log | head -1)
          grep "content-analyzer" $LOG
          grep "idea-generator" $LOG
          grep "writing-kit-builder" $LOG
```

---

## 7. Docker E2E Testing

### Running Docker Tests

```bash
# Build Docker image
docker build -t looplia:test .

# Run workflow in Docker
docker run --rm \
  --env-file .env \
  -v "$(pwd)/test-workspace:/home/looplia/.looplia" \
  -v "$(pwd)/examples:/examples:ro" \
  looplia:test \
  run writing-kit --file /examples/ai-healthcare.md
```

### Workspace Output Structure (v0.5.2)

```
test-workspace/
├── workflows/
│   └── writing-kit.md
├── .claude/
│   ├── agents/
│   │   ├── content-analyzer.md
│   │   ├── idea-generator.md
│   │   └── writing-kit-builder.md
│   └── skills/
│       ├── workflow-validator/
│       ├── media-reviewer/
│       └── user-profile-reader/
├── sandbox/{sandbox-id}/           # v0.5.2 sandbox architecture
│   ├── inputs/
│   │   └── content.md              # Input content
│   ├── outputs/
│   │   ├── summary.json            # Stage 1
│   │   ├── ideas.json              # Stage 2
│   │   └── writing-kit.json        # Stage 3 (final)
│   ├── logs/
│   │   └── query-*.log             # Session logs
│   └── validation.json             # Validation state
└── CLAUDE.md
```

---

## 8. LLM-as-Judge Evaluation

### Evaluation Criteria (12 points total)

| Component | Criteria | Points |
|-----------|----------|--------|
| **Summary** | Accuracy, Completeness, Clarity, Faithfulness | 4 |
| **Ideas** | Hooks, Angles, Questions, Grounding | 4 |
| **Outline** | Structure, Coverage, Actionable, Realistic | 4 |

### Pass Threshold

- **PASS**: >= 9/12 points (75%)
- **FAIL**: < 9/12 points

---

## 9. Test Patterns & Best Practices

### Testing settingSources Configuration

```typescript
import { describe, it, expect } from "bun:test";

describe("SDK Configuration", () => {
  it("should include settingSources for subagent discovery", () => {
    const options = buildQueryOptions(config);

    expect(options.settingSources).toContain("project");
  });

  it("should include Task in allowedTools", () => {
    const options = buildQueryOptions(config);

    expect(options.allowedTools).toContain("Task");
    expect(options.allowedTools).toContain("Skill");
  });
});
```

### Testing Workflow Definition

```typescript
describe("Workflow Definition", () => {
  it("should have 3 stages", () => {
    const workflow = parseWorkflow("workflows/writing-kit.md");

    expect(Object.keys(workflow.outputs)).toHaveLength(3);
    expect(workflow.outputs).toHaveProperty("summary");
    expect(workflow.outputs).toHaveProperty("ideas");
    expect(workflow.outputs).toHaveProperty("writing-kit");
  });

  it("should define correct dependencies", () => {
    const workflow = parseWorkflow("workflows/writing-kit.md");

    expect(workflow.outputs.ideas.requires).toContain("summary");
    expect(workflow.outputs["writing-kit"].requires).toContain("ideas");
  });
});
```

### Testing Agent Definition

```typescript
describe("Agent Definition", () => {
  it("should have skills field for auto-loading", () => {
    const agent = parseAgent("agents/content-analyzer.md");

    expect(agent.skills).toBeDefined();
    expect(agent.skills).toContain("media-reviewer");
    expect(agent.skills).toContain("content-documenter");
  });

  it("should include Write tool for artifact creation", () => {
    const agent = parseAgent("agents/content-analyzer.md");

    expect(agent.tools).toContain("Write");
  });
});
```

---

## 10. Troubleshooting

### API Key Issues

```bash
# Verify API key is set
echo $ANTHROPIC_API_KEY | head -c 20

# Verify .env file
cat .env | grep ANTHROPIC

# Use env injection
env $(cat .env) looplia run writing-kit --file test.md
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

### Subagent Not Using Custom Type

If logs show `general-purpose` instead of custom subagent:

1. Check `settingSources: ["project"]` in query options
2. Check `allowedTools` includes `"Task"`
3. Check agent files exist in `.claude/agents/`
4. Run `looplia init` to refresh workspace

### Skills Not Loading

If skills don't auto-load:

1. Check `skills:` field in agent frontmatter
2. Check skill directories exist in `.claude/skills/`
3. Check `settingSources: ["project"]` is configured
4. Check `allowedTools` includes `"Skill"`

### Validation Failures

If validation fails:

```bash
# Check validation.json for failed checks
cat ~/.looplia/sandbox/*/validation.json | jq .

# Run validator manually
bun ~/.looplia/.claude/skills/workflow-validator/scripts/validate.ts \
  ~/.looplia/sandbox/*/outputs/summary.json \
  '{"required_fields":["contentId","headline"]}'
```

### Logs Not Being Written (v0.5.2)

If `sandbox/{id}/logs/` is empty:

1. Verify CLI creates sandbox before execution (check "Created sandbox: ..." message)
2. Verify prompt includes `--sandbox-id` (logger extracts ID from prompt)
3. Check logger initialization in `query-executor.ts`

---

## Cross-References

- **Agent System**: [AGENTIC_CONCEPT-0.5.md](./AGENTIC_CONCEPT-0.5.md)
- **Architecture**: [DESIGN-0.5.2.md](./DESIGN-0.5.2.md)
- **Skills**: [AGENT-SKILLS.md](./AGENT-SKILLS.md)
- **Glossary**: [GLOSSARY.md](./GLOSSARY.md)

---

*This test plan is maintained for Looplia-Core v0.5.*
