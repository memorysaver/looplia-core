# Looplia-Core Architecture Design v0.7.1

> **REFINEMENT RELEASE:** Simplified Registry System
>
> **Version:** 0.7.1
> **Date:** 2026-01-08
> **Related:** [DESIGN-0.7.0.md](./DESIGN-0.7.0.md) | [DESIGN-0.6.10.md](./DESIGN-0.6.10.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution: Explicit Registry Sync](#3-solution-explicit-registry-sync)
4. [Implementation Changes](#4-implementation-changes)
5. [CLI Development Setup](#5-cli-development-setup)
6. [File Changes Summary](#6-file-changes-summary)

---

## 1. Executive Summary

### Refinement Release: v0.7.0 → v0.7.1

| Version | Focus | Key Change |
|---------|-------|------------|
| v0.7.0 | Skill Registry System | Auto-sync on every build command |
| **v0.7.1** | **Simplified Registry** | **Explicit sync only - no auto-fetch during build** |

### What v0.7.1 Changes

1. **No Auto-Fetch During Build**: `looplia build` only scans local plugins
2. **Explicit Registry Sync**: Remote fetching via `looplia registry sync` only
3. **Bundled Plugins**: looplia-core and looplia-writer bundled with CLI
4. **Standalone CLI Bundle**: All dependencies bundled for `bun link` support

### Key Design Decisions

| Decision | v0.7.0 | v0.7.1 | Rationale |
|----------|--------|--------|-----------|
| **Registry Sync Timing** | Auto on every build | Explicit command only | Avoid confusing 404 errors, faster builds |
| **Remote Fetching** | Implicit | Explicit | User controls when to fetch |
| **CLI Runtime** | Node.js | Bun | Required for bundled dependencies |
| **Dependency Bundling** | Partial | Full | Enable `bun link` for development |

---

## 2. Problem Statement

### 2.1 Confusing 404 Errors During Build

v0.7.0 calls `compileRegistry()` during every build, which fetches from remote sources:

```bash
$ looplia build "analyze videos"
Failed to fetch registry from https://github.com/memorysaver/looplia-core/releases/latest/download/registry.json: 404
```

**Problems:**
- Confusing for users - looks like an error but build continues
- Slow builds due to network requests
- Fails silently when offline
- Registry.json doesn't exist until a release is published

### 2.2 Implicit vs Explicit Behavior

The v0.7.0 design mixes implicit and explicit operations:

| Operation | v0.7.0 Behavior | Issue |
|-----------|-----------------|-------|
| `looplia build` | Fetches remote registries | Implicit, confusing |
| `looplia registry sync` | Fetches remote registries | Explicit, clear |
| `looplia skill add` | Installs from registry | Explicit, clear |

### 2.3 Development Setup Complexity

`bun link` fails for the CLI package due to:
- External dependencies (ink, react) not bundled
- Workspace references (`workspace:*`) can't resolve globally
- Shebang uses `node` but bundle requires `bun`

---

## 3. Solution: Explicit Registry Sync

### 3.1 New Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  looplia init                                                    │
│  ├── Copy bundled plugins (looplia-core, looplia-writer)        │
│  ├── Create predefined sources.json                              │
│  └── Compile initial skill-catalog.json (local only)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  looplia build                                                   │
│  └── compileRegistry({ localOnly: true })                       │
│      └── Scan LOCAL plugins only → skill-catalog.json           │
│          ✓ Fast (no network)                                    │
│          ✓ No 404 errors                                        │
│          ✓ Works offline                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  looplia registry sync  (EXPLICIT - user initiated)            │
│  └── compileRegistry({ localOnly: false })                      │
│      └── Fetch from sources.json → update skill-catalog.json   │
│          • Downloads marketplace.json from configured sources   │
│          • Merges with local plugins                            │
│          • User controls when this happens                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  looplia skill add <name>  (EXPLICIT - user initiated)         │
│  └── Install specific skill from registry                       │
│      • JIT installation from configured sources                 │
│      • Git clone to ~/.looplia/plugins/                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Command Behavior Matrix

| Command | Network | Registry Action | Use Case |
|---------|---------|-----------------|----------|
| `looplia init` | No* | Create local catalog | Initial setup |
| `looplia build` | **No** | Scan local only | Daily development |
| `looplia run` | No | Read catalog, JIT install if needed | Execute workflows |
| `looplia registry sync` | **Yes** | Fetch all sources | Update skill catalog |
| `looplia skill add` | Yes | Install specific skill | Add new skills |
| `looplia skill list` | No | Read catalog | Browse skills |

*`looplia init` can optionally sync with `--sync` flag

### 3.3 Data Flow Comparison

**v0.7.0 (Auto-sync):**
```
looplia build
    ↓
compileRegistry()
    ├── Fetch official registry (GitHub releases) ← May 404!
    ├── Fetch marketplace sources ← Network latency
    ├── Scan local plugins
    └── Merge → skill-catalog.json
    ↓
registry-loader skill
    ↓
Build workflow
```

**v0.7.1 (Explicit sync):**
```
looplia build
    ↓
compileRegistry({ localOnly: true })
    └── Scan local plugins only ← Fast, no network
    ↓
registry-loader skill
    ↓
Build workflow

─────────────────────────────────

looplia registry sync (when user wants updates)
    ↓
compileRegistry({ localOnly: false })
    ├── Fetch official registry
    ├── Fetch marketplace sources
    ├── Scan local plugins
    └── Merge → skill-catalog.json
```

---

## 4. Implementation Changes

### 4.1 Update `compileRegistry()` Signature

**File:** `packages/provider/src/registry/compiler.ts`

```typescript
// Before (v0.7.0):
export async function compileRegistry(
  showProgress?: boolean
): Promise<CompiledRegistry>

// After (v0.7.1):
export async function compileRegistry(options?: {
  showProgress?: boolean;
  localOnly?: boolean;  // Default: true
}): Promise<CompiledRegistry>
```

**Implementation:**

```typescript
export async function compileRegistry(options?: {
  showProgress?: boolean;
  localOnly?: boolean;
}): Promise<CompiledRegistry> {
  const { showProgress = false, localOnly = true } = options ?? {};

  // 1. Always scan local plugins
  const localSkills = await scanLocalPlugins(loopliaPath);

  // 2. Only fetch remote if explicitly requested
  if (!localOnly) {
    const sources = await loadSources();
    for (const source of sources.filter(s => s.enabled)) {
      if (source.type === "github" || source.type === "official") {
        const remoteSkills = await fetchRemoteRegistry(source);
        // Merge with deduplication...
      }
    }
  }

  // 3. Write skill-catalog.json
  await writeSkillCatalog(catalog);
  return catalog;
}
```

### 4.2 Update Build Command

**File:** `apps/cli/src/commands/build.ts`

```typescript
// Before (v0.7.0):
await compileRegistry();  // Auto-fetches remote

// After (v0.7.1):
await compileRegistry({ localOnly: true });  // Local only, fast
```

### 4.3 Update Registry Sync Command

**File:** `apps/cli/src/commands/registry.ts`

```typescript
async function registrySync(): Promise<void> {
  console.log("Syncing registry from all sources...");

  // Explicit remote fetch
  await compileRegistry({
    localOnly: false,  // Fetch remote sources
    showProgress: true
  });

  console.log("Registry synced successfully.");
}
```

### 4.4 Update System Prompt

**File:** `packages/provider/src/claude-agent-sdk/streaming/prompts/looplia-system.ts`

- Version: `v0.6.5` → `v0.7.1`
- Replace `plugin-registry-scanner` → `registry-loader`
- Update workspace structure to include `registry/` directory

### 4.5 Remove Deprecated Skill

Delete `plugins/looplia-core/skills/plugin-registry-scanner/` entirely.
The `registry-loader` skill replaces it.

---

## 5. CLI Development Setup

### 5.1 Bundle All Dependencies

**File:** `apps/cli/tsup.config.ts`

```typescript
export default defineConfig({
  entry: { cli: "src/index.ts" },
  format: ["esm"],
  platform: "node",
  target: "esnext",
  clean: true,
  dts: true,
  banner: {
    js: "#!/usr/bin/env bun",  // Changed from node to bun
  },
  // Bundle all dependencies for standalone CLI
  noExternal: [
    "@looplia-core/core",
    "@looplia-core/provider",
    "ink",
    "react",
    "react/jsx-runtime",
  ],
  // Exclude optional dev dependencies
  external: ["react-devtools-core"],
  shims: true,
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
});
```

### 5.2 Development Workflow

```bash
# Build the CLI
bun run build

# Link for development
cd apps/cli && bun link
cd ~/.bun/install/global && bun link @looplia/looplia-cli

# Create node_modules structure (workaround for workspace:* references)
mkdir -p ~/.bun/install/global/node_modules/@looplia/looplia-cli
ln -sf $(pwd)/apps/cli/dist ~/.bun/install/global/node_modules/@looplia/looplia-cli/dist
ln -sf $(pwd)/apps/cli/package.json ~/.bun/install/global/node_modules/@looplia/looplia-cli/package.json

# Test
looplia --version
looplia build --mock "test workflow"
```

### 5.3 Why Bun Runtime?

The bundled CLI requires `bun` runtime because:

1. **Dynamic requires**: Some bundled dependencies use `require()` which Node.js ESM loader doesn't support
2. **ink/react**: These packages have complex module resolution that bun handles better
3. **Development simplicity**: `bun link` workflow is simpler than npm link

---

## 6. File Changes Summary

### Phase 1: Fix Build Command (Completed)

| File | Change |
|------|--------|
| `packages/provider/src/claude-agent-sdk/streaming/prompts/looplia-system.ts` | Update version, use registry-loader |
| `plugins/looplia-core/skills/plugin-registry-scanner/` | Delete entirely |

### Phase 2: Enable `bun link` (Completed)

| File | Change |
|------|--------|
| `apps/cli/tsup.config.ts` | Bundle ink, react; use bun shebang |
| `apps/cli/test/utils.ts` | Use bun instead of node for tests |

### Phase 3: Simplify Registry System

| File | Change |
|------|--------|
| `packages/provider/src/registry/compiler.ts` | Add `localOnly` parameter |
| `apps/cli/src/commands/build.ts` | Use `localOnly: true` |
| `apps/cli/src/commands/registry.ts` | Use `localOnly: false` for sync |

---

## Summary

v0.7.1 simplifies the registry system by making remote fetching explicit:

| Aspect | v0.7.0 | v0.7.1 |
|--------|--------|--------|
| Build speed | Slow (network) | Fast (local only) |
| 404 errors | Common | None |
| Offline support | Partial | Full |
| User control | Implicit | Explicit |
| CLI runtime | Node.js | Bun |
| `bun link` | Broken | Works |

**Key insight:** Users should control when to fetch remote data. The build command should be fast and work offline. Remote sync is a separate, explicit action.
