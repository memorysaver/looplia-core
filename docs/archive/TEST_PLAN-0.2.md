# Looplia-Core Test Plan

> **Version:** 0.2
> **Date:** December 2024
> **Test Framework:** Bun Test (`bun:test`)
> **Related:** [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) | [AGENTIC_CONCEPT-0.2.md](./AGENTIC_CONCEPT-0.2.md) | [GLOSSARY.md](./GLOSSARY.md)

This document describes the test architecture for Looplia-Core v0.4.0, aligned with Clean Architecture principles and the agentic design.

---

## Table of Contents

1. [Test Architecture Overview](#1-test-architecture-overview)
2. [Test Inventory](#2-test-inventory)
3. [Local Development & Husky](#3-local-development--husky)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Docker E2E Testing](#5-docker-e2e-testing)
6. [LLM-as-Judge Evaluation](#6-llm-as-judge-evaluation)
7. [Test Patterns & Best Practices](#7-test-patterns--best-practices)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Test Architecture Overview

### Test Pyramid

The test architecture follows the test pyramid pattern, aligned with Clean Architecture layers:

```
                    /\
                   /  \
                  /    \
                 / Docker\       ← Real API (LLM-as-Judge semantic evaluation)
                /   E2E   \
               /----------\
              /  CLI E2E   \     ← Binary execution (--mock flag)
             /--------------\
            /  Integration   \   ← Pipeline orchestration (mock providers)
           /------------------\
          /    Unit Tests      \ ← Isolated components (full mocking)
         /----------------------\
```

### Layer Mapping

| Test Category | Architecture Layer | Purpose | Speed |
|---------------|-------------------|---------|-------|
| **Unit** | Core, Provider | Individual functions/classes | ~ms |
| **Integration** | Core services | Pipeline orchestration | ~100ms |
| **CLI E2E** | CLI layer | Binary execution, I/O | ~1s |
| **Docker E2E** | Full stack | Real API, output quality | ~30-60s |

### Key Distinctions

- **Unit Tests**: Test isolated components with full mocking. Validates business logic, schema conversion, error mapping.

- **Integration Tests**: Test multiple services composing correctly (summarize → ideas → outline). Uses mock providers but tests real orchestration logic.

- **CLI E2E Tests**: Test the compiled CLI binary end-to-end with `--mock` flag. Validates argument parsing, file I/O, output formats, exit codes.

- **Docker E2E Tests**: Test the complete system with **real Claude API** inside Docker. Validates actual AI output quality, not just structure. Includes LLM-as-Judge semantic evaluation.

---

## 2. Test Inventory

### Summary

| Package | Test Files | Categories |
|---------|------------|------------|
| `apps/cli/test/` | 5 files | Unit + CLI E2E |
| `packages/core/test/` | 6 files | Unit + Integration |
| `packages/provider/test/` | 9 files | Unit |
| **Total** | **20 files** | |

### CLI Package (`apps/cli/test/`)

| File | Category | Description |
|------|----------|-------------|
| `e2e/cli.test.ts` | CLI E2E | Full CLI binary execution (global commands, summarize, kit) |
| `commands/summarize.test.ts` | Unit | Summarize command argument parsing, output formats |
| `commands/kit.test.ts` | Unit | Kit command options, topic parsing, tone validation |
| `components/streaming-query-ui.test.ts` | Unit | Streaming TUI components, activity ID generation |
| `utils/terminal.test.ts` | Unit | Terminal utilities (isInteractive, getTerminalSize, supportsColor) |

**Test Fixtures** (`apps/cli/test/fixtures/`):
- `sample-article.txt` - Standard article about AI agents
- `special-chars.txt` - Content with special characters
- `short-content.txt` - Minimal test content

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
| `persist-result.test.ts` | Unit | Result persistence, session relocation |
| `streaming/transformer.test.ts` | Unit | SDK message to StreamingEvent transformation |
| `streaming/query-executor.test.ts` | Unit | Query execution, API key validation |
| `utils/shared/content-id.test.ts` | Unit | Content ID extraction, security (path traversal prevention) |

**Test Fixtures** (`packages/provider/test/claude-agent-sdk/fixtures/`):
- `test-data.ts` - Shared fixtures (testContent, testUser, testSummary, testIdeas, createMockSdkResult, createMockSdkError, createTempWorkspace)

### Docker E2E Fixtures (`examples/`)

| File | Format | Purpose |
|------|--------|---------|
| `ai-healthcare.md` | Markdown with YAML frontmatter | Real-world article for API testing |
| `youtube/Anthropics/captions/EvtPBaaykdo.en.vtt` | WebVTT | YouTube caption file |
| `youtube/Anthropics/transcripts/CBneTpXF1CQ.srt` | SubRip | YouTube transcript |
| `youtube/Anthropics/transcripts/CBneTpXF1CQ.json` | Whisper JSON | Transcript with segments/tokens |

---

## 3. Local Development & Husky

### Pre-commit Workflow

The pre-commit hook (`.husky/pre-commit`) enforces quality gates before every commit:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRE-COMMIT WORKFLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

[1] TYPE CHECKING (Fast fail)
    │
    └─ turbo check-types
       ├─ @looplia-core/core: tsc --noEmit
       ├─ @looplia-core/provider: tsc --noEmit
       └─ @looplia-core/cli: tsc --noEmit
    │
    ▼
[2] RUN ALL TESTS
    │
    └─ bun test
       ├─ apps/cli/test/**/*.test.ts (184 tests)
       ├─ packages/core/test/**/*.test.ts
       └─ packages/provider/test/**/*.test.ts
    │
    ▼
[3] CODE FORMATTING (Ultracite/Biome)
    │
    ├─ git stash -q --keep-index (preserve unstaged)
    ├─ bun x ultracite fix (format staged files)
    ├─ git add -u (re-stage formatted files)
    └─ git stash pop -q (restore unstaged)
    │
    ▼
[4] COMMIT PROCEEDS
```

### Running Tests Locally

```bash
# Run all tests (from project root)
bun test

# Run all tests with watch mode
bun test --watch

# Run tests for specific package
cd packages/core && bun test
cd packages/provider && bun test
cd apps/cli && bun run test  # Requires build first

# Run specific test file
bun test test/streaming/transformer.test.ts

# Run specific category
bun test test/services/
```

### Package-Specific Commands

#### CLI App

```bash
cd apps/cli

# Run all tests (builds first)
bun run test

# Run unit tests only (no build)
bun test commands/

# Run E2E tests only (builds first)
bun run test:e2e

# Watch mode (no build)
bun test --watch
```

#### Core Package

```bash
cd packages/core

# Run all tests
bun test

# Watch mode
bun test --watch

# Run integration tests
bun test test/integration/
```

#### Provider Package

```bash
cd packages/provider

# Run all tests
bun test

# Run streaming tests
bun test test/claude-agent-sdk/streaming/
```

### Root-Level Commands

```bash
# Build all packages (required for CLI tests)
bun run build

# Type check all packages (via Turborepo)
bun run check-types

# Lint all packages (Ultracite/Biome)
bun x ultracite check
```

---

## 4. CI/CD Pipeline

### Main CI Workflow

**File:** `.github/workflows/ci.yml`
**Triggers:** Push to main, Pull requests to main

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CI WORKFLOW                                      │
│                    Triggers: push/PR to main                                │
└─────────────────────────────────────────────────────────────────────────────┘

[1] Setup
    ├─ actions/checkout@v4
    ├─ oven-sh/setup-bun@v2 (latest)
    └─ bun install --frozen-lockfile

[2] Build
    └─ bun run build

[3] Quality Checks
    ├─ Lint: bun x ultracite check
    └─ Type check: bun run check-types

[4] Tests
    └─ bun test (all packages, ~184 tests)

[5] Verify CLI
    └─ node apps/cli/dist/index.js --help
```

### Docker E2E Workflow

**File:** `.github/workflows/docker-e2e.yml`
**Triggers:** `workflow_dispatch` (manual), Push to main

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DOCKER E2E WORKFLOW                                   │
│              Triggers: workflow_dispatch, push to main                      │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │    build     │
                              │ Docker image │
                              │  (artifact)  │
                              └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
          ┌─────────────────┐ ┌───────────────┐ ┌─────────────┐
          │  test-markdown  │ │   test-vtt    │ │  test-srt   │
          │  ai-healthcare  │ │  VTT caption  │ │SRT transcript│
          │  summarize+kit  │ │  kit command  │ │ kit command │
          └────────┬────────┘ └───────┬───────┘ └──────┬──────┘
                   │                  │                │
                   │     PARALLEL     │     PARALLEL   │
                   └──────────────────┼────────────────┘
                                      ▼
                        ┌─────────────────────────┐
                        │  semantic-evaluation    │
                        │   (LLM-as-Judge)        │
                        │  workflow_dispatch only │
                        └─────────────────────────┘
```

### Job Details

| Job | Source | Commands | Validation |
|-----|--------|----------|------------|
| `build` | - | Build project, create Docker image | Upload artifact |
| `test-markdown` | `ai-healthcare.md` | `summarize` + `kit` | Schema + quality metrics |
| `test-vtt` | `EvtPBaaykdo.en.vtt` | `kit` | WritingKit schema |
| `test-srt` | `CBneTpXF1CQ.srt` | `kit` | WritingKit schema |
| `semantic-evaluation` | All 3 sources | Claude Code Action | LLM-as-Judge (12 pts) |

### Required Secrets

Configure in repository Settings > Secrets and variables > Actions:

| Secret | Purpose |
|--------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude Agent SDK and LLM evaluation |

### Claude Code Action Workflow

**File:** `.github/workflows/claude.yml`
**Triggers:** Issue/PR comments with `@claude`

This workflow enables AI-assisted code review and issue resolution via Claude Code Action.

---

## 5. Docker E2E Testing

### Overview

Docker E2E tests validate the complete system with **real Claude API calls** inside a Docker container. These tests:

1. Build the Docker image with production artifacts
2. Mount test fixtures and workspace volume
3. Execute CLI commands with real API calls
4. Evaluate output files for quality (schema + content + semantic)

### Dockerfile Architecture

```dockerfile
# Base image
FROM oven/bun:1.2-alpine

# Non-root user
USER looplia (uid 1001)

# Working directory
WORKDIR /app

# Production dependencies only
COPY docker.package.json package.json
RUN bun install --production

# Pre-built distributions
COPY packages/*/dist/ packages/*/
COPY apps/cli/dist/ apps/cli/

# Workspace mount point
VOLUME /home/looplia/.looplia
```

### Running Docker Tests Locally

#### Prerequisites

- Docker installed and running
- Valid `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`
- `.env` file with credentials (never commit)

#### Setup

```bash
# Create .env file
echo "ANTHROPIC_API_KEY=sk-ant-api03-xxx" > .env

# Verify .env is in .gitignore
grep ".env" .gitignore

# Build project
bun run build

# Build Docker image
docker build -t looplia:test .
```

#### Run Tests

```bash
# Create test workspace
mkdir -p ./test-workspace

# Run summarize command
docker run --rm \
  --env-file .env \
  -v "$(pwd)/test-workspace:/home/looplia/.looplia" \
  -v "$(pwd)/examples:/examples:ro" \
  looplia:test \
  summarize --file /examples/ai-healthcare.md \
  --output /home/looplia/.looplia/summary.json

# Run kit command
docker run --rm \
  --env-file .env \
  -v "$(pwd)/test-workspace:/home/looplia/.looplia" \
  -v "$(pwd)/examples:/examples:ro" \
  looplia:test \
  kit --file /examples/ai-healthcare.md \
  --topics "ai,healthcare" \
  --output /home/looplia/.looplia/kit.json
```

### Validation Levels

#### Level 1: Schema Validation

Verify JSON structure is correct:

```bash
# Summary schema
jq -e '.headline and .tldr and .bullets and .tags' summary.json

# Kit schema
jq -e '.contentId and .summary and .ideas and .suggestedOutline' kit.json
```

#### Level 2: Quality Metrics

Check content meets thresholds:

```bash
# TLDR word count (50-200 words)
TLDR_WORDS=$(jq -r '.tldr' summary.json | wc -w)
[ "$TLDR_WORDS" -ge 50 ] && [ "$TLDR_WORDS" -le 200 ]

# Bullet count (3-7)
BULLET_COUNT=$(jq '.bullets | length' summary.json)
[ "$BULLET_COUNT" -ge 3 ] && [ "$BULLET_COUNT" -le 7 ]

# Hooks count (>= 2)
HOOK_COUNT=$(jq '.ideas.hooks | length' kit.json)
[ "$HOOK_COUNT" -ge 2 ]

# Outline sections (>= 3)
SECTION_COUNT=$(jq '.suggestedOutline | length' kit.json)
[ "$SECTION_COUNT" -ge 3 ]
```

#### Level 3: Semantic Evaluation

LLM-as-Judge evaluation (see Section 6).

### Workspace Output Structure

After running commands, the workspace contains:

```
test-workspace/
├── .claude/
│   ├── agents/           # Agent configurations
│   └── skills/           # Skill definitions
├── contentItem/
│   └── {Session-ID}/     # Session folder
│       ├── content.md    # Input content
│       ├── summary.json  # Summary output
│       ├── ideas.json    # Ideas output
│       └── writing-kit.json # Final kit
├── CLAUDE.md             # Workspace instructions
├── user-profile.json     # User preferences
├── summary.json          # Output (if --output used)
└── kit.json              # Output (if --output used)
```

---

## 6. LLM-as-Judge Evaluation

### Overview

LLM-as-Judge is a technique where a language model evaluates AI-generated outputs. This approach validates semantic quality beyond structural correctness.

**Why use it?**
- Human evaluation is time-consuming and expensive
- Traditional metrics (ROUGE, BLEU) don't capture semantic quality
- LLM judges correlate with human judgment up to 85%

### Evaluation Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LLM-AS-JUDGE FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │  content.md  │
                              │ Ground Truth │
                              └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
          ┌─────────────────┐ ┌───────────────┐ ┌─────────────┐
          │ Summary (4 pts) │ │ Ideas (4 pts) │ │Outline(4pts)│
          │ - Accuracy      │ │ - Hooks       │ │ - Structure │
          │ - Completeness  │ │ - Angles      │ │ - Coverage  │
          │ - Clarity       │ │ - Questions   │ │ - Actionable│
          │ - Faithfulness  │ │ - Grounding   │ │ - Realistic │
          └────────┬────────┘ └───────┬───────┘ └──────┬──────┘
                   │                  │                │
                   └──────────────────┼────────────────┘
                                      ▼
                            ┌─────────────────┐
                            │  Total: X/12    │
                            │ PASS >= 9 (75%) │
                            └─────────────────┘
```

### Evaluation Criteria

#### Summary Evaluation (4 points)

| Criterion | Description | Points |
|-----------|-------------|--------|
| Accuracy | Key facts match source without fabrication | 1 |
| Completeness | All main themes captured in bullets | 1 |
| Clarity | Headline is concise and informative | 1 |
| Faithfulness | No hallucinated information | 1 |

#### Ideas Evaluation (4 points)

| Criterion | Description | Points |
|-----------|-------------|--------|
| Hooks | Engaging and varied hook types | 1 |
| Angles | Unique perspectives with relevance | 1 |
| Questions | Mix of philosophical and practical | 1 |
| Grounding | All ideas traceable to source | 1 |

#### Outline Evaluation (4 points)

| Criterion | Description | Points |
|-----------|-------------|--------|
| Structure | Logical flow and progression | 1 |
| Coverage | Main themes addressed | 1 |
| Actionable | Useful guidance in notes | 1 |
| Realistic | Reasonable word count estimates | 1 |

### Best Practices Applied

| Practice | Why | Implementation |
|----------|-----|----------------|
| Small integer scale | LLMs struggle with continuous ranges | 0/1 per criterion (max 4 per step) |
| Additive scoring | Breaking into atomic criteria improves accuracy | 4 criteria per step |
| Reasoning before score | Forces the model to "think" before judging | Evaluation text before final score |
| Ground truth reference | Reference content significantly improves accuracy | Always read content.md first |
| Source-grounded evaluation | Prevents hallucination in judgment | All evaluations traced to original |

### GitHub Action Integration

The semantic evaluation runs via Claude Code Action:

```yaml
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

### Example Evaluation Output

```
=== SOURCE CONTENT ===
File: contentItem/test-ai-healthcare/content.md
Title: The Future of AI in Healthcare
Sections: Diagnostic Revolution, Drug Discovery, Personalized Medicine

=== SUMMARY EVALUATION ===
- Accuracy: 1/1 - Key facts about 95% cancer detection correctly captured
- Completeness: 1/1 - All 5 main themes included in bullets
- Clarity: 1/1 - Headline is concise and informative
- Faithfulness: 1/1 - No hallucinated information
Score: 4/4

=== IDEAS EVALUATION ===
- Hooks: 1/1 - 5 varied hooks (curiosity, statistic, story)
- Angles: 1/1 - 5 unique perspectives with relevance scores 0.83-0.92
- Questions: 1/1 - Mix of philosophical and practical questions
- Grounding: 1/1 - All ideas traceable to source content
Score: 4/4

=== OUTLINE EVALUATION ===
- Structure: 1/1 - 7 logical sections with clear progression
- Coverage: 1/1 - Addresses diagnostics, drug discovery, personalized medicine
- Actionable: 1/1 - Notes provide specific guidance
- Realistic: 1/1 - Total ~2,800 words, reasonable estimates
Score: 4/4

=== FINAL RESULT ===
Total: 12/12
Status: PASS
```

### Cost Considerations

| Component | Estimated Cost |
|-----------|----------------|
| 3 Docker E2E tests | ~$0.15-0.60 USD |
| Semantic evaluation | ~$0.10-0.30 USD |
| **Total per run** | ~$0.25-0.90 USD |

**Recommended frequency:**
- On merge to main: Basic tests (schema + quality metrics)
- Manual trigger: Full evaluation with LLM-as-Judge

---

## 7. Test Patterns & Best Practices

### Mock Patterns

#### Bun Test Spying

```typescript
import { spyOn, afterEach } from "bun:test";

// Mock process.exit
const mockExit = spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

// Mock console.log
const spy = spyOn(console, "log").mockImplementation(() => {});

afterEach(() => {
  spy.mockClear();
  mockExit.mockRestore();
});
```

#### Mock Adapters (Core Package)

```typescript
import { createMockSummarizer } from "../adapters/mock/mock-summarizer";

const summarizer = createMockSummarizer();
const result = await summarizer.summarize(content, user);
```

#### Test Fixtures (Provider Package)

```typescript
import {
  testContent,
  testUser,
  testSummary,
  createMockSdkResult,
  createMockSdkError,
  createTempWorkspace,
} from "./fixtures/test-data";

// Create temp workspace for tests
const workspace = await createTempWorkspace();

// Mock successful SDK response
const result = createMockSdkResult(testSummary);

// Mock error SDK response
const error = createMockSdkError("rate_limit", "Too many requests");
```

### Testing StreamingEvents

The transformer converts SDK messages to StreamingEvents:

```typescript
import { createTransformContext, transformSdkMessage } from "./transformer";

describe("transformSdkMessage", () => {
  it("should transform tool_use to tool_start event", () => {
    const context = createTransformContext();
    const sdkMessage = {
      type: "assistant",
      content: [{
        type: "tool_use",
        id: "tool-123",
        name: "Read",
        input: { path: "/test/file.md" }
      }]
    };

    const events = transformSdkMessage(sdkMessage, context);

    expect(events).toContainEqual({
      type: "tool_start",
      toolUseId: "tool-123",
      tool: "Read",
      input: { path: "/test/file.md" },
      timestamp: expect.any(Number)
    });
  });
});
```

### Security Testing

The `content-id.test.ts` validates security measures:

```typescript
describe("path traversal prevention", () => {
  it("should reject path traversal attempts", () => {
    const result = extractContentIdFromPrompt("contentItem/../../../etc/passwd");
    expect(result).toBeNull();
  });

  it("should reject URL-encoded path traversal", () => {
    const result = extractContentIdFromPrompt("contentItem/%2e%2e%2f%2e%2e%2f");
    expect(result).toBeNull();
  });

  it("should reject null bytes", () => {
    const result = extractContentIdFromPrompt("contentItem/test%00.json");
    expect(result).toBeNull();
  });
});
```

### Test Organization

```typescript
describe("Feature Name", () => {
  // Setup shared fixtures
  let workspace: string;

  beforeEach(async () => {
    workspace = await createTempWorkspace();
  });

  afterEach(async () => {
    await cleanup(workspace);
  });

  describe("sub-feature", () => {
    it("should do something specific", async () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = await functionUnderTest(input);

      // Assert
      expect(result).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
    });
  });
});
```

---

## 8. Troubleshooting

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
# Solution: Use --mock flag for development
looplia kit --file article.md --mock
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

#### Pre-commit hook fails

```bash
# Solution: Run checks manually to identify issue
bun run check-types  # Check for type errors
bun test             # Check for test failures
bun x ultracite check  # Check for lint errors
```

### Debugging Tips

1. **Verbose test output:**
   ```bash
   bun test --verbose
   ```

2. **Run single test:**
   ```bash
   bun test --grep "should transform tool_use"
   ```

3. **Check streaming events:**
   ```bash
   DEBUG=looplia:* looplia kit --file article.md
   ```

4. **Inspect Docker workspace:**
   ```bash
   docker run -it --entrypoint sh looplia:test
   ls -la /home/looplia/.looplia/
   ```

---

## Cross-References

- **Architecture**: [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) - Folder structure, command framework
- **Agent System**: [AGENTIC_CONCEPT-0.2.md](./AGENTIC_CONCEPT-0.2.md) - Execution cycle, call stack
- **Terminology**: [GLOSSARY.md](./GLOSSARY.md) - Ubiquitous language reference
- **Skills**: [AGENT-SKILLS.md](./AGENT-SKILLS.md) - Anthropic SDK reference

---

## References

- [Hugging Face: Using LLM-as-a-judge](https://huggingface.co/learn/cookbook/en/llm_judge)
- [Monte Carlo: LLM-As-Judge Templates](https://www.montecarlodata.com/blog-llm-as-judge/)
- [Evidently AI: LLM-as-a-judge Guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [Agenta: LLM as a Judge Guide](https://agenta.ai/blog/llm-as-a-judge-guide-to-llm-evaluation-best-practices)

---

*This test plan is maintained by the Looplia-Core team for v0.4.0.*
