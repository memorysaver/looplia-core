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
- `ai-healthcare.md` - Real-world article for API testing (markdown with YAML frontmatter)
- `youtube/Anthropics/captions/EvtPBaaykdo.en.vtt` - YouTube VTT caption file (WebVTT format)
- `youtube/Anthropics/transcripts/CBneTpXF1CQ.srt` - YouTube SRT transcript (SubRip format)
- `youtube/Anthropics/transcripts/CBneTpXF1CQ.json` - Whisper JSON transcript (with segments/tokens)

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

#### Multi-Source Type Testing

The agent autonomously detects and processes different source types. E2E tests verify this capability across:

| Source Type | Format | Test File | Detection |
|-------------|--------|-----------|-----------|
| Markdown | `.md` with YAML frontmatter | `ai-healthcare.md` | `article` |
| VTT Caption | WebVTT subtitle format | `EvtPBaaykdo.en.vtt` | `youtube` or `transcript` |
| SRT Transcript | SubRip format with timing | `CBneTpXF1CQ.srt` | `youtube` or `transcript` |
| JSON Transcript | Whisper output with segments | `CBneTpXF1CQ.json` | `youtube` or `transcript` |

The `content-analyzer` subagent uses clues like timestamps, speaker markers, and format structure to detect the source type automatically (see `CLAUDE.md` for detection rules).

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

Uses Claude Code Action to evaluate the entire pipeline against the source content. This is triggered only on manual workflow dispatch.

##### LLM-as-a-Judge: Concept and Best Practices

**What is LLM-as-a-Judge?**

