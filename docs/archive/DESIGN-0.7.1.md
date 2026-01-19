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
7. [Single Registry Loop Architecture](#7-single-registry-loop-architecture)
8. [Workflow Builder UI Progress & AskUserQuestion Integration](#8-workflow-builder-ui-progress--askuserquestion-integration)

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
3. **No Official Registry**: Removed centralized registry.json from GitHub releases
4. **Bundled Plugins**: looplia-core and looplia-writer bundled with CLI
5. **Standalone CLI Bundle**: All dependencies bundled for `bun link` support
6. **Single Registry Loop**: Unified `sources.json → sync → compile` flow (see Section 7)
7. **Workflow Builder UI Progress**: AgentTree in analyze phase, AskUserQuestion integration (see Section 8)

### Why Remove Official Registry?

The v0.7.0 design included an "official" registry source that fetched from:
```
https://github.com/memorysaver/looplia-core/releases/latest/download/registry.json
```

This caused problems:
- The file doesn't exist (404 errors)
- Maintaining a centralized registry adds complexity
- Third-party sources (via `looplia registry add`) are sufficient

**New approach**: Predefined third-party sources are included by default:
- `github:anthropics/skills` - Official Anthropic skills
- `github:ComposioHQ/awesome-claude-skills` - Community skills

Users can add more sources:
```bash
looplia registry add github.com/your-org/custom-skills
looplia registry sync
```

### Key Design Decisions

| Decision | v0.7.0 | v0.7.1 | Rationale |
|----------|--------|--------|-----------|
| **Registry Sync Timing** | Auto on every build | Explicit command only | Avoid confusing 404 errors, faster builds |
| **Remote Fetching** | Implicit | Explicit | User controls when to fetch |
| **CLI Runtime** | Node.js | Bun | Required for bundled dependencies |
| **Dependency Bundling** | Partial | Full | Enable `bun link` for development |
| **Build Analyze UI** | Spinner only | StreamingQueryUI + AgentTree | Real-time progress visibility |
| **User Questions** | Custom JSON parsing | SDK AskUserQuestion tool | Native SDK integration |
| **Executor Separation** | Single executor | `run` vs `build` executors | Interactive vs autonomous modes |

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

---

## 7. Single Registry Loop Architecture

### 7.1 Problem: Current Implementation Has Redundancies

The current v0.7.1 implementation has technical debt from incremental development:

#### Duplicate Code Locations

| Code | Location 1 | Location 2 |
|------|-----------|-----------|
| `parseYamlFrontmatter()` | `compiler.ts:345` | `build-registry.ts:173` |
| `inferCategory()` | `compiler.ts:446` | `build-registry.ts:103` |
| `inferCapabilities()` | `compiler.ts:490` | `build-registry.ts:145` |
| `formatTitle()` | `compiler.ts:506` | `build-registry.ts:95` |
| `CAPABILITY_PATTERNS` | `compiler.ts:63` | `build-registry.ts:29` |
| `CORE_SKILLS` | `skill-installer.ts:55` | `loader.ts:627` |

#### Two Separate Installation Flows

**Flow 1: Bootstrap (skill-installer.ts)**
```
installDefaultSources()
  ├── For each DEFAULT_MARKETPLACE_SOURCES:
  │   ├── git clone to temp
  │   ├── Parse marketplace.json
  │   ├── Create plugin folders with skills
  │   └── Generate plugin.json with source metadata
  └── Write sources.json
```

**Flow 2: JIT Installation (loader.ts)**
```
installThirdPartySkill() / installMarketplaceSkill()
  ├── git clone to temp
  ├── Detect format (plugin.json / marketplace.json / SKILL.md)
  ├── Auto-wrap as plugin if standalone skill
  └── Install to ~/.looplia/plugins/
```

Both flows clone repos, parse structure, create plugin directories - nearly identical logic.

#### Duplicate sources.json Writing

- `compiler.ts:initializeRegistry()` creates sources.json with DEFAULT_MARKETPLACE_SOURCES
- `skill-installer.ts:installDefaultSources()` also writes sources.json

### 7.2 Solution: Unified Single Registry Loop

The desired architecture follows a single loop:

```
sources.json
    │
    ▼
syncRegistrySources()          ← NEW unified sync function
    │
    ├── For each enabled source:
    │   ├── Clone/update to ~/.looplia/plugins/
    │   └── Create plugin structure if marketplace
    │
    ▼
compileRegistry()              ← Existing, unchanged
    │
    ├── Scan ~/.looplia/ (builtin plugins)
    ├── Scan ~/.looplia/plugins/ (third-party)
    └── Write skill-catalog.json
    │
    ▼
skill-catalog.json             ← Unified catalog for all skills
```

### 7.3 New Module Structure

```
packages/provider/src/registry/
├── index.ts            # Re-exports
├── utils.ts            # NEW: Shared YAML parsing, inference functions
├── sync.ts             # NEW: Unified source sync logic
├── compiler.ts         # Skill catalog compilation (refactored)
├── loader.ts           # Skill loading, installation (refactored)
└── progress.ts         # Progress indicators (unchanged)
```

### 7.4 New File: `registry/utils.ts`

Shared utilities extracted from duplicate code:

```typescript
/**
 * Registry Utilities (v0.7.1)
 *
 * Shared functions for YAML parsing and skill metadata inference.
 * Used by both compiler.ts (runtime) and build-registry.ts (build-time).
 */

import type { SkillCategory } from "@looplia-core/core";

/** Capability inference patterns */
export const CAPABILITY_PATTERNS = [
  { pattern: /media|video|audio|image/, capability: "media-processing" },
  { pattern: /content|text|document/, capability: "content-analysis" },
  { pattern: /json|schema|structured/, capability: "structured-output" },
  { pattern: /workflow|orchestrat/, capability: "workflow-management" },
  { pattern: /search|find|discover/, capability: "search" },
  { pattern: /generat|creat|produc/, capability: "generation" },
  { pattern: /valid|check|verify/, capability: "validation" },
] as const;

/** Regex patterns used across registry operations */
export const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
export const PROTOCOL_REGEX = /^https?:\/\//;
export const TRAILING_SLASH_REGEX = /\/$/;

/**
 * Parse YAML frontmatter into key-value map
 * Handles multiline values with YAML literal block scalar (|)
 */
export function parseYamlFrontmatter(frontmatter: string): Record<string, string>;

/**
 * Extract multiline value from indented lines
 */
export function parseMultilineValue(lines: string[], startIndex: number): string;

/**
 * Infer skill category from name and description
 */
export function inferCategory(name: string, description: string): SkillCategory;

/**
 * Infer capabilities from description
 */
export function inferCapabilities(description: string): string[];

/**
 * Format skill name as title (e.g., "my-skill" → "My Skill")
 */
export function formatTitle(name: string): string;
```

### 7.5 New File: `registry/sync.ts`

Unified source synchronization logic:

```typescript
/**
 * Registry Sync (v0.7.1)
 *
 * Unified source synchronization - the SINGLE function that handles
 * downloading/updating registry sources to local plugins directory.
 *
 * This replaces:
 * - skill-installer.ts:installDefaultSources() for bootstrap
 * - loader.ts:installMarketplaceSkill() for JIT installation
 *
 * @see docs/DESIGN-0.7.1.md section 7
 */

import type { RegistrySource, InstallResult } from "@looplia-core/core";

/** Result of syncing a single source */
export type SyncResult = {
  source: RegistrySource;
  status: "synced" | "updated" | "failed" | "skipped";
  plugins: InstallResult[];  // Individual plugin results
  error?: string;
};

/** Options for syncing registry sources */
export type SyncOptions = {
  /** Show progress indicators */
  showProgress?: boolean;
  /** Only sync specific source IDs (default: all enabled) */
  sourcesToSync?: string[];
  /** Force re-download even if already exists */
  force?: boolean;
};

/**
 * Sync all enabled registry sources to local plugins directory
 *
 * This is the SINGLE function that handles downloading/updating sources:
 * 1. Read sources.json for enabled sources
 * 2. For each source, clone or update the repository
 * 3. Detect format and install appropriately:
 *    - marketplace.json: Split into separate plugin directories
 *    - plugin.json: Copy as-is
 *    - SKILL.md only: Auto-wrap as plugin
 *
 * Called by:
 * - looplia init (initial setup after sources.json created)
 * - looplia registry sync (explicit refresh)
 * - looplia skill add (single source JIT)
 */
export async function syncRegistrySources(
  options?: SyncOptions
): Promise<SyncResult[]>;

/**
 * Sync a single registry source
 *
 * @param source - The source to sync
 * @param options - Sync options
 */
export async function syncSource(
  source: RegistrySource,
  options?: Omit<SyncOptions, "sourcesToSync">
): Promise<SyncResult>;

/**
 * Install a marketplace source by splitting into separate plugins
 *
 * Marketplace format (from anthropics/skills, ComposioHQ/awesome-claude-skills):
 * - Has .claude-plugin/marketplace.json
 * - Contains plugins[] array with name, description, skills[]
 * - Each plugin entry becomes a separate plugin directory
 */
async function installMarketplaceSource(
  tempDir: string,
  source: RegistrySource,
  pluginsDir: string
): Promise<InstallResult[]>;

/**
 * Install a standard plugin (has plugin.json)
 */
async function installPluginSource(
  tempDir: string,
  source: RegistrySource,
  pluginsDir: string
): Promise<InstallResult>;

/**
 * Install a standalone skill (has SKILL.md, auto-wrap as plugin)
 */
async function installStandaloneSkill(
  tempDir: string,
  source: RegistrySource,
  pluginsDir: string
): Promise<InstallResult>;
```

### 7.6 Updated Bootstrap Flow

**Before (current):**
```typescript
// bootstrap/index.ts:copyPlugins()
export async function copyPlugins(targetDir: string, sourcePath?: string): Promise<void> {
  // 1. Copy bundled plugins
  // 2. Create directories
  // 3. Extract workflows

  // 4. Download default sources - SEPARATE LOGIC
  const { installDefaultSources } = await import("./skill-installer");
  await installDefaultSources();  // ← Duplicate clone/install logic

  // 5. Compile registry
  const { compileRegistry } = await import("../registry/compiler");
  await compileRegistry();
}
```

**After (unified):**
```typescript
// bootstrap/index.ts:copyPlugins()
export async function copyPlugins(targetDir: string, sourcePath?: string): Promise<void> {
  // 1. Copy bundled plugins (looplia-core, looplia-writer)
  // 2. Create directories (sandbox, workflows)
  // 3. Extract workflows from plugins

  // 4. Initialize registry with default sources
  const { initializeRegistry } = await import("../registry/compiler");
  await initializeRegistry();  // Creates sources.json with DEFAULT_MARKETPLACE_SOURCES

  // 5. Sync sources using unified flow
  const { syncRegistrySources } = await import("../registry/sync");
  await syncRegistrySources({ showProgress: true });  // ← Single unified logic

  // 6. Compile skill catalog
  const { compileRegistry } = await import("../registry/compiler");
  await compileRegistry();
}
```

### 7.7 Updated Loader.ts

**Before (current):**
```typescript
// loader.ts
export async function installThirdPartySkill(skill: CompiledSkill): Promise<InstallResult> {
  // Check if marketplace skill
  if (skill.skillPath) {
    return await installMarketplaceSkill(skill);  // ← Separate function
  }

  // Clone, detect format, install...
  // ← Duplicates logic from skill-installer.ts
}

export async function installMarketplaceSkill(skill: CompiledSkill): Promise<InstallResult> {
  // Clone marketplace, find skill path, auto-wrap...
  // ← Duplicates logic from skill-installer.ts
}
```

**After (using sync.ts):**
```typescript
// loader.ts
export async function installThirdPartySkill(
  skill: CompiledSkill,
  showProgress = false
): Promise<InstallResult> {
  // Create a temporary source for this skill
  const source: RegistrySource = {
    id: `temp:${skill.name}`,
    type: "github",
    url: skill.gitUrl!,
    enabled: true,
    priority: 0,
    addedAt: new Date().toISOString(),
    skillPath: skill.skillPath,  // For selective extraction
  };

  // Use unified sync logic
  const { syncSource } = await import("./sync");
  const result = await syncSource(source, { showProgress });

  // Return first plugin result (single skill install)
  return result.plugins[0] ?? {
    skill: skill.name,
    status: "failed",
    error: result.error ?? "Unknown error",
  };
}
```

### 7.8 File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `registry/utils.ts` | **CREATE** | Shared YAML parsing, inference functions |
| `registry/sync.ts` | **CREATE** | Unified source sync logic |
| `registry/compiler.ts` | **MODIFY** | Import from utils.ts, remove duplicates |
| `registry/loader.ts` | **MODIFY** | Use sync.ts for installation |
| `registry/index.ts` | **MODIFY** | Export new modules |
| `bootstrap/skill-installer.ts` | **MODIFY** | Remove `installDefaultSources()`, re-export from loader.ts |
| `bootstrap/index.ts` | **MODIFY** | Use sync.ts instead of skill-installer |
| `scripts/build-registry.ts` | **MODIFY** | Import from utils.ts |

### 7.9 Migration Path

1. **Phase 1: Extract Utilities** (Low Risk)
   - Create `utils.ts` with shared functions
   - Update imports in `compiler.ts` and `build-registry.ts`
   - No behavior change, just code organization

2. **Phase 2: Create Sync Module** (Medium Risk)
   - Create `sync.ts` with unified sync logic
   - Migrate `installDefaultSources()` logic to `syncRegistrySources()`
   - Update `bootstrap/index.ts` to use new flow

3. **Phase 3: Update Loader** (Medium Risk)
   - Refactor `installThirdPartySkill()` to use `syncSource()`
   - Remove duplicate installation logic
   - Ensure JIT installation still works

4. **Phase 4: Cleanup** (Low Risk)
   - Remove `installDefaultSources()` from skill-installer.ts
   - Remove duplicate `CORE_SKILLS` definition
   - Update exports

### 7.10 Testing Verification

```bash
# Clean slate test
rm -rf ~/.looplia

# Test init (uses syncRegistrySources)
looplia init
ls ~/.looplia/plugins/  # Should have marketplace plugins

# Test skill catalog
looplia skill list  # Should show all skills

# Test registry sync
looplia registry sync  # Should update from sources

# Test JIT installation
looplia skill add xlsx  # Should use syncSource

# Test build
looplia build --mock "test workflow"

# Run existing tests
bun test
```

### 7.11 Benefits of Single Loop Architecture

| Aspect | Before (Dual Flow) | After (Single Loop) |
|--------|-------------------|---------------------|
| Code duplication | ~400 lines duplicated | Single source of truth |
| Maintenance | Fix bugs in 2 places | Fix once |
| Consistency | Different behavior paths | Unified behavior |
| Testing | Test 2 flows separately | Test 1 flow |
| New source types | Add to 2 places | Add to 1 place |

---

## 8. Workflow Builder UI Progress & AskUserQuestion Integration

### 8.1 Problem Statement

The current `looplia build` command has UI/UX issues:

#### Analyze Phase Has No Progress Visibility

```
$ looplia build
What should this workflow do? > analyze youtube videos
⣾ Analyzing your requirements...    ← Only spinner, no details!
  Generating clarifying questions...
```

Users can't see:
- Which skills are being invoked
- What tools are being used
- How far along the analysis is

The `StreamingQueryUI` component with `AgentTree` exists and works well in the **generating** phase, but is not used during **analyzing**.

#### Two Disconnected Question Systems

| System | Source | Usage |
|--------|--------|-------|
| `AskUserQuestionInput` | Claude Agent SDK tool | Available for agents to ask users questions during execution |
| Custom Wizard Questions | `skill-analyzer.ts` + `SectionView` | Looplia's own clarification UI |

The wizard generates questions by asking Claude to return structured JSON, then renders them with custom React components. **The Agent SDK's `AskUserQuestion` tool is never invoked.**

#### bypassPermissions Prevents AskUserQuestion

Current executor uses:
```typescript
permissionMode: "bypassPermissions",
allowDangerouslySkipPermissions: true,
```

This completely bypasses the SDK's permission system, which means:
- `AskUserQuestion` tool calls execute but **no user interaction happens**
- The SDK expects its permission system to populate the `answers` field
- With bypass mode, answers are never collected

### 8.2 Solution: Executor Separation + AskUserQuestion Integration

#### Architecture Overview

```
Current Flow:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Description │ --> │  Analyzing  │ --> │ Clarifying  │
│  (TextInput)│     │  (Spinner)  │     │ (Custom UI) │
└─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                    No AgentTree         Custom questions
                    No streaming         from JSON parsing
                    bypassPermissions    No SDK integration

Proposed Flow:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Description │ --> │  Analyzing  │ --> │ Clarifying  │
│  (TextInput)│     │ (AgentTree) │     │(SDK-driven) │
└─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                    StreamingQueryUI     AskUserQuestion
                    Real-time progress   via canUseTool
```

#### Executor Separation

```
┌─────────────────────────────────────────────────────────┐
│                    query-executor.ts                     │
│  (base executor - bypassPermissions for `run` command)  │
│  - No AskUserQuestion                                    │
│  - Autonomous execution                                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              interactive-query-executor.ts               │
│  (extends base - canUseTool for `build` command)        │
│  - AskUserQuestion handling via callback                │
│  - Auto-approve all other tools                         │
└─────────────────────────────────────────────────────────┘
```

| Command | Executor | Permission Mode | AskUserQuestion |
|---------|----------|-----------------|-----------------|
| `run` | `query-executor.ts` | `bypassPermissions` | ❌ Not available |
| `build` | `interactive-query-executor.ts` | `default` + `canUseTool` | ✅ Supported |

### 8.3 SDK AskUserQuestion Tool

From the Claude Agent SDK:

```typescript
interface AskUserQuestionInput {
  /**
   * Questions to ask the user (1-4 questions)
   */
  questions: Array<{
    question: string;     // Full question text
    header: string;       // Short label (max 12 chars)
    options: Array<{
      label: string;      // Option display (1-5 words)
      description: string; // Option explanation
    }>;
    multiSelect: boolean;
  }>;
  /**
   * User answers populated by the permission system.
   * Maps question text to selected option label(s).
   */
  answers?: Record<string, string>;
}
```

The SDK's permission system handles collecting answers. We need to:
1. Use `canUseTool` callback to intercept `AskUserQuestion` tool calls
2. Display our custom UI
3. Return answers in the expected format

### 8.4 Implementation Details

#### Phase 1: Create Interactive Query Executor

**File:** `packages/provider/src/claude-agent-sdk/streaming/interactive-query-executor.ts` (NEW)

```typescript
/**
 * Interactive Query Executor (v0.7.1)
 *
 * Used by `build` command for interactive workflow building.
 * Supports AskUserQuestion via canUseTool callback.
 *
 * For autonomous execution (`run` command), use query-executor.ts instead.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { ClaudeAgentConfig } from "../config";
import type { AgenticQueryResult } from "../utils/shared";
import type { StreamingEvent } from "./types";

// Question callback type
export type QuestionCallback = (
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>
) => Promise<Record<string, string>>;

/**
 * Execute interactive query with AskUserQuestion support
 */
export async function* executeInteractiveQueryStreaming<T>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  config: ClaudeAgentConfig,
  questionCallback?: QuestionCallback
): AsyncGenerator<StreamingEvent, AgenticQueryResult<T>> {
  // ... initialization same as query-executor.ts

  const result = query({
    prompt,
    options: {
      model: mainModel,
      cwd: loopliaHome,

      // KEY DIFFERENCE: Use default permission mode with custom handler
      permissionMode: "default",
      allowDangerouslySkipPermissions: true,

      // Custom permission handler for AskUserQuestion
      canUseTool: async (toolName, input) => {
        // Handle AskUserQuestion specially
        if (toolName === "AskUserQuestion") {
          if (questionCallback && input.questions) {
            try {
              const answers = await questionCallback(input.questions);
              return {
                behavior: "allow",
                updatedInput: { ...input, answers },
              };
            } catch (error) {
              return {
                behavior: "deny",
                message: "User cancelled question input",
              };
            }
          }
          return {
            behavior: "deny",
            message: "Question handler not available",
          };
        }

        // All other tools: auto-approve (equivalent to bypass)
        return { behavior: "allow", updatedInput: input };
      },

      // Include AskUserQuestion in allowed tools
      allowedTools: [
        "Read",
        "Write",
        "Glob",
        "Task",
        "Skill",
        "WebSearch",
        "WebFetch",
        "AskUserQuestion",  // Only in interactive mode
      ],

      outputFormat: { type: "json_schema", schema: jsonSchema },
      plugins: pluginPaths,
    },
  });

  // ... event processing same as query-executor.ts
}
```

#### Phase 2: Keep query-executor.ts Unchanged

**File:** `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts`

No changes - keeps `bypassPermissions` for `run` command:

```typescript
// Existing code stays the same
permissionMode: "bypassPermissions",
allowDangerouslySkipPermissions: true,
allowedTools: [
  "Read",
  "Write",
  "Glob",
  "Task",
  "Skill",
  "WebSearch",
  "WebFetch",
  // NO AskUserQuestion - autonomous execution
],
```

#### Phase 3: Create Question Input Component

**File:** `apps/cli/src/components/ask-user-question-panel.tsx` (NEW)

```typescript
import { Box, Text, useInput } from "ink";
import { useState, useCallback } from "react";
import { SelectInput, MultiSelectInput } from "./inputs";
import { BoxedArea } from "./boxed-area";

type Question = {
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
};

type Props = {
  questions: Question[];
  onComplete: (answers: Record<string, string>) => void;
  onCancel: () => void;
};

export function AskUserQuestionPanel({ questions, onComplete, onCancel }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const currentQuestion = questions[currentIndex];

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const handleAnswer = useCallback((value: string | string[]) => {
    const answer = Array.isArray(value) ? value.join(", ") : value;
    const newAnswers = { ...answers, [currentQuestion.question]: answer };

    if (currentIndex < questions.length - 1) {
      setAnswers(newAnswers);
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(newAnswers);
    }
  }, [currentIndex, answers, currentQuestion, questions.length, onComplete]);

  const options = currentQuestion.options.map((opt, i) => ({
    id: String(i),
    label: opt.label,
  }));

  return (
    <BoxedArea borderColor="yellow" title={currentQuestion.header}>
      <Box flexDirection="column">
        <Text bold>{currentQuestion.question}</Text>
        <Box marginTop={1}>
          {currentQuestion.multiSelect ? (
            <MultiSelectInput
              options={options}
              onSubmit={(selected) => handleAnswer(selected.map(s => s.label))}
              isActive={true}
            />
          ) : (
            <SelectInput
              options={options}
              onSelect={(selected) => handleAnswer(selected.label)}
              isActive={true}
            />
          )}
        </Box>
        <Text dimColor>
          Question {currentIndex + 1} of {questions.length} | [Esc] Cancel
        </Text>
      </Box>
    </BoxedArea>
  );
}
```

#### Phase 4: Create AnalyzingPanel Component

**File:** `apps/cli/src/components/wizard/analyzing-panel.tsx` (NEW)

Replace spinner with StreamingQueryUI for analyze phase:

```typescript
import type { StreamingEvent } from "@looplia-core/core";
import { useState, useCallback } from "react";
import { StreamingQueryUI } from "../streaming-query-ui";
import { AskUserQuestionPanel } from "../ask-user-question-panel";
import type { ClarificationResult } from "./types";
import { analyzeDescriptionStreaming } from "./skill-analyzer";

type Question = {
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
};

type Props = {
  description: string;
  workspace: string;
  onComplete: (result: ClarificationResult) => void;
  onError: (error: Error) => void;
};

export function AnalyzingPanel({
  description,
  workspace,
  onComplete,
  onError,
}: Props) {
  const [pendingQuestion, setPendingQuestion] = useState<{
    questions: Question[];
    resolve: (answers: Record<string, string>) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const questionCallback = useCallback(async (questions: Question[]) => {
    return new Promise<Record<string, string>>((resolve, reject) => {
      setPendingQuestion({ questions, resolve, reject });
    });
  }, []);

  const createStreamGenerator = useCallback(() => {
    return analyzeDescriptionStreaming(description, workspace, questionCallback);
  }, [description, workspace, questionCallback]);

  if (pendingQuestion) {
    return (
      <AskUserQuestionPanel
        questions={pendingQuestion.questions}
        onComplete={(answers) => {
          pendingQuestion.resolve(answers);
          setPendingQuestion(null);
        }}
        onCancel={() => {
          pendingQuestion.reject(new Error("User cancelled"));
          setPendingQuestion(null);
        }}
      />
    );
  }

  return (
    <StreamingQueryUI<ClarificationResult>
      title="Analyzing Requirements"
      subtitle="Scanning skills and generating questions..."
      streamGenerator={createStreamGenerator}
      onComplete={onComplete}
      onError={onError}
      workspacePath={workspace}
    />
  );
}
```

#### Phase 5: Update skill-analyzer for Interactive Streaming

**File:** `apps/cli/src/components/wizard/skill-analyzer.ts`

```typescript
import type { StreamingEvent } from "@looplia-core/core";
import {
  executeInteractiveQueryStreaming,
  type QuestionCallback
} from "@looplia-core/provider/claude-agent-sdk";

/**
 * Streaming version of analyzeDescription (interactive mode)
 * Uses interactive executor with AskUserQuestion support
 */
export async function* analyzeDescriptionStreaming(
  description: string,
  workspace: string,
  questionCallback?: QuestionCallback
): AsyncGenerator<StreamingEvent, ClarificationResult> {
  const prompt = buildAnalysisPrompt(description);

  const generator = executeInteractiveQueryStreaming<WorkflowResult>(
    prompt,
    ANALYSIS_RESULT_SCHEMA,
    { workspace },
    questionCallback
  );

  let finalData: unknown;

  for await (const event of generator) {
    yield event;
  }

  const result = await generator.return(undefined);
  if (result.value?.success && result.value?.data) {
    finalData = result.value.data;
  }

  return parseClarificationResult(finalData);
}

// Keep non-streaming version for backward compatibility
export async function analyzeDescription(
  description: string,
  workspace: string
): Promise<ClarificationResult> {
  // ... existing implementation unchanged
}
```

#### Phase 6: Update Wizard to Use AnalyzingPanel

**File:** `apps/cli/src/components/wizard/wizard.tsx`

```typescript
import { AnalyzingPanel } from "./analyzing-panel";

// In renderPhase function:
case "analyzing":
  return (
    <AnalyzingPanel
      description={state.description}
      workspace={workspace}
      onComplete={(result) => {
        logger.logAnalysisResult({
          sections: result.clarifications.sections,
          recommendations: result.recommendations,
        });
        setState((s) => ({
          ...s,
          phase: "clarifying",
          sections: result.clarifications.sections,
          recommendations: result.recommendations,
          workflow: result.previewWorkflow || null,
          currentSectionIndex: 0,
        }));
      }}
      onError={(error) => {
        logger.logAnalysisResult({ error: error.message });
        setState((s) => ({
          ...s,
          phase: "error",
          error,
        }));
      }}
    />
  );
```

### 8.5 Question Callback Flow

```
┌─────────────────┐
│ InteractiveExec │
│   canUseTool    │──▶ AskUserQuestion detected
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ questionCallback│──▶ Called with questions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ setPendingQ     │──▶ React state update
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AskUserQuestion │──▶ User sees questions
│     Panel       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ resolve(answers)│──▶ Answers returned to executor
└─────────────────┘
```

### 8.6 Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `packages/provider/.../interactive-query-executor.ts` | **Create** | Interactive executor with canUseTool |
| `packages/provider/.../query-executor.ts` | **Unchanged** | Keep bypassPermissions for `run` |
| `packages/provider/.../types.ts` | Modify | Add AskUserQuestionEvent type |
| `apps/cli/src/components/ask-user-question-panel.tsx` | **Create** | Question input component |
| `apps/cli/src/components/wizard/analyzing-panel.tsx` | **Create** | Streaming analyze panel |
| `apps/cli/src/components/wizard/skill-analyzer.ts` | Modify | Add streaming variant |
| `apps/cli/src/components/wizard/wizard.tsx` | Modify | Use AnalyzingPanel |
| `apps/cli/src/components/wizard/generating-panel.tsx` | Modify | Add question handling |
| `apps/cli/src/commands/build.ts` | Modify | Add executeInteractiveStreamingBatch |

### 8.7 Key Design Decisions

#### Why canUseTool Instead of Custom Events?

1. **SDK-native pattern**: AskUserQuestion is designed to work with permission system
2. **Answers populated correctly**: SDK expects answers in the input object
3. **Blocking behavior**: canUseTool naturally pauses execution until answers received
4. **Type safety**: Uses SDK's built-in types

#### Why Separate Executors?

1. **Clear separation of concerns**: Interactive vs autonomous execution
2. **No risk to `run` command**: Existing behavior completely unchanged
3. **Type safety**: Different allowed tools per executor
4. **Testability**: Each executor can be tested independently

#### Why Keep bypassPermissions for Run?

1. **Performance**: No permission check overhead for normal tools
2. **Backward compatible**: Existing behavior unchanged
3. **Autonomous execution**: Workflow execution should run without prompts

### 8.8 Verification Steps

```bash
# 1. Run Command (unchanged)
looplia run my-workflow
# Should work exactly as before
# No AskUserQuestion prompts

# 2. Build Command - Analyze Progress
looplia build
# Enter: "analyze youtube videos"
# Should see AgentTree with skill invocations

# 3. Build Command - AskUserQuestion
looplia build
# If agent uses AskUserQuestion, should see question panel
# Answers collected and returned to agent

# 4. Full Workflow Test
looplia build --name test-workflow
# Complete full wizard flow
# Verify workflow is created correctly
```

### 8.9 Risk Mitigation

- **Backward Compatibility**: `query-executor.ts` unchanged - `run` command unaffected
- **Error Handling**: Graceful fallback if question callback not provided
- **Timeout**: Consider adding timeout for question input (prevent infinite wait)
- **Testing**: Test both `run` and `build` commands independently
