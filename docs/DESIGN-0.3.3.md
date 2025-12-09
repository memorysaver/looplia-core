# Looplia Core – Technical Design Document v0.3.3

**Version:** 0.3.3
**Status:** Implemented
**Last Updated:** 2025-12-09

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Feature 1: QueryLogger Component](#3-feature-1-querylogger-component)
4. [Feature 2: Docker Image](#4-feature-2-docker-image)
5. [Implementation Details](#5-implementation-details)
6. [File Changes](#6-file-changes)
7. [Usage Guide](#7-usage-guide)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. Overview

### 1.1 Purpose

v0.3.3 adds operational infrastructure improvements:

- **QueryLogger Component** - Unique log file per SDK query (no overwrites)
- **Slim Docker Image** - 343MB runtime image for containerized deployments
- **CLI Enhancement** - Non-interactive bootstrap for automation

### 1.2 Key Changes from v0.3.2

| Aspect | v0.3.2 | v0.3.3 |
|--------|--------|--------|
| **Logging** | Single `sdk-debug.log` (overwrites) | Per-query log files in `logs/` folder |
| **Docker** | None | 343MB Alpine-based image |
| **Bootstrap** | Interactive confirmation required | `--yes` flag for automation |
| **Log Location** | `contentItem/{id}/sdk-debug.log` | `contentItem/{id}/logs/query-{timestamp}.log` |

### 1.3 Design Principles

1. **One Query = One Log** - Each SDK query creates unique log file
2. **Never Overwrite** - All log files preserved for debugging
3. **Build Outside Docker** - Pre-built artifacts copied into minimal runtime image
4. **Non-Interactive Support** - CLI supports automation via `--yes` flag

---

## 2. Problem Statement

### 2.1 Logging Issues in v0.3.2

The previous logging implementation in `query-wrapper.ts` had these problems:

```typescript
// OLD: Always writes to same file
debugLogPath = join(workspace, "contentItem", contentId, "sdk-debug.log");
initDebugLog(debugLogPath);  // Overwrites existing file!
```

**Problems:**
1. Multi-query sessions overwrite each other's logs
2. Can't debug interrupted sessions (previous log lost)
3. No timestamp differentiation between queries

### 2.2 Deployment Issues

No containerization support meant:
- Difficult cloud deployments
- No reproducible test environments
- Complex local setup for new users

### 2.3 Automation Issues

Bootstrap command required interactive confirmation:
```bash
looplia bootstrap
# Prompts: "Continue? (y/N)"  -- Blocks automation!
```

---

## 3. Feature 1: QueryLogger Component

### 3.1 Design Goals

| Goal | Implementation |
|------|----------------|
| Unique per query | Timestamp-based filename |
| Never overwrite | Create new file each time |
| Reusable | Extracted to separate component |
| Same format | JSON messages with timestamps |

### 3.2 Log File Location

```
contentItem/{contentId}/
├── content.md
├── summary.json
├── ideas.json
├── writing-kit.json
└── logs/                          # NEW: Logs subdirectory
    ├── query-2025-12-09T10-30-00-000Z.log
    ├── query-2025-12-09T10-35-22-123Z.log
    └── query-2025-12-09T10-40-15-456Z.log
```

### 3.3 QueryLogger Interface

```typescript
type QueryLogger = {
  /**
   * Initialize a new log file for this query
   * @param contentId - Content ID from prompt (for folder location)
   * @returns Log file path
   */
  init(contentId: string): string;

  /**
   * Log a message from SDK
   * @param message - SDK message object
   */
  log(message: Record<string, unknown>): void;

  /**
   * Close the logger (no-op, but included for interface completeness)
   */
  close(): void;

  /**
   * Get the current log file path
   */
  getLogPath(): string | null;
};

function createQueryLogger(workspace: string): QueryLogger;
```

### 3.4 Log File Format

```
Agent SDK Execution Log - 2025-12-09T10:30:00.000Z
============================================================

[2025-12-09T10:30:00.123Z] {"type": "prompt", "content": "Task: Build WritingKit..."}

[2025-12-09T10:30:01.456Z] {"type": "assistant", "content": "..."}

[2025-12-09T10:30:05.789Z] {"type": "result", "subtype": "success", ...}
```

### 3.5 Integration with query-wrapper.ts

```typescript
// NEW: Using QueryLogger
const logger = createQueryLogger(workspace);
if (contentId) {
  logger.init(contentId);
  logger.log({ type: "prompt", content: prompt });
}

for await (const message of result) {
  if (contentId) {
    logger.log(message);  // Log every SDK message
  }

  if (message.type === "result") {
    logger.close();
    return processResultMessage(message, usage);
  }
}

logger.close();
```

---

## 4. Feature 2: Docker Image

### 4.1 Design Goals

| Goal | Target | Achieved |
|------|--------|----------|
| Image size | <350MB | 343MB ✓ |
| Runtime only | No dev deps | ✓ |
| Auto-bootstrap | First run setup | ✓ |
| Non-root user | Security | ✓ |

### 4.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BUILD WORKFLOW                                                             │
│                                                                             │
│  Local Machine                          Docker Image                        │
│  ─────────────                          ─────────────                       │
│  bun run build                                                              │
│    │                                                                        │
│    ├── packages/core/dist/      ──────►  /app/packages/core/dist/           │
│    ├── packages/provider/dist/  ──────►  /app/packages/provider/dist/       │
│    └── apps/cli/dist/           ──────►  /app/apps/cli/dist/                │
│                                                                             │
│  docker.package.json            ──────►  /app/package.json                  │
│  (no workspace refs)                     │                                  │
│                                          ▼                                  │
│                                    bun install --production                 │
│                                          │                                  │
│                                          ▼                                  │
│                                    343MB runtime image                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Workspace Reference Problem

**Problem:** Bun workspace `workspace:*` references don't work outside monorepo.

```json
// packages/provider/package.json - WON'T WORK IN DOCKER
{
  "dependencies": {
    "@looplia-core/core": "workspace:*"  // Fails!
  }
}
```

**Solution:** Docker-specific package.json files with `file:` references.

```json
// packages/provider/docker.package.json - WORKS IN DOCKER
{
  "dependencies": {
    "@looplia-core/core": "file:../core"  // Works!
  }
}
```

### 4.4 Docker Files

#### Dockerfile

```dockerfile
# Minimal runtime image - requires pre-built artifacts
# Usage: bun run build && docker build -t looplia .
FROM oven/bun:1.2-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S looplia && \
    adduser -S looplia -u 1001 -G looplia

# Copy pre-built artifacts with docker-specific package.json
COPY packages/core/dist ./packages/core/dist
COPY packages/core/docker.package.json ./packages/core/package.json
COPY packages/provider/dist ./packages/provider/dist
COPY packages/provider/docker.package.json ./packages/provider/package.json
COPY apps/cli/dist ./apps/cli/dist
COPY apps/cli/docker.package.json ./apps/cli/package.json
COPY plugins ./plugins

# Copy minimal package.json for Docker (no workspace refs)
COPY docker.package.json ./package.json

# Install production runtime dependencies
RUN bun install --production

# Copy entrypoint
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/

# Set ownership and switch user
RUN chown -R looplia:looplia /app
USER looplia
RUN mkdir -p /home/looplia/.looplia

ENV NODE_ENV=production
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["--help"]
```

#### docker-entrypoint.sh

```bash
#!/bin/sh
set -e

# Auto-bootstrap if workspace not initialized
if [ ! -f "$HOME/.looplia/CLAUDE.md" ]; then
  echo "Initializing looplia workspace..."
  # Use --yes to skip confirmation prompt
  bun run /app/apps/cli/dist/index.js bootstrap --yes
fi

# Run the CLI with provided arguments
exec bun run /app/apps/cli/dist/index.js "$@"
```

#### docker.package.json (root)

```json
{
  "name": "looplia-docker",
  "private": true,
  "type": "module",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.60",
    "@looplia-core/core": "file:./packages/core",
    "@looplia-core/provider": "file:./packages/provider",
    "zod": "^3.24.2",
    "commander": "^13.1.0",
    "chalk": "^5.4.1"
  }
}
```

### 4.5 Image Size Breakdown

| Component | Size |
|-----------|------|
| Base (oven/bun:1.2-alpine) | ~140MB |
| Production node_modules | ~180MB |
| Built dist files | ~1MB |
| Plugins | ~50KB |
| **Total** | **343MB** |

---

## 5. Implementation Details

### 5.1 CLI Enhancement: Bootstrap --yes Flag

```typescript
// apps/cli/src/commands/bootstrap.ts

export async function runBootstrapCommand(args: string[]): Promise<void> {
  // Check for --yes or -y flag to skip confirmation
  const skipConfirmation = args.includes("--yes") || args.includes("-y");

  console.log("⚠️  Bootstrap will DELETE ~/.looplia/ and recreate...");

  let confirmed = skipConfirmation;
  if (!skipConfirmation) {
    confirmed = await promptConfirmation("Continue?");
  }

  if (!confirmed) {
    console.log("Aborted.");
    return;
  }

  await ensureWorkspace({ force: true });
  // ...
}
```

### 5.2 Logger Component Structure

```
packages/provider/src/claude-agent-sdk/
├── logger/
│   ├── index.ts              # Export createQueryLogger, QueryLogger
│   └── query-logger.ts       # Implementation
├── utils/
│   └── query-wrapper.ts      # Uses QueryLogger
└── index.ts                  # Exports logger module
```

---

## 6. File Changes

### 6.1 New Files

| File | Purpose |
|------|---------|
| `packages/provider/src/claude-agent-sdk/logger/query-logger.ts` | QueryLogger implementation |
| `packages/provider/src/claude-agent-sdk/logger/index.ts` | Logger module exports |
| `Dockerfile` | Docker image definition |
| `docker.package.json` | Root deps for Docker |
| `docker-entrypoint.sh` | Auto-bootstrap script |
| `.dockerignore` | Exclude unnecessary files |
| `packages/core/docker.package.json` | Core deps for Docker |
| `packages/provider/docker.package.json` | Provider deps for Docker |
| `apps/cli/docker.package.json` | CLI deps for Docker |
| `docs/DESIGN-0.3.3.md` | This document |

### 6.2 Modified Files

| File | Changes |
|------|---------|
| `packages/provider/src/claude-agent-sdk/utils/query-wrapper.ts` | Use QueryLogger instead of inline logging |
| `packages/provider/src/claude-agent-sdk/index.ts` | Export logger module |
| `apps/cli/src/commands/bootstrap.ts` | Add `--yes` flag support |
| `apps/cli/src/index.ts` | Update VERSION to "0.3.3" |
| `packages/*/package.json` | Bump version to 0.3.3 |

---

## 7. Usage Guide

### 7.1 Local Development

```bash
# Build all packages
bun run build

# Run CLI
bun run apps/cli/dist/index.js --version
# Output: looplia 0.3.3

# Bootstrap workspace (interactive)
bun run apps/cli/dist/index.js bootstrap

# Bootstrap workspace (non-interactive)
bun run apps/cli/dist/index.js bootstrap --yes
```

### 7.2 Docker Usage

```bash
# Step 1: Build locally first
bun run build

# Step 2: Build Docker image
docker build -t looplia:0.3.3 .

# Step 3: Run with API key
docker run -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
           looplia:0.3.3 --version

# Step 4: Process content
docker run -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
           -v $(pwd)/content:/data \
           -v ~/.looplia:/home/looplia/.looplia \
           looplia:0.3.3 kit --file /data/article.md

# Interactive shell for debugging
docker run -it --entrypoint /bin/sh looplia:0.3.3
```

### 7.3 Viewing Logs

```bash
# List all query logs for a session
ls ~/.looplia/contentItem/{session-id}/logs/

# View latest log
cat ~/.looplia/contentItem/{session-id}/logs/query-*.log | tail -100

# Find logs with errors
grep -r "error" ~/.looplia/contentItem/*/logs/
```

---

## 8. Testing Strategy

### 8.1 QueryLogger Tests

```typescript
describe('QueryLogger', () => {
  it('should create unique log files per init', async () => {
    const logger = createQueryLogger(workspace);

    const path1 = logger.init('content-1');
    logger.close();

    const path2 = logger.init('content-1');
    logger.close();

    expect(path1).not.toBe(path2);  // Different files
  });

  it('should create logs directory if missing', async () => {
    const logger = createQueryLogger(workspace);
    logger.init('new-content');

    expect(existsSync(join(workspace, 'contentItem/new-content/logs'))).toBe(true);
  });

  it('should log messages in JSON format', async () => {
    const logger = createQueryLogger(workspace);
    const logPath = logger.init('test');

    logger.log({ type: 'test', data: 123 });
    logger.close();

    const content = readFileSync(logPath, 'utf-8');
    expect(content).toContain('"type": "test"');
    expect(content).toContain('"data": 123');
  });
});
```

### 8.2 Docker Tests

```bash
# Test 1: Build succeeds
docker build -t looplia:test .
echo "Build: PASS"

# Test 2: Image size < 400MB
SIZE=$(docker images looplia:test --format "{{.Size}}")
echo "Size: $SIZE"

# Test 3: Version command works
docker run looplia:test --version
# Expected: looplia 0.3.3

# Test 4: Auto-bootstrap works
docker run looplia:test --help
# Should show help after auto-bootstrap

# Test 5: Volume mount works
docker run -v $(pwd)/test:/data looplia:test ls /data
```

### 8.3 Bootstrap --yes Tests

```bash
# Test non-interactive bootstrap
rm -rf ~/.looplia
looplia bootstrap --yes
test -f ~/.looplia/CLAUDE.md && echo "PASS" || echo "FAIL"

# Test -y short flag
rm -rf ~/.looplia
looplia bootstrap -y
test -f ~/.looplia/CLAUDE.md && echo "PASS" || echo "FAIL"
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.3.3 | 2025-12-09 | Initial v0.3.3 design: QueryLogger, Docker image, bootstrap --yes |