LLM-as-a-Judge is a technique where a language model evaluates the outputs of another AI system. This approach was introduced in [Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://huggingface.co/papers/2306.05685) and has become a standard practice for evaluating AI-generated content when traditional metrics (ROUGE, BLEU) are insufficient.

**Why use it?**
- Human evaluation is time-consuming and expensive
- Traditional metrics don't capture semantic quality
- LLM judges can correlate with human judgment up to 85% (higher than human-to-human agreement at 81%)

##### Best Practices We Follow

Based on research from [Hugging Face](https://huggingface.co/learn/cookbook/en/llm_judge), [Monte Carlo](https://www.montecarlodata.com/blog-llm-as-judge/), and [Evidently AI](https://www.evidentlyai.com/llm-guide/llm-as-a-judge):

| Practice | Why | Our Implementation |
|----------|-----|-------------------|
| **Small integer scale (1-4)** | LLMs struggle with continuous ranges; discrete scores are more reliable | 0/1 per criterion, max 4 per step |
| **Additive scoring** | Breaking into atomic criteria improves accuracy | 4 criteria per step (Summary, Ideas, Outline) |
| **Require reasoning before score** | Forces the model to "think" before judging | Evaluation section printed before final score |
| **Provide ground truth** | Reference content significantly improves accuracy | Always read `content.md` first as source of truth |
| **Source-grounded evaluation** | Prevents hallucination in judgment | All evaluations traced back to original content |
| **Clear rubric** | Explicit criteria reduce ambiguity | Each criterion has specific definition |

##### Our Evaluation Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    GROUND TRUTH                             │
│                   content.md                                │
│            (Original source content)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Summary Evaluation (4 pts)                        │
│  ├─ Accuracy: Facts match source? (1 pt)                   │
│  ├─ Completeness: All themes captured? (1 pt)              │
│  ├─ Clarity: Well-written? (1 pt)                          │
│  └─ Faithfulness: No hallucination? (1 pt)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Ideas Evaluation (4 pts)                          │
│  ├─ Hooks: Engaging & varied? (1 pt)                       │
│  ├─ Angles: Unique perspectives? (1 pt)                    │
│  ├─ Questions: Thought-provoking? (1 pt)                   │
│  └─ Grounding: Traceable to source? (1 pt)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Outline Evaluation (4 pts)                        │
│  ├─ Structure: Logical flow? (1 pt)                        │
│  ├─ Coverage: Main themes addressed? (1 pt)                │
│  ├─ Actionable: Useful guidance? (1 pt)                    │
│  └─ Realistic: Reasonable word counts? (1 pt)              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  FINAL SCORE: X/12                                         │
│  PASS: >= 9 (75%)  |  FAIL: < 9                           │
└─────────────────────────────────────────────────────────────┘
```

##### References

- [Hugging Face: Using LLM-as-a-judge](https://huggingface.co/learn/cookbook/en/llm_judge) - Shows 30% improvement with structured prompts
- [Monte Carlo: LLM-As-Judge Templates](https://www.montecarlodata.com/blog-llm-as-judge/) - Evaluation templates for relevance, task completion
- [Evidently AI: LLM-as-a-judge Guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge) - Comprehensive best practices
- [Agenta: LLM as a Judge Guide](https://agenta.ai/blog/llm-as-a-judge-guide-to-llm-evaluation-best-practices) - Temperature and few-shot guidance
- [Towards Data Science: LLM-as-a-Judge Practical Guide](https://towardsdatascience.com/llm-as-a-judge-a-practical-guide/) - Implementation patterns

**Evaluation Flow:**
1. Read the original source content (`contentItem/*/content.md`)
2. Evaluate each pipeline step against the source

**Pipeline Output Structure:**
```
test-workspace/contentItem/{sessionId}/
├── content.md        ← Original source (ground truth)
├── summary.json      ← Step 1: Content analysis
├── ideas.json        ← Step 2: Idea generation
├── outline.json      ← Step 3: Article outline
└── writing-kit.json  ← Final assembled kit
```

**Evaluation Criteria (Additive Scoring):**

| Step | Criteria | Points |
|------|----------|--------|
| **Summary** | Accuracy, Completeness, Clarity, Faithfulness | 4 pts |
| **Ideas** | Hooks, Angles, Questions, Grounding | 4 pts |
| **Outline** | Structure, Coverage, Actionable, Realistic | 4 pts |
| **Total** | | **12 pts** |

**Pass Threshold:** 9/12 (75%)

**Example Output:**
```
=== SOURCE CONTENT ===
File: test-workspace/contentItem/test-ai-healthcare/content.md
Title: The Future of AI in Healthcare
Sections: Diagnostic Revolution, Drug Discovery, Personalized Medicine, Challenges, Path Forward

=== SUMMARY EVALUATION ===
- Accuracy: 1/1 - Key facts about 95% cancer detection accuracy correctly captured
- Completeness: 1/1 - All 5 main themes included in bullets
- Clarity: 1/1 - Headline is concise and informative
- Faithfulness: 1/1 - No hallucinated information
Score: 4/4

=== IDEAS EVALUATION ===
- Hooks: 1/1 - 5 varied hooks (curiosity, statistic, story, controversy, emotional)
- Angles: 1/1 - 5 unique perspectives with relevance scores 0.83-0.92
- Questions: 1/1 - Mix of philosophical, analytical, and practical questions
- Grounding: 1/1 - All ideas traceable to source content
Score: 4/4

=== OUTLINE EVALUATION ===
- Structure: 1/1 - 7 logical sections with clear progression
- Coverage: 1/1 - Addresses diagnostics, drug discovery, personalized medicine, challenges
- Actionable: 1/1 - Notes provide specific guidance for each section
- Realistic: 1/1 - Total ~2,800 words, reasonable estimates
Score: 4/4

=== FINAL RESULT ===
Total: 12/12
Status: PASS
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

The workflow uses a parallel execution strategy with 4 jobs:

```
┌─────────────────────────────────────────────────────────────┐
│                        build                                 │
│         (Build Docker image, save as artifact)              │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│test-markdown│  │ test-vtt  │  │ test-srt  │   ← Run in PARALLEL
│(summarize  │  │  (kit)    │  │  (kit)    │
│  + kit)    │  │           │  │           │
└─────┬──────┘  └─────┬─────┘  └─────┬─────┘
      │               │               │
      └───────────────┼───────────────┘
                      ▼
        ┌─────────────────────────┐
        │  semantic-evaluation    │  ← Manual trigger only
        │  (LLM-as-Judge)         │
        └─────────────────────────┘
```

#### Job Details

| Job | Source Type | Commands | Validation |
|-----|-------------|----------|------------|
| `test-markdown` | `ai-healthcare.md` | `summarize` + `kit` | Schema + quality metrics |
| `test-vtt` | `EvtPBaaykdo.en.vtt` | `kit` | WritingKit schema + hooks/outline |
| `test-srt` | `CBneTpXF1CQ.srt` | `kit` | WritingKit schema + hooks/outline |
| `semantic-evaluation` | All 3 sources | Claude Code Action | LLM-as-Judge (4 criteria × 3 sources) |

#### Artifact Structure

Each test job uploads its results to a separate artifact:

```
test-results-markdown/
├── summary.json
├── kit.json
└── contentItem/{sessionId}/...

test-results-vtt/
└── contentItem/{sessionId}/
    ├── content.md
    └── writing-kit.json

test-results-srt/
└── contentItem/{sessionId}/
    ├── content.md
    └── writing-kit.json
```

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
  # Build Docker image once and share with all test jobs
  build:
    runs-on: ubuntu-latest
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

      - name: Save Docker image
        run: docker save $IMAGE_NAME | gzip > looplia-image.tar.gz

      - name: Upload Docker image
        uses: actions/upload-artifact@v4
        with:
          name: docker-image
          path: looplia-image.tar.gz
          retention-days: 1

  # Test 1: Markdown (summarize + kit)
  test-markdown:
    runs-on: ubuntu-latest
    needs: build
    timeout-minutes: 30
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download Docker image
        uses: actions/download-artifact@v4
        with:
          name: docker-image

      - name: Load Docker image
        run: gunzip -c looplia-image.tar.gz | docker load

      - name: Run summarize command
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
        run: |
          CONTAINER_ID=$(docker create \
            -e CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" \
            -v "$(pwd)/examples:/examples:ro" \
            $IMAGE_NAME \
            summarize --file /examples/ai-healthcare.md \
            --output /home/looplia/.looplia/summary.json)
          docker start -a "$CONTAINER_ID"
          docker cp "$CONTAINER_ID:/home/looplia/.looplia/." test-workspace-markdown/
          docker rm "$CONTAINER_ID"

      - name: Run kit command
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
        run: |
          CONTAINER_ID=$(docker create \
            -e CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" \
            -v "$(pwd)/examples:/examples:ro" \
            $IMAGE_NAME \
            kit --file /examples/ai-healthcare.md \
            --topics "ai,healthcare,technology" \
            --tone "expert" \
            --output /home/looplia/.looplia/kit.json)
          docker start -a "$CONTAINER_ID"
          docker cp "$CONTAINER_ID:/home/looplia/.looplia/." test-workspace-markdown/
          docker rm "$CONTAINER_ID"

      - name: Validate outputs
        run: |
          jq -e '.headline and .tldr and .bullets and .tags' test-workspace-markdown/summary.json
          jq -e '.contentId and .summary and .ideas and .suggestedOutline' test-workspace-markdown/kit.json
          HOOK_COUNT=$(jq '.ideas.hooks | length' test-workspace-markdown/kit.json)
          SECTION_COUNT=$(jq '.suggestedOutline | length' test-workspace-markdown/kit.json)
          [ "$HOOK_COUNT" -ge 2 ] && [ "$SECTION_COUNT" -ge 3 ]

      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-markdown
          path: test-workspace-markdown/

  # Test 2: VTT Caption (kit command)
  test-vtt:
    runs-on: ubuntu-latest
    needs: build
    timeout-minutes: 30
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download Docker image
        uses: actions/download-artifact@v4
        with:
          name: docker-image

      - name: Load Docker image
        run: gunzip -c looplia-image.tar.gz | docker load

      - name: Run kit on VTT caption
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
        run: |
          CONTAINER_ID=$(docker create \
            -e CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" \
            -v "$(pwd)/examples:/examples:ro" \
            $IMAGE_NAME \
            kit --file /examples/youtube/Anthropics/captions/EvtPBaaykdo.en.vtt \
            --topics "ai,claude,developer-tools" \
            --tone "expert")
          docker start -a "$CONTAINER_ID"
          docker cp "$CONTAINER_ID:/home/looplia/.looplia/." test-workspace-vtt/
          docker rm "$CONTAINER_ID"

      - name: Validate VTT kit
        run: |
          SESSION_DIR=$(find test-workspace-vtt/contentItem -maxdepth 1 -type d ! -name contentItem | head -1)
          jq -e '.contentId and .summary and .ideas and .suggestedOutline' "$SESSION_DIR/writing-kit.json"
          HOOK_COUNT=$(jq '.ideas.hooks | length' "$SESSION_DIR/writing-kit.json")
          SECTION_COUNT=$(jq '.suggestedOutline | length' "$SESSION_DIR/writing-kit.json")
          [ "$HOOK_COUNT" -ge 2 ] && [ "$SECTION_COUNT" -ge 3 ]

      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-vtt
          path: test-workspace-vtt/

  # Test 3: SRT Transcript (kit command)
  test-srt:
    runs-on: ubuntu-latest
    needs: build
    timeout-minutes: 30
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download Docker image
        uses: actions/download-artifact@v4
        with:
          name: docker-image

      - name: Load Docker image
        run: gunzip -c looplia-image.tar.gz | docker load

      - name: Run kit on SRT transcript
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
        run: |
          CONTAINER_ID=$(docker create \
            -e CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" \
            -v "$(pwd)/examples:/examples:ro" \
            $IMAGE_NAME \
            kit --file /examples/youtube/Anthropics/transcripts/CBneTpXF1CQ.srt \
            --topics "coding,claude,automation" \
            --tone "expert")
          docker start -a "$CONTAINER_ID"
          docker cp "$CONTAINER_ID:/home/looplia/.looplia/." test-workspace-srt/
          docker rm "$CONTAINER_ID"

      - name: Validate SRT kit
        run: |
          SESSION_DIR=$(find test-workspace-srt/contentItem -maxdepth 1 -type d ! -name contentItem | head -1)
          jq -e '.contentId and .summary and .ideas and .suggestedOutline' "$SESSION_DIR/writing-kit.json"
          HOOK_COUNT=$(jq '.ideas.hooks | length' "$SESSION_DIR/writing-kit.json")
          SECTION_COUNT=$(jq '.suggestedOutline | length' "$SESSION_DIR/writing-kit.json")
          [ "$HOOK_COUNT" -ge 2 ] && [ "$SECTION_COUNT" -ge 3 ]

      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-srt
          path: test-workspace-srt/

  # LLM-based semantic evaluation (manual trigger only)
  semantic-evaluation:
    runs-on: ubuntu-latest
    needs: [test-markdown, test-vtt, test-srt]
    if: github.event_name == 'workflow_dispatch'
    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: test-workspace/

      - name: Evaluate pipeline outputs with Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          prompt: |
            Evaluate WritingKit outputs from 3 source types.

            Criteria (1 pt each): Accuracy, Completeness, Ideas Quality, Outline Quality

            Sources:
            - Markdown: test-workspace/test-results-markdown/
            - VTT: test-workspace/test-results-vtt/contentItem/*/writing-kit.json
            - SRT: test-workspace/test-results-srt/contentItem/*/writing-kit.json

            Total: X/12. PASS if >= 9, FAIL if < 9.
```

#### Required GitHub Secrets

Configure in repository Settings > Secrets and variables > Actions:
- `CLAUDE_CODE_OAUTH_TOKEN` - OAuth token for Claude Code (used for both Docker commands and LLM evaluation via Claude Agent SDK)

#### Cost Considerations

- **Estimated cost per run**: ~$0.15-0.60 USD (3 parallel Docker E2E tests) + ~$0.10-0.30 USD (semantic evaluation)
- **Recommended frequency**: On merge to main (basic tests) + manual trigger (with semantic evaluation)
- **Models used**:
  - Docker commands: claude-sonnet-4-5 (via Claude Agent SDK)
  - Semantic evaluation: Claude Code Action (full model)
- **Parallel execution**: 3 test jobs run simultaneously after build, reducing total CI time

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
