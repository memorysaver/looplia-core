# Looplia-Core Architecture Design v0.7.2

> **PRODUCTION RELEASE PREP:** NPM-Sourced Runtime Image
>
> **Version:** 0.7.2
>
> **Date:** 2026-01-13
>
> **Related:** [DESIGN-0.7.1.md](./DESIGN-0.7.1.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Dockerfile.prod Design](#4-dockerfileprod-design)
5. [Workspace & Output Management](#5-workspace--output-management)
6. [Anthropic/CLIProxyAPI Configuration](#6-anthropiccliproxyapi-configuration)
7. [Build & Validation Plan](#7-build--validation-plan)
8. [Open Questions & Future Work](#8-open-questions--future-work)

---

## 1. Executive Summary

### Goal: Ship a User-Facing Production Image

| Version | Focus | Key Change |
|---------|-------|------------|
| v0.7.1 | Registry simplification | Local-only builds, explicit sync |
| **v0.7.2** | **Docker distribution + Output management** | **`Dockerfile.prod` + `--output` flag** |

v0.7.2 introduces a dedicated production Dockerfile that installs the published
`@looplia/looplia-cli` package directly from npm. Unlike the existing E2E image
(which copies locally built artifacts), the production image can be built by
any end user without access to the monorepo and mirrors the runtime experience
of `bun install -g @looplia/looplia-cli`.

### Objectives

1. Provide a reproducible production image for Cloudflare (or any container service).
2. Remove the requirement to `bun run build` before packaging.
3. Preserve workspace auto-initialization, bundled plugins, and marketplace sync.
4. Keep CLIProxyAPI integration trivial via Anthropic-compatible env vars.
5. Enable users to easily retrieve outputs via `--output` flag and `LOOPLIA_OUTPUT_DIR` env var.

---

## 2. Problem Statement

| Issue | Impact |
|-------|--------|
| **Existing Dockerfile is E2E-only** | Requires local `dist/` artifacts from the monorepo, making it unusable for users who only consume npm releases. |
| **Build prerequisite (`bun run build`)** | Slows CI/CD and introduces coupling to repo structure. |
| **No production-friendly image** | Users deploying to Cloudflare Containers or other services must craft their own runtime. |

The absence of a production Dockerfile blocks adoption by users who want to run
Looplia workflows inside sandboxed container environments.

---

## 3. Solution Overview

### Deliverables

1. **`Dockerfile.prod`** at repo root.
2. Documentation describing build args, environment variables, and usage patterns.
3. Guidance for routing Anthropic traffic through CLIProxyAPI while keeping the
   Anthropic SDK contract (base URL + key).

### High-Level Flow

```
User                Docker Build                  Runtime
----                ------------                  -------
│ bunx create env   │ docker build …              │ docker run …
│                   │   ARG VERSION=0.7.2         │   ↳ looplia init --yes (first run)
│                   │   bun install -g looplia    │   ↳ looplia … (user command)
```

The image contains only published npm assets and minimal Alpine packages,
ensuring reproducibility and smaller attack surface.

---

## 4. Dockerfile.prod Design

### File Placement & Naming

- `Dockerfile.prod` sits beside the existing E2E `Dockerfile` for clear separation.
- E2E image keeps local-artifact flow for CI tests; production image uses npm.

### Full Dockerfile (reference)

```dockerfile
ARG VERSION=latest
FROM oven/bun:1.2-alpine

RUN addgroup -g 1001 -S looplia && \
    adduser -S looplia -u 1001 -G looplia

RUN apk add --no-cache git

ARG VERSION
RUN bun install -g @looplia/looplia-cli@${VERSION}

RUN mkdir -p /home/looplia/.looplia && \
    chown -R looplia:looplia /home/looplia

USER looplia
WORKDIR /home/looplia

ENV NODE_ENV=production
ENTRYPOINT ["sh", "-c", "looplia init --yes 2>/dev/null || true; exec looplia \"$@\"", "--"]
CMD ["--help"]
```

### Key Design Choices

| Decision | Rationale |
|----------|-----------|
| **Build arg `VERSION` (default `latest`)** | Allows `docker build --build-arg VERSION=0.7.2` to mirror npm releases. |
| **Base image `oven/bun:1.2-alpine`** | Matches current runtime expectations and keeps image small. |
| **Install via `bun install -g`** | Ensures the same bits users get from npm without repo access. |
| **Git installed** | Required for registry syncing and plugin marketplace clones. |
| **Inline entrypoint** | Avoids maintaining another script; still auto-initializes workspace. |
| **Home directory workdir** | Keeps sandboxes, workflows, and plugin storage under `/home/looplia`. |

### Usage Patterns

```bash
# Build latest
docker build -f Dockerfile.prod -t looplia:prod .

# Build specific version
docker build -f Dockerfile.prod --build-arg VERSION=0.7.2 -t looplia:0.7.2 .

# Basic help
docker run --rm looplia:prod --help

# Run workflow with mounted files
mkdir -p $(pwd)/workflows $(pwd)/sandbox
cp workflows/writing-kit.md ./workflows/

docker run --rm \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v $(pwd)/workflows:/home/looplia/workflows \
  -v $(pwd)/sandbox:/home/looplia/sandbox \
  looplia:prod run writing-kit --file /home/looplia/workflows/article.md
```

### Cloudflare Container Service Notes

- Deploy `looplia:prod` as a standalone service; no special entrypoint required.
- Mount persistent volumes (if available) to `/home/looplia/workflows` and `/home/looplia/sandbox`.
- Provide `ANTHROPIC_API_KEY` (or CLIProxyAPI equivalent) via encrypted environment variables.

---

## 5. Workspace & Output Management

### Problem

Workflow outputs are stored in `~/.looplia/sandbox/{id}/outputs/`, requiring
users to navigate there manually. For Docker deployments, outputs are lost
when the container exits unless explicitly extracted via volume mounts.

### Solution

Add `--output <dir>` flag and `LOOPLIA_OUTPUT_DIR` environment variable to
copy outputs to a user-specified location after workflow completion.

### CLI Changes

```bash
# New flag
looplia run workflow-id --file input.md --output ./results/

# Environment variable (useful for Docker)
export LOOPLIA_OUTPUT_DIR=./outputs
looplia run workflow-id --file input.md
```

**Priority order:** `--output` flag > `LOOPLIA_OUTPUT_DIR` env var > no copy (default)

### Usage Patterns

| Scenario | Command | Outputs Location |
|----------|---------|------------------|
| Local default | `looplia run wf --file x.md` | `~/.looplia/sandbox/{id}/outputs/` |
| Local explicit | `looplia run wf --file x.md --output ./out/` | `./out/` |
| Docker | See below | Mounted volume on host |

### Docker Pattern (Recommended)

```bash
# Mount project directory and set output location via env var
docker run --rm \
  -v $(pwd):/project \
  -e ANTHROPIC_API_KEY=... \
  -e LOOPLIA_OUTPUT_DIR=/project/outputs \
  looplia:prod run writing-kit --file /project/article.md

# Outputs appear in ./outputs/ on host after container exits
```

This pattern ensures outputs persist after container termination without
requiring users to understand the internal sandbox structure.

### Implementation Notes

- Outputs are copied (not moved) after successful workflow completion
- Destination directory is created if it doesn't exist
- All files in `sandbox/{id}/outputs/` are copied to the destination
- Copy count is reported: `✓ 3 output file(s) copied to ./results/`

---

## 6. Anthropic/CLIProxyAPI Configuration

Looplia currently consumes Anthropic-compatible credentials. Users integrating
[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) can leverage the same
variables by pointing `ANTHROPIC_BASE_URL` at the proxy endpoint.

| Scenario | Required Env Vars | Example |
|----------|-------------------|---------|
| Direct Anthropic | `ANTHROPIC_API_KEY` | `sk-ant-api03-…` |
| CLIProxyAPI | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` | `http://proxy-service:8080/v1` |
| ZenMux passthrough | `ZENMUX_API_KEY` | Provided by ZenMux; CLI maps to Anthropic key at runtime |

**Proxy Example:**
```bash
docker run --rm \
  -e ANTHROPIC_API_KEY=cliproxy-xyz \
  -e ANTHROPIC_BASE_URL=http://host.docker.internal:8080/v1 \
  looplia:prod run writing-kit --file /home/looplia/workflows/article.md
```

Because the CLI maintains Anthropic SDK semantics internally, no additional
code changes are required to support OpenAI-style proxies as long as they expose
an Anthropic-compatible surface (method names, headers, error codes).

Future enhancements may introduce parallel `OPENAI_API_KEY`/`OPENAI_BASE_URL`
variables, but v0.7.2 keeps the configuration aligned with existing SDK
expectations for predictability.

---

## 7. Build & Validation Plan

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `docker build -f Dockerfile.prod -t looplia:prod .` | Ensure image builds without local artifacts. |
| 2 | `docker run looplia:prod --version` | Validate CLI binary wiring. |
| 3 | `docker run -e ANTHROPIC_API_KEY=... looplia:prod run ...` | Smoke-test workflow execution (requires valid key or mocked proxy). |
| 4 | (Optional) `docker run --entrypoint sh looplia:prod` | Inspect filesystem, ensure plugins bundled from npm. |

Automated CI validation can reuse existing E2E workflows by swapping in the new
image once published to a registry.

---

## 8. Open Questions & Future Work

1. **Image publication** — decide whether to push signed images to GHCR or Docker Hub on tag releases.
2. **Multi-architecture builds** — investigate `linux/arm64` support for Apple Silicon Cloudflare targets.
3. **Proxy presets** — consider shipping helper scripts for popular providers (CLIProxyAPI, OpenRouter, etc.).
4. **Workspace persistence** — document best practices for managing `/home/looplia` across container restarts.

---

## Summary

v0.7.2 delivers a production-ready Docker image that mirrors the npm
installation path, dramatically simplifying deployment for end-users and
Cloudflare Container workloads. This positions Looplia for broader adoption
without leaking repository-specific assumptions into consumer environments.
