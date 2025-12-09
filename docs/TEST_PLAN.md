# Looplia Core Test Plan

**Version**: 0.3.3
**Last Updated**: December 2024
**Test Framework**: Bun Test (`bun:test`)

---

## Table of Contents

1. [Test Categories](#1-test-categories)
2. [Test Inventory](#2-test-inventory)
3. [Running Tests](#3-running-tests)
4. [Docker E2E Test Strategy](#4-docker-e2e-test-strategy)
5. [Future Improvements](#5-future-improvements)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Test Categories

### Overview

| Category | Purpose | Mocking | Real API | Speed |
|----------|---------|---------|----------|-------|
| **Unit** | Test individual functions/classes in isolation | Full | No | Fast (~ms) |
| **Integration** | Test multiple components working together (pipeline orchestration) | Providers only | No | Fast (~100ms) |
| **CLI E2E** | Test CLI binary execution (argument parsing, file I/O, output formats) | `--mock` flag | No | Medium (~1s) |
| **Docker E2E** | Test complete system with real AI responses and output quality | None | **Yes** | Slow (~30-60s) |

### Key Distinctions

- **Unit Tests**: Test individual functions and classes in complete isolation. All dependencies are mocked. Fast and deterministic.

- **Integration Tests**: Test that multiple services compose correctly (summarize → ideas → outline). Uses mock providers but tests real business logic orchestration.

- **CLI E2E Tests**: Test the compiled CLI binary end-to-end. Uses `--mock` flag to avoid API calls. Validates argument parsing, file I/O, output formats, and exit codes. Tests the "plumbing" works correctly.

- **Docker E2E Tests**: Test the complete system with **real Claude API calls** inside a Docker container. Validates actual AI output quality, not just structure. This is the only test category that verifies the AI produces useful, high-quality results.

### Test Pyramid

```
                    /\
                   /  \
                  /    \
                 / Docker\       <- Real API (validates AI quality)
                /   E2E   \
               /----------\
              /  CLI E2E   \     <- Binary execution (--mock)
             /--------------\
            /  Integration   \   <- Pipeline orchestration (mocked)
           /------------------\
          /    Unit Tests      \ <- Individual components (full mock)
         /----------------------\
```

---

## 2. Test Inventory

### Summary

| Package | Test Files | Categories |
|---------|------------|------------|
| `packages/core/test/` | 6 files | Unit + Integration |
| `packages/provider/test/` | 5 files | Unit |
| `apps/cli/test/` | 3 files | Unit + CLI E2E |
| **Total** | **14 files** | |

### Core Package (`packages/core/test/`)

| File | Category | Description |
|------|----------|-------------|
| `integration/full-pipeline.test.ts` | Integration | Full WritingKit generation pipeline with mock providers |
| `domain/validation.test.ts` | Unit | Zod schema validation for ContentSummary, ContentItem, UserProfile, WritingIdeas |
| `services/summarization-engine.test.ts` | Unit | Summarization service with mock providers |
| `services/writing-kit-engine.test.ts` | Unit | Kit building orchestration, error propagation |
| `services/ranking-engine.test.ts` | Unit | Content ranking by relevance, custom scoring policies |
| `adapters/mock/mock-summarizer.test.ts` | Unit | Mock summarizer behavior, topic matching |

### Provider Package (`packages/provider/test/claude-agent-sdk/`)

| File | Category | Description |
|------|----------|-------------|
| `config.test.ts` | Unit | SDK configuration defaults, validation, API key handling |
| `schema-converter.test.ts` | Unit | Zod to JSON schema conversion for Claude API |
| `prompts.test.ts` | Unit | Prompt generation for summarize, ideas, outline |
| `error-mapper.test.ts` | Unit | SDK error to domain error mapping |
| `workspace.test.ts` | Unit | Workspace directory creation, path expansion |

### CLI App (`apps/cli/test/`)

| File | Category | Description |
|------|----------|-------------|
| `commands/summarize.test.ts` | Unit | Summarize command argument parsing, output formats |
| `commands/kit.test.ts` | Unit | Kit command options, topic parsing, tone validation |
| `e2e/cli.test.ts` | CLI E2E | Full CLI binary execution with `--mock` flag |

### Test Fixtures

**CLI Fixtures** (`apps/cli/test/fixtures/`):
- `sample-article.txt` - Standard article about AI agents
- `special-chars.txt` - Content with special characters

**Provider Fixtures** (`packages/provider/test/claude-agent-sdk/fixtures/`):
- `test-data.ts` - Shared test fixtures (testContent, testUser, testSummary, testIdeas)

**Docker E2E Fixtures** (`examples/`):
- `ai-healthcare.md` - Real-world article for API testing

---

## 3. Running Tests

### Quick Reference

```bash
# Run all tests (from project root)
bun test

# Run all tests with watch mode
bun test --watch

# Run tests for specific package
cd packages/core && bun test
cd packages/provider && bun test
cd apps/cli && bun run test  # Requires build first
```

### Package-Specific Commands

#### Core Package

```bash
cd packages/core

# Run all tests
bun test

# Watch mode
bun test --watch

# Run specific test file
bun test test/domain/validation.test.ts

# Run specific category
bun test test/services/
```

#### Provider Package

```bash
cd packages/provider

# Run all tests
bun test

# Watch mode
bun test --watch

# Run specific category
bun test test/claude-agent-sdk/
```

#### CLI App

```bash
cd apps/cli

# Run all tests (builds first)
bun run test

# Run unit tests only (no build)
bun test commands/

# Run e2e tests only (builds first)
bun run test:e2e

# Watch mode (no build)
bun test --watch
```

### Root-Level Commands

```bash
# Build all packages first (required for CLI tests)
bun run build

# Run all tests across monorepo
bun test

# Type check all packages
bun run check-types

# Lint all packages
bun run lint
```

---

## 4. Docker E2E Test Strategy

### 4.1 Overview

Docker E2E tests validate the complete system with **real Claude API calls** inside a Docker container. These tests:

1. Build the Docker image with production artifacts
2. Mount test fixtures and workspace volume
3. Execute CLI commands with real API calls
4. Evaluate output files for quality (schema + content + semantic)

### 4.2 Prerequisites

- Docker installed and running
- Valid Anthropic API key
- `.env` file with credentials (never commit this file)

### 4.3 Environment Setup

Create `.env` file at project root:

```bash
# .env (DO NOT commit this file)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
```

Verify `.env` is in `.gitignore`:
```bash
grep ".env" .gitignore
```

### 4.4 Docker Commands

#### Build

```bash
# Build all packages first
bun run build

# Build Docker image
docker build -t looplia:test .

# Verify image
docker images looplia:test
```

#### Run Tests Manually

```bash
# Create test workspace directory
mkdir -p ./test-workspace

# Run summarize command with real API
docker run --rm \
  --env-file .env \
  -v "$(pwd)/test-workspace:/home/looplia/.looplia" \
  -v "$(pwd)/examples:/examples:ro" \
  looplia:test \
  summarize --file /examples/ai-healthcare.md \
  --output /home/looplia/.looplia/summary.json

# Run kit command with real API
docker run --rm \
  --env-file .env \
  -v "$(pwd)/test-workspace:/home/looplia/.looplia" \
  -v "$(pwd)/examples:/examples:ro" \
  looplia:test \
  kit --file /examples/ai-healthcare.md \
  --topics "ai,healthcare,technology" \
  --tone "expert" \
  --word-count 1500 \
  --output /home/looplia/.looplia/kit.json
```

### 4.5 Workspace Output Evaluation

After running commands, the workspace contains:

```
test-workspace/
├── .claude/
│   ├── agents/           # Agent configurations
│   └── skills/           # Skill definitions
├── contentItem/
│   └── cli-{timestamp}/  # Session folder for each run
│       └── logs/
│           └── query-{timestamp}.log  # Query logs (v0.3.3)
├── CLAUDE.md             # Workspace instructions
├── user-profile.json     # User preferences
├── summary.json          # Summary output (if saved)
└── kit.json              # Kit output (if saved)
```

### 4.6 Full Evaluation Strategy

#### Level 1: Schema Validation

Check that required JSON fields exist:

```bash
# Validate summary schema
jq -e '
  .headline != null and
  .tldr != null and
  (.bullets | type) == "array" and
  (.tags | type) == "array" and
  .sentiment != null
' test-workspace/summary.json

# Validate kit schema
jq -e '
  .contentId != null and
  .summary != null and
  .ideas.hooks != null and
  .ideas.angles != null and
  .ideas.questions != null and
  (.suggestedOutline | type) == "array"
' test-workspace/kit.json
```

#### Level 2: Quality Metrics

Check content quality indicators:

```bash
# Check TLDR word count (should be 50-200 words)
TLDR_WORDS=$(jq -r '.tldr' test-workspace/summary.json | wc -w)
if [ "$TLDR_WORDS" -lt 50 ] || [ "$TLDR_WORDS" -gt 200 ]; then
  echo "TLDR word count out of range: $TLDR_WORDS"
  exit 1
fi

# Check bullets count (should be 3-7)
BULLET_COUNT=$(jq '.bullets | length' test-workspace/summary.json)
if [ "$BULLET_COUNT" -lt 3 ] || [ "$BULLET_COUNT" -gt 7 ]; then
  echo "Bullet count out of range: $BULLET_COUNT"
  exit 1
fi

# Check hooks count (should be >= 2)
HOOK_COUNT=$(jq '.ideas.hooks | length' test-workspace/kit.json)
if [ "$HOOK_COUNT" -lt 2 ]; then
  echo "Hook count too low: $HOOK_COUNT"
  exit 1
fi

# Check outline sections (should be >= 3)
SECTION_COUNT=$(jq '.suggestedOutline | length' test-workspace/kit.json)
if [ "$SECTION_COUNT" -lt 3 ]; then
  echo "Outline section count too low: $SECTION_COUNT"
  exit 1
fi
```

#### Level 3: LLM-Based Semantic Evaluation

Use Claude to evaluate output quality:

```bash
# Extract summary for evaluation
SUMMARY=$(cat test-workspace/summary.json)

# Use Claude API to evaluate (example with curl)
curl -X POST "https://api.anthropic.com/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 500,
    "messages": [{
      "role": "user",
      "content": "Evaluate this summary for quality. Score 1-10 and explain.\n\nSummary:\n'"$SUMMARY"'\n\nRespond with JSON: {\"score\": N, \"reasoning\": \"...\"}"
    }]
  }' | jq -e '.content[0].text | fromjson | .score >= 7'
```

### 4.7 Test Script

Create `scripts/docker-e2e.sh`:

```bash
#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="looplia:test"
WORKSPACE_DIR="./test-workspace"
EXAMPLES_DIR="./examples"
ENV_FILE=".env"

echo -e "${YELLOW}=== Looplia Docker E2E Test ===${NC}"

# Check prerequisites
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: $ENV_FILE not found${NC}"
  echo "Create .env with ANTHROPIC_API_KEY=sk-ant-api03-xxx"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo -e "${RED}Error: Docker is not installed${NC}"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is not installed${NC}"
  exit 1
fi

# Clean workspace
echo -e "${YELLOW}Cleaning test workspace...${NC}"
rm -rf "$WORKSPACE_DIR"
mkdir -p "$WORKSPACE_DIR"

# Build project
echo -e "${YELLOW}Building project...${NC}"
bun run build

# Build Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t "$IMAGE_NAME" .

# Test 1: Summarize command
echo -e "${YELLOW}Test 1: Running summarize command...${NC}"
docker run --rm \
  --env-file "$ENV_FILE" \
  -v "$(pwd)/$WORKSPACE_DIR:/home/looplia/.looplia" \
  -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
  "$IMAGE_NAME" \
  summarize --file /examples/ai-healthcare.md \
  --output /home/looplia/.looplia/summary.json

# Validate summary - Level 1: Schema
echo -e "${YELLOW}Validating summary schema...${NC}"
if jq -e '.headline and .tldr and .bullets' "$WORKSPACE_DIR/summary.json" > /dev/null; then
  echo -e "${GREEN}[PASS] Summary schema valid${NC}"
else
  echo -e "${RED}[FAIL] Summary schema invalid${NC}"
  exit 1
fi

# Validate summary - Level 2: Quality
echo -e "${YELLOW}Validating summary quality...${NC}"
TLDR_WORDS=$(jq -r '.tldr' "$WORKSPACE_DIR/summary.json" | wc -w | tr -d ' ')
BULLET_COUNT=$(jq '.bullets | length' "$WORKSPACE_DIR/summary.json")

echo "  TLDR words: $TLDR_WORDS (expected: 50-200)"
echo "  Bullet count: $BULLET_COUNT (expected: 3-7)"

if [ "$TLDR_WORDS" -ge 30 ] && [ "$BULLET_COUNT" -ge 3 ]; then
  echo -e "${GREEN}[PASS] Summary quality acceptable${NC}"
else
  echo -e "${YELLOW}[WARN] Summary quality below threshold${NC}"
fi

# Test 2: Kit command
echo -e "${YELLOW}Test 2: Running kit command...${NC}"
docker run --rm \
  --env-file "$ENV_FILE" \
  -v "$(pwd)/$WORKSPACE_DIR:/home/looplia/.looplia" \
  -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
  "$IMAGE_NAME" \
  kit --file /examples/ai-healthcare.md \
  --topics "ai,healthcare" \
  --output /home/looplia/.looplia/kit.json

# Validate kit - Level 1: Schema
echo -e "${YELLOW}Validating kit schema...${NC}"
if jq -e '.summary and .ideas and .suggestedOutline' "$WORKSPACE_DIR/kit.json" > /dev/null; then
  echo -e "${GREEN}[PASS] Kit schema valid${NC}"
else
  echo -e "${RED}[FAIL] Kit schema invalid${NC}"
  exit 1
fi

# Validate kit - Level 2: Quality
echo -e "${YELLOW}Validating kit quality...${NC}"
HOOK_COUNT=$(jq '.ideas.hooks | length' "$WORKSPACE_DIR/kit.json")
SECTION_COUNT=$(jq '.suggestedOutline | length' "$WORKSPACE_DIR/kit.json")

echo "  Hook count: $HOOK_COUNT (expected: >= 2)"
echo "  Outline sections: $SECTION_COUNT (expected: >= 3)"

if [ "$HOOK_COUNT" -ge 2 ] && [ "$SECTION_COUNT" -ge 3 ]; then
  echo -e "${GREEN}[PASS] Kit quality acceptable${NC}"
else
  echo -e "${YELLOW}[WARN] Kit quality below threshold${NC}"
fi

# Check workspace structure
echo -e "${YELLOW}Checking workspace structure...${NC}"
if [ -d "$WORKSPACE_DIR/contentItem" ]; then
  SESSION_COUNT=$(find "$WORKSPACE_DIR/contentItem" -maxdepth 1 -type d | wc -l)
  echo "  Sessions created: $((SESSION_COUNT - 1))"
  echo -e "${GREEN}[PASS] Workspace structure valid${NC}"
else
  echo -e "${YELLOW}[WARN] contentItem directory not found${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}=== All Docker E2E tests passed! ===${NC}"
echo ""
echo "Test artifacts saved to: $WORKSPACE_DIR/"
echo "  - summary.json"
echo "  - kit.json"
echo "  - contentItem/ (session data)"
```

Make executable:
```bash
chmod +x scripts/docker-e2e.sh
```

Run:
```bash
./scripts/docker-e2e.sh
```

### 4.8 GitHub Actions Workflow

Create `.github/workflows/docker-e2e.yml`:

```yaml
name: Docker E2E Tests

on:
  workflow_dispatch:  # Manual trigger
  push:
    branches: [main]  # Trigger on merge to main

env:
  IMAGE_NAME: looplia:test

jobs:
  docker-e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build project
        run: bun run build

      - name: Build Docker image
        run: docker build -t $IMAGE_NAME .

      - name: Create test workspace
        run: mkdir -p test-workspace

      - name: Run summarize command
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          docker run --rm \
            -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
            -v "$(pwd)/test-workspace:/home/looplia/.looplia" \
            -v "$(pwd)/examples:/examples:ro" \
            $IMAGE_NAME \
            summarize --file /examples/ai-healthcare.md \
            --output /home/looplia/.looplia/summary.json

      - name: Validate summary schema
        run: |
          jq -e '.headline and .tldr and .bullets' test-workspace/summary.json

      - name: Validate summary quality
        run: |
          TLDR_WORDS=$(jq -r '.tldr' test-workspace/summary.json | wc -w)
          BULLET_COUNT=$(jq '.bullets | length' test-workspace/summary.json)
          echo "TLDR words: $TLDR_WORDS"
          echo "Bullet count: $BULLET_COUNT"
          [ "$BULLET_COUNT" -ge 3 ]

      - name: Run kit command
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          docker run --rm \
            -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
            -v "$(pwd)/test-workspace:/home/looplia/.looplia" \
            -v "$(pwd)/examples:/examples:ro" \
            $IMAGE_NAME \
            kit --file /examples/ai-healthcare.md \
            --topics "ai,healthcare" \
            --output /home/looplia/.looplia/kit.json

      - name: Validate kit schema
        run: |
          jq -e '.summary and .ideas and .suggestedOutline' test-workspace/kit.json

      - name: Validate kit quality
        run: |
          HOOK_COUNT=$(jq '.ideas.hooks | length' test-workspace/kit.json)
          SECTION_COUNT=$(jq '.suggestedOutline | length' test-workspace/kit.json)
          echo "Hook count: $HOOK_COUNT"
          echo "Outline sections: $SECTION_COUNT"
          [ "$HOOK_COUNT" -ge 2 ] && [ "$SECTION_COUNT" -ge 3 ]

      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: docker-e2e-results
          path: test-workspace/
          retention-days: 7

  # Optional: LLM-based semantic evaluation
  semantic-evaluation:
    runs-on: ubuntu-latest
    needs: docker-e2e
    if: github.event_name == 'workflow_dispatch'  # Only on manual trigger

    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          name: docker-e2e-results
          path: test-workspace/

      - name: Evaluate summary quality with LLM
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          SUMMARY=$(cat test-workspace/summary.json)

          RESPONSE=$(curl -s -X POST "https://api.anthropic.com/v1/messages" \
            -H "Content-Type: application/json" \
            -H "x-api-key: $ANTHROPIC_API_KEY" \
            -H "anthropic-version: 2023-06-01" \
            -d '{
              "model": "claude-haiku-4-5-20251001",
              "max_tokens": 500,
              "messages": [{
                "role": "user",
                "content": "Evaluate this content summary for quality. Consider: accuracy, completeness, clarity, and usefulness. Score 1-10.\n\nSummary:\n'"$(echo "$SUMMARY" | jq -Rs .)"'\n\nRespond ONLY with JSON: {\"score\": N, \"reasoning\": \"brief explanation\"}"
              }]
            }')

          echo "LLM Evaluation Response:"
          echo "$RESPONSE" | jq '.content[0].text'

          SCORE=$(echo "$RESPONSE" | jq -r '.content[0].text' | jq -r '.score')
          echo "Quality Score: $SCORE/10"

          if [ "$SCORE" -lt 6 ]; then
            echo "Quality score below threshold (6)"
            exit 1
          fi
```

#### Required GitHub Secrets

Configure in repository Settings > Secrets and variables > Actions:
- `ANTHROPIC_API_KEY` - Your Anthropic API key

#### Cost Considerations

- **Estimated cost per run**: ~$0.02-0.10 USD
- **Recommended frequency**: On merge to main + manual trigger
- **Model used**: claude-haiku-4-5 (cost-effective)

---

## 5. Future Improvements

### Test Coverage Goals

| Package | Current | Target | Priority |
|---------|---------|--------|----------|
| `@looplia-core/core` | ~70% | 85% | High |
| `@looplia-core/provider` | ~60% | 80% | High |
| `@looplia-core/cli` | ~65% | 75% | Medium |

### Planned Additions

#### Short-term
- [ ] Add snapshot tests for prompt generation
- [ ] Add performance benchmarks for ranking engine
- [ ] Add retry logic tests for provider errors
- [ ] Add more example fixtures for diverse content types

#### Medium-term
- [ ] Add contract tests for provider interfaces
- [ ] Add load tests for concurrent kit generation
- [ ] Add mutation testing with Stryker
- [ ] Add visual regression tests for markdown output

#### Long-term
- [ ] Add chaos engineering tests (network failures)
- [ ] Add multi-language content tests
- [ ] Add accessibility tests for CLI output
- [ ] Add security scanning in CI

---

## 6. Troubleshooting

### Common Issues

#### CLI tests fail with "Cannot find module"

```bash
# Solution: Build first
cd apps/cli && bun run build && bun test
```

#### Docker tests fail with "permission denied"

```bash
# Solution: Check volume permissions
chmod -R 755 test-workspace
```

#### API tests fail with "Rate limit exceeded"

```bash
# Solution: Wait and retry, or use --mock flag for development
# The default model (claude-haiku-4-5) has high rate limits
```

#### Tests timeout in CI

```bash
# Solution: Increase timeout
bun test --timeout 30000
```

#### Docker image build fails

```bash
# Solution: Ensure build artifacts exist
bun run build
ls packages/core/dist/
ls packages/provider/dist/
ls apps/cli/dist/
```

#### API key not found in Docker

```bash
# Solution: Verify .env file and env-file flag
cat .env  # Should show ANTHROPIC_API_KEY=sk-ant-...
docker run --env-file .env ...  # Note: --env-file, not -e
```

---

*This test plan is maintained by the looplia-core team. For questions or updates, please open an issue on GitHub.*
