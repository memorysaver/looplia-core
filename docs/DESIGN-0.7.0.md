# Looplia-Core Architecture Design v0.7.0

> **FEATURE RELEASE:** Skill Registry System
>
> **Version:** 0.7.0
> **Date:** 2026-01-04
> **Related:** [DESIGN-0.6.10.md](./DESIGN-0.6.10.md) | [DESIGN-0.6.3.md](./DESIGN-0.6.3.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution: Skill Registry System](#3-solution-skill-registry-system)
4. [Registry Schema Design](#4-registry-schema-design)
5. [CLI Commands](#5-cli-commands)
6. [Build Integration](#6-build-integration)
7. [Selective Plugin Loading](#7-selective-plugin-loading)
8. [Run Command Enhancement](#8-run-command-enhancement)
9. [Directory Structure](#9-directory-structure)
10. [Implementation Plan](#10-implementation-plan)
11. [Migration & Backward Compatibility](#11-migration--backward-compatibility)
12. [File Changes Summary](#12-file-changes-summary)

---

## 1. Executive Summary

### Feature Release: v0.6.10 → v0.7.0

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.10 | Unified Command Initialization | build/run commands share settings logic |
| **v0.7.0** | **Skill Registry System** | **shadcn/ui-inspired registry for skill discovery and dynamic loading** |

### What v0.7.0 Introduces

1. **Remote Registry**: JSON manifest hosted on GitHub Releases for skill discovery
2. **Skill Catalog**: Local cache aggregated from multiple sources (auto-sync on build)
3. **Build Integration**: Search registry during workflow generation
4. **Dynamic Skill Loading**: Only load required skills at runtime
5. **Third-party Skills**: Live git clone/copy support for community plugins

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Registry Host** | GitHub Releases | Versioned alongside plugins.tar.gz, simple CDN |
| **Auto-sync Timing** | Every build command | Ensures freshest skill catalog for workflow generation |
| **Version Pinning** | None | Simplicity - always use latest installed version |
| **Built-in Skills** | Full bundle strategy | looplia-core/looplia-writer stay bundled |
| **Third-party Skills** | Live git clone | Copy to `~/.looplia/plugins/{repo-name}/` on demand |

### Why This Matters

**Current Pain Points (v0.6.x):**
- All plugins loaded at runtime regardless of workflow needs
- No discovery mechanism for community skills
- Build command scans local plugins every time (slow, limited)
- No way to install individual skills from external sources

**After v0.7.0:**
- Workflows declare required skills → only those are loaded
- Registry enables discovery of official + third-party skills
- Build command uses skill catalog (fast, comprehensive)
- `looplia skill add` installs skills from any registered source

---

## 2. Problem Statement

### 2.1 All Plugins Loaded at Runtime

The current `getPluginPaths()` function in `bootstrap/index.ts` loads ALL installed plugins:

```typescript
// packages/provider/src/bootstrap/index.ts (lines 425-433)
export async function getPluginPaths(): Promise<
  Array<{ type: "local"; path: string }>
> {
  if (process.env.LOOPLIA_DEV === "true") {
    const devRoot = process.env.LOOPLIA_DEV_ROOT ?? process.cwd();
    return getDevPluginPaths(devRoot);  // Returns ALL plugins
  }
  return await getProdPluginPaths();     // Scans ~/.looplia for ALL plugins
}
```

**Problem:** A simple workflow using only `media-reviewer` still loads all 14+ skills from both plugins, increasing:
- Context window usage
- Tool discovery overhead
- Potential for skill name conflicts

### 2.2 Local-Only Skill Discovery

The `plugin-registry-scanner` skill scans plugins at runtime:

```typescript
// plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.ts
// Scans plugins/*/skills/*/SKILL.md at runtime
```

**Problems:**
- Runs every build (slow for large skill sets)
- Cannot discover remote/community skills
- No curated catalog with descriptions/capabilities

### 2.3 No Skill Installation Mechanism

Currently, users must:
1. Manually clone third-party plugin repos
2. Copy to `~/.looplia/`
3. Hope the structure matches expected format

**Problems:**
- No `looplia skill add <name>` command
- No registry to discover available skills
- No dependency resolution

### 2.4 Workflows Don't Declare Dependencies

Current workflow format (v0.6.3):

```yaml
---
name: writing-kit
version: 1.0.0
description: Transform content into writing kit
steps:
  - id: summary
    skill: media-reviewer
    # ...
---
```

The workflow uses `media-reviewer` but doesn't explicitly declare it. The system must:
1. Parse all steps to find skills
2. Hope they're installed
3. Load ALL plugins anyway

---

## 3. Solution: Skill Registry System

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SKILL REGISTRY SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │
│  │ Official        │   │ Third-party     │   │ Local           │       │
│  │ Registry        │   │ Registries      │   │ Plugins         │       │
│  │ (GitHub)        │   │ (GitHub repos)  │   │ (~/.looplia/)   │       │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘       │
│           │                     │                     │                 │
│           └──────────┬──────────┴──────────┬──────────┘                 │
│                      │                     │                            │
│                      ▼                     ▼                            │
│           ┌─────────────────────────────────────────┐                   │
│           │         Registry Compiler               │                   │
│           │   (auto-sync on every build)           │                   │
│           └─────────────────┬───────────────────────┘                   │
│                             │                                           │
│                             ▼                                           │
│           ┌─────────────────────────────────────────┐                   │
│           │     Skill Catalog (skill-catalog.json)  │                   │
│           │  ~/.looplia/registry/skill-catalog.json │                   │
│           └─────────────────┬───────────────────────┘                   │
│                             │                                           │
│              ┌──────────────┼──────────────┐                            │
│              │              │              │                            │
│              ▼              ▼              ▼                            │
│      ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│      │ build cmd  │  │ skill cmd  │  │  run cmd   │                    │
│      │ (search)   │  │ (install)  │  │ (load)     │                    │
│      └────────────┘  └────────────┘  └────────────┘                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

**Build Command (Workflow Generation):**
```
1. User: looplia build "analyze videos and generate report"
2. registry-loader skill syncs from all sources
3. skill-capability-matcher searches skill catalog
4. workflow-schema-composer generates workflow with skills: declaration
5. Output: workflow with explicit skill dependencies
```

**Run Command (Workflow Execution):**
```
1. User: looplia run my-workflow --file content.md
2. Parse workflow → extract skills: [media-reviewer, idea-synthesis]
3. Check installation status in skill catalog
4. JIT install missing skills (third-party: git clone)
5. Build selective plugin paths (core + required only)
6. Execute with filtered plugins
```

### 3.3 Skill Source Types

| Source Type | Location | Installation Strategy |
|-------------|----------|----------------------|
| **builtin** | Bundled with looplia | Already in `~/.looplia/looplia-*` |
| **thirdparty** | GitHub repos | Git clone to `~/.looplia/plugins/{repo}/` |
| **local** | User's local folders | Direct path reference |

---

## 4. Registry Schema Design

### 4.1 Remote Registry Manifest

**Location:** `https://github.com/memorysaver/looplia-core/releases/latest/download/registry.json`

```typescript
// packages/core/src/domain/registry.ts

/**
 * Remote registry manifest (hosted on GitHub releases)
 * Similar to shadcn/ui's registry.json
 */
export type RemoteRegistryManifest = {
  /** Schema version for compatibility checking */
  $schema: string;  // "https://looplia.com/schema/registry.json"

  /** Registry name identifier */
  name: string;  // "looplia-official"

  /** Registry homepage/repo URL */
  homepage: string;  // "https://github.com/memorysaver/looplia-core"

  /** Semantic version of registry */
  version: string;  // "0.7.0"

  /** When registry was last updated */
  updatedAt: string;  // ISO timestamp

  /** Available skills in this registry */
  items: RegistrySkillItem[];
};

/**
 * Single skill entry in registry manifest
 */
export type RegistrySkillItem = {
  /** Unique skill identifier (kebab-case) */
  name: string;  // "media-reviewer"

  /** Skill type classification */
  type: "registry:skill";

  /** Human-readable title */
  title: string;  // "Media Reviewer"

  /** Skill description (from SKILL.md frontmatter) */
  description: string;

  /** Author or plugin source */
  author: string;  // "looplia-writer"

  /** Plugin this skill belongs to */
  plugin: string;  // "looplia-writer"

  /** Skill category for filtering */
  category: SkillCategory;

  /** Inferred capabilities (from pattern matching) */
  capabilities: string[];

  /** Tools this skill uses (from SKILL.md tools: field) */
  tools?: string[];

  /** Model override if specified */
  model?: string;

  /** Whether skill can run without input files */
  inputless?: boolean;

  /** Dependencies on other skills */
  registryDependencies?: string[];

  /** Remote download URL for this skill */
  downloadUrl: string;

  /** SHA256 checksum for verification */
  checksum?: string;

  /** Files included in this skill */
  files: SkillFile[];
};

export type SkillCategory =
  | "analysis"       // media-reviewer, plugin-registry-scanner
  | "generation"     // idea-synthesis, writing-enhancer
  | "assembly"       // writing-kit-assembler, content-documenter
  | "validation"     // workflow-validator
  | "search"         // search
  | "orchestration"  // workflow-executor, workflow-schema-composer
  | "utility";       // id-generator, user-profile-reader

export type SkillFile = {
  /** Relative path within skill directory */
  path: string;  // "SKILL.md", "scripts/validate.ts"

  /** File type */
  type: "skill:definition" | "skill:script" | "skill:template" | "skill:schema";
};
```

### 4.2 Registry Source Configuration

**Location:** `~/.looplia/registry/sources.json`

```typescript
/**
 * Registry source types
 *
 * GitHub sources auto-detect format:
 * - marketplace.json: Used by anthropics/skills and similar repos
 * - registry.json: Standard registry format via GitHub releases
 */
export type RegistrySource = {
  /** Unique source identifier */
  id: string;  // "official", "github:user/repo"

  /** Source type */
  type: "official" | "github" | "local";

  /** URL or path */
  url: string;  // GitHub URL for third-party: "github.com/user/looplia-my-skills"

  /** Whether this source is enabled */
  enabled: boolean;

  /** Priority for deduplication (higher = preferred) */
  priority: number;

  /** When this source was added */
  addedAt: string;  // ISO timestamp
};
```

**Source Types:**

| Type | Description | Example |
|------|-------------|---------|
| `official` | Official looplia registry | GitHub Releases URL |
| `github` | Third-party GitHub repo | `github.com/user/my-plugin` |
| `local` | Local filesystem path | `/path/to/plugins` |

**GitHub Source Auto-Detection:**

GitHub sources automatically detect the registry format by trying in order:

1. **marketplace.json**: First tries `.claude-plugin/marketplace.json` (used by anthropics/skills and similar repos)
2. **registry.json**: Falls back to `releases/latest/download/registry.json` (standard format)

**Marketplace Format Example:**

Repos using marketplace.json format (like `github.com/anthropics/skills`):

```json
{
  "name": "anthropic-agent-skills",
  "plugins": [
    {
      "name": "document-skills",
      "description": "Document processing suite",
      "skills": ["./skills/xlsx", "./skills/docx", "./skills/pdf"]
    }
  ]
}
```

Skills from marketplace.json repos are indexed with `skillPath` for selective JIT installation.

### 4.3 Skill Catalog

**Location:** `~/.looplia/registry/skill-catalog.json`

```typescript
/**
 * Local skill catalog - aggregated from all sources
 * Used by build command for skill discovery
 */
export type SkillCatalog = {
  /** When this cache was compiled */
  compiledAt: string;  // ISO timestamp

  /** Version of registry format */
  version: string;  // "1.0.0"

  /** Sources that were compiled */
  sources: RegistrySource[];

  /** All skills from all sources (deduplicated) */
  skills: CompiledSkill[];

  /** Summary statistics */
  summary: {
    totalSkills: number;
    byCategory: Record<SkillCategory, number>;
    bySource: Record<string, number>;
  };
};

/**
 * Compiled skill entry - enriched with local installation status
 */
export type CompiledSkill = {
  /** Unique skill name */
  name: string;

  /** Display title */
  title: string;

  /** Skill description */
  description: string;

  /** Plugin source */
  plugin: string;

  /** Category */
  category: SkillCategory;

  /** Capabilities for matching */
  capabilities: string[];

  /** Tools used */
  tools?: string[];

  /** Model override */
  model?: string;

  /** Input-less capable */
  inputless?: boolean;

  /** Source registry ID */
  source: string;  // "official", "github:user/repo"

  /** Determines installation strategy */
  sourceType: "builtin" | "thirdparty";

  /** Whether installed locally */
  installed: boolean;

  /** Local installation path if installed */
  installedPath?: string;

  /** Remote git URL for third-party */
  gitUrl?: string;

  /** Path within repo (for selective JIT installation from marketplace.json repos) */
  skillPath?: string;  // "./skills/xlsx" - used by github sources with marketplace.json

  /** Checksum for integrity */
  checksum?: string;

  /** Dependencies */
  dependencies?: string[];
};
```

### 4.4 Workflow Skills Declaration

**Extended WorkflowDefinition (v0.7.0):**

```typescript
// packages/core/src/domain/workflow.ts

export type WorkflowDefinition = {
  name: string;
  version?: string;
  description: string;

  /**
   * v0.7.0: Explicit skills declaration
   * Lists all skills required to run this workflow
   * Used for selective plugin loading at runtime
   */
  skills?: string[];  // ["media-reviewer", "idea-synthesis", "writing-kit-assembler"]

  /**
   * v0.6.3: Named inputs declaration
   */
  inputs?: WorkflowInput[];

  steps: WorkflowStep[];
};
```

**Example workflow with skills declaration:**

```yaml
---
name: writing-kit
version: 1.2.0
description: Transform content into structured writing kit

# v0.7.0: Explicit skill requirements
skills:
  - media-reviewer
  - idea-synthesis
  - writing-kit-assembler

steps:
  - id: summary
    skill: media-reviewer
    mission: Analyze the input content for structure and key themes
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json

  - id: ideas
    skill: idea-synthesis
    mission: Generate content ideas based on the analysis
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json
    needs: [summary]

  - id: kit
    skill: writing-kit-assembler
    mission: Assemble the final writing kit
    input:
      - ${{ steps.summary.output }}
      - ${{ steps.ideas.output }}
    output: ${{ sandbox }}/outputs/writing-kit.json
    needs: [summary, ideas]
    final: true
---
```

---

## 5. CLI Commands

### 5.1 Registry Commands

**File:** `apps/cli/src/commands/registry.ts`

```
looplia registry <subcommand> [options]

Subcommands:
  init              Initialize local registry with official source
  add <url>         Add GitHub registry source (auto-detects format)
  sync              Compile from all sources (auto-runs on build)
  list              List configured sources and stats
  remove <id>       Remove a registry source

Options:
  --force, -f       Force reinitialization (for init)
  --help, -h        Show this help

Examples:
  looplia registry init
  looplia registry add github.com/anthropics/skills
  looplia registry sync
  looplia registry list
  looplia registry remove github:anthropics/skills
```

**Implementation:**

```typescript
// apps/cli/src/commands/registry.ts

export type RegistryArgs = {
  subcommand: "init" | "add" | "sync" | "list" | "remove";
  source?: string;
  sourceId?: string;
  force?: boolean;
  help: boolean;
};

export async function runRegistryCommand(args: string[]): Promise<void>;

// Sub-commands
async function registryInit(force: boolean): Promise<void> {
  // 1. Create ~/.looplia/registry/ directory
  // 2. Add official source to sources.json
  // 3. Run initial sync
}

async function registryAdd(sourceUrl: string): Promise<void> {
  // 1. Validate URL format (github.com/user/repo)
  // 2. Add to sources.json with unique ID
  // 3. Run sync to fetch skills
}

async function registrySync(): Promise<void> {
  // 1. Fetch remote registries
  // 2. Scan local plugins
  // 3. Merge and deduplicate
  // 4. Write skill-catalog.json
}

async function registryList(): Promise<void> {
  // 1. Read sources.json
  // 2. Read skill-catalog.json for stats
  // 3. Display formatted table
}

async function registryRemove(sourceId: string): Promise<void> {
  // 1. Remove from sources.json
  // 2. Re-run sync
}
```

### 5.2 Skill Commands

**File:** `apps/cli/src/commands/skill.ts`

```
looplia skill <subcommand> [options]

Subcommands:
  add <name>        Install skill to workspace
  list              List installed/available skills
  info <name>       Show skill details
  remove <name>     Remove skill from workspace
  update <name>     Update third-party skill (git pull)

Options:
  --from <source>   Install from specific source
  --available       Show all skills from all sources
  --installed       Show only installed skills

Examples:
  looplia skill add media-reviewer
  looplia skill add custom-analyzer --from github:user/repo
  looplia skill list
  looplia skill list --available
  looplia skill info media-reviewer
  looplia skill remove custom-analyzer
  looplia skill update custom-analyzer
```

**Implementation:**

```typescript
// apps/cli/src/commands/skill.ts

export type SkillArgs = {
  subcommand: "add" | "list" | "info" | "remove" | "update";
  skillName?: string;
  from?: string;
  installed?: boolean;
  available?: boolean;
  help: boolean;
};

export async function runSkillCommand(args: string[]): Promise<void>;

async function skillAdd(name: string, from?: string): Promise<void> {
  // 1. Load skill catalog
  // 2. Find skill by name (optionally filter by source)
  // 3. Determine installation strategy:
  //    - builtin: Already in bundle, just verify
  //    - thirdparty: Git clone to ~/.looplia/plugins/
  // 4. Update catalog with installation status
}

async function skillList(options: { installed?: boolean; available?: boolean }): Promise<void> {
  // 1. Load skill catalog
  // 2. Filter by installed/available
  // 3. Display formatted table
}

async function skillInfo(name: string): Promise<void> {
  // 1. Find skill in registry
  // 2. Display detailed info (description, tools, capabilities, etc.)
}

async function skillRemove(name: string): Promise<void> {
  // 1. Check if skill is from third-party source
  // 2. Remove from ~/.looplia/plugins/
  // 3. Update registry
}

async function skillUpdate(name: string): Promise<void> {
  // 1. Find skill in registry
  // 2. If thirdparty: git pull in plugin directory
  // 3. Re-scan and update registry
}
```

---

## 6. Build Integration

### 6.1 Enhanced Build Flow

**Current Flow (v0.6.x):**
```
plugin-registry-scanner → skill-capability-matcher → workflow-schema-composer
      (runtime scan)
```

**New Flow (v0.7.0):**
```
registry-loader → skill-capability-matcher → workflow-schema-composer
(compiled cache)   (enhanced: installed status)  (adds skills: field)
```

### 6.2 Registry Loader Skill

**File:** `plugins/looplia-core/skills/registry-loader/SKILL.md`

```yaml
---
name: registry-loader
description: |
  Load the compiled skill registry for workflow building.
  Auto-syncs from all sources on every build (per design decision).
  Returns unified skill catalog for capability matching.
model: claude-haiku-4-5-20251001
---

# Registry Loader

## Purpose
Provides fast access to skill catalog for the build pipeline.

## Behavior
1. Sync registry from all configured sources (official + third-party)
2. Compile into unified format at ~/.looplia/registry/skill-catalog.json
3. Return catalog data for skill-capability-matcher

## Output Format
Same as SkillCatalog type - skills array with installation status.
```

### 6.3 Enhanced Skill Capability Matcher

Updates to `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md`:

- Accept skill catalog format (not just runtime scan format)
- Include `installed` status in recommendations
- Flag skills that need installation

### 6.4 Enhanced Workflow Schema Composer

Updates to `plugins/looplia-core/skills/workflow-schema-composer/SKILL.md`:

- Generate `skills:` field in workflow frontmatter
- Extract unique skills from step recommendations

```typescript
// Logic for skills extraction
function extractSkillsFromRecommendations(
  recommendations: SkillRecommendation[]
): string[] {
  const skills = new Set<string>();
  for (const rec of recommendations) {
    skills.add(rec.skill);
  }
  return [...skills];
}
```

---

## 7. Selective Plugin Loading

### 7.1 Core Skills

Skills that are always loaded regardless of workflow:

```typescript
// packages/provider/src/bootstrap/skill-installer.ts

export const CORE_SKILLS = [
  "workflow-executor",
  "workflow-executor-inline",
  "workflow-validator",
  "registry-loader",
];
```

### 7.2 Selective Plugin Paths

**File:** `packages/provider/src/bootstrap/skill-installer.ts`

```typescript
/**
 * Get plugin paths with selective skill loading
 *
 * @param requiredSkills - Skills required by the workflow
 * @returns Plugin paths filtered to only include required skills
 */
export async function getSelectivePluginPaths(
  requiredSkills?: string[]
): Promise<Array<{ type: "local"; path: string }>> {
  const allPluginPaths = await getPluginPaths();

  if (!requiredSkills || requiredSkills.length === 0) {
    // No filtering - load all (backward compatibility)
    return allPluginPaths;
  }

  // Combine core skills with required skills
  const neededSkills = new Set([...CORE_SKILLS, ...requiredSkills]);

  // Build skill-to-plugin mapping
  const skillToPlugin = await buildSkillPluginMap(allPluginPaths);

  // Determine which plugins to load
  const pluginsToLoad = new Set<string>();
  for (const skill of neededSkills) {
    const pluginPath = skillToPlugin.get(skill);
    if (pluginPath) {
      pluginsToLoad.add(pluginPath);
    }
  }

  // Return filtered plugin paths
  return allPluginPaths.filter(p => pluginsToLoad.has(p.path));
}

/**
 * Build mapping of skill name to plugin path
 */
async function buildSkillPluginMap(
  pluginPaths: Array<{ type: "local"; path: string }>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const { path: pluginPath } of pluginPaths) {
    const skillsDir = join(pluginPath, "skills");
    if (!await pathExists(skillsDir)) continue;

    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        map.set(entry.name, pluginPath);
      }
    }
  }

  return map;
}
```

### 7.3 Third-party Plugin Installation

The installation system supports two paths to ensure all installed skills comply with Claude Code plugin structure:

#### Installation Strategy

| Priority | Detection | Action |
|----------|-----------|--------|
| 1. Standard Plugin | `.claude-plugin/plugin.json` or `marketplace.json` exists | Clone directly to `~/.looplia/plugins/` |
| 2. Auto-Wrap Fallback | No plugin structure, but SKILL.md found | Wrap as plugin with generated plugin.json |

**Note:** Both `plugin.json` and `marketplace.json` formats are supported. The `marketplace.json` format is used by Anthropic's official skills marketplace (github.com/anthropics/skills).

#### Why Always Plugin Structure?

The `query-executor` uses Claude Agent SDK's plugin loading system. All plugins in `~/.looplia/plugins/` must have valid structure:

```
~/.looplia/plugins/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json          # Required for query-executor
└── skills/
    └── {skill-name}/
        └── SKILL.md
```

#### Detection Functions

```typescript
/**
 * Check if repository has valid Claude Code plugin structure
 * Supports both plugin.json and marketplace.json formats
 */
async function isValidPluginStructure(repoPath: string): Promise<boolean> {
  const claudePluginDir = join(repoPath, ".claude-plugin");

  // Check for plugin.json (standard format)
  if (await pathExists(join(claudePluginDir, "plugin.json"))) {
    return true;
  }

  // Check for marketplace.json (Anthropic marketplace format)
  if (await pathExists(join(claudePluginDir, "marketplace.json"))) {
    return true;
  }

  return false;
}

/**
 * Find SKILL.md location in repository (recursive search)
 */
async function findSkillMdPath(repoPath: string): Promise<string | null> {
  // Search recursively for SKILL.md
  // Return the directory containing SKILL.md
  // e.g., "repo/some/path/my-skill" if SKILL.md is at "repo/some/path/my-skill/SKILL.md"
}

/**
 * Extract skill name from SKILL.md frontmatter
 */
async function extractSkillName(skillMdDir: string): Promise<string> {
  const content = await readFile(join(skillMdDir, "SKILL.md"), "utf-8");
  const frontmatter = parseFrontmatter(content);
  return frontmatter.name ?? basename(skillMdDir);
}
```

#### Auto-Wrap Function

```typescript
/**
 * Wrap a standalone skill as a valid Claude Code plugin
 */
async function wrapSkillAsPlugin(
  skillPath: string,      // Path to folder containing SKILL.md
  skillName: string,      // Extracted skill name
  targetPath: string,     // ~/.looplia/plugins/{skill-name}/
  originalUrl: string     // For tracking source
): Promise<void> {
  // 1. Create plugin directory structure
  await mkdir(join(targetPath, ".claude-plugin"), { recursive: true });
  await mkdir(join(targetPath, "skills", skillName), { recursive: true });

  // 2. Copy skill contents (everything at SKILL.md level)
  await cp(skillPath, join(targetPath, "skills", skillName), { recursive: true });

  // 3. Generate plugin.json
  const pluginJson = {
    name: skillName,
    version: "1.0.0",
    description: `Auto-wrapped skill from ${originalUrl}`,
    source: {
      type: "auto-wrapped",
      originalUrl: originalUrl,
      wrappedAt: new Date().toISOString()
    }
  };
  await writeFile(
    join(targetPath, ".claude-plugin", "plugin.json"),
    JSON.stringify(pluginJson, null, 2)
  );
}
```

#### Main Installation Function

```typescript
/**
 * Install a third-party plugin from git
 * Supports both full plugins and standalone skills (auto-wrapped)
 */
export async function installThirdPartyPlugin(
  workspace: string,
  gitUrl: string,  // e.g., "github.com/user/looplia-my-skills"
  skillName?: string
): Promise<InstallResult> {
  const pluginsDir = join(workspace, "plugins");
  await mkdir(pluginsDir, { recursive: true });

  // 1. Clone to temp directory first
  const tempPath = join(tmpdir(), `looplia-install-${Date.now()}`);
  const fullUrl = `https://${gitUrl}`;
  await execAsync(`git clone ${fullUrl} "${tempPath}"`);

  // 2. Check if valid plugin structure (Priority 1)
  if (await isValidPluginStructure(tempPath)) {
    const repoName = gitUrl.split("/").slice(-1)[0];
    const targetPath = join(pluginsDir, repoName);

    if (await pathExists(targetPath)) {
      // Already exists - update via git pull
      await rm(tempPath, { recursive: true });
      await execAsync("git pull", { cwd: targetPath });
      return { skill: skillName ?? repoName, status: "updated", path: targetPath };
    }

    // Move to plugins directory
    await rename(tempPath, targetPath);
    return { skill: skillName ?? repoName, status: "installed", path: targetPath };
  }

  // 3. Fallback: Find SKILL.md and auto-wrap (Priority 2)
  const skillMdDir = await findSkillMdPath(tempPath);
  if (!skillMdDir) {
    await rm(tempPath, { recursive: true });
    return {
      skill: skillName ?? "unknown",
      status: "failed",
      error: "No .claude-plugin/plugin.json or SKILL.md found in repository"
    };
  }

  // 4. Extract skill name and auto-wrap
  const extractedName = await extractSkillName(skillMdDir);
  const targetPath = join(pluginsDir, extractedName);

  if (await pathExists(targetPath)) {
    await rm(tempPath, { recursive: true });
    return { skill: extractedName, status: "already_installed", path: targetPath };
  }

  await wrapSkillAsPlugin(skillMdDir, extractedName, targetPath, gitUrl);

  // 5. Cleanup temp
  await rm(tempPath, { recursive: true });

  return { skill: extractedName, status: "installed", path: targetPath };
}
```

#### Installation Examples

**Example 1: Standard Plugin Repository**
```
Input:  github.com/user/my-plugin/
        ├── .claude-plugin/plugin.json  ✓ Valid plugin
        └── skills/analyzer/SKILL.md

Result: ~/.looplia/plugins/my-plugin/  (cloned directly)
```

**Example 2: Skill-Only Repository**
```
Input:  github.com/user/my-skill/
        ├── SKILL.md                    ✗ No plugin.json
        ├── templates/
        └── scripts/

Result: ~/.looplia/plugins/my-skill/   (auto-wrapped)
        ├── .claude-plugin/plugin.json  ← Generated
        └── skills/my-skill/
            ├── SKILL.md                ← Copied
            ├── templates/
            └── scripts/
```

**Example 3: Skill in Subfolder**
```
Input:  github.com/user/repo/tools/my-skill/SKILL.md

Result: ~/.looplia/plugins/my-skill/   (auto-wrapped)
        ├── .claude-plugin/plugin.json  ← Generated
        └── skills/my-skill/
            └── (contents from tools/my-skill/)
```

#### Edge Cases

| Case | Handling |
|------|----------|
| Multiple SKILL.md in repo | Use first found at shallowest depth |
| SKILL.md at repo root | Wrap root contents as skill |
| No SKILL.md found | Return error with helpful message |
| Existing plugin with same name | Return `already_installed` status |

---

## 8. Run Command Enhancement

### 8.1 Enhanced Flow

**File:** `apps/cli/src/commands/run.ts`

```typescript
export async function runRunCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  // ... help handling

  try {
    // 1. Ensure workspace
    const workspace = ensureWorkspace(parsed.mock);

    // 2. Parse workflow to get required skills
    const workflowPath = join(workspace, "workflows", `${parsed.workflowId}.md`);
    const content = await readFile(workflowPath, "utf-8");
    const workflow = parseWorkflow(content);
    const requiredSkills = extractWorkflowSkills(workflow);

    // 3. Load skill catalog
    const catalog = await loadSkillCatalog(workspace);

    // 4. NEW (v0.7.0): Just-in-time skill installation
    const installResult = await ensureWorkflowSkills(
      workspace,
      workflow,
      catalog
    );

    if (!installResult.ready) {
      console.error(`Failed to install required skills: ${installResult.failed.join(", ")}`);
      process.exit(1);
    }

    // 5. Create sandbox and resolve inputs
    const allowInputless = isInputlessWorkflow(workflow.definition);
    const sandboxId = resolveSandboxId(workspace, parsed, allowInputless);

    // 6. Initialize command environment with SELECTIVE plugin loading
    await initializeCommandEnvironment({
      mock: parsed.mock,
      requiredSkills,  // NEW: pass required skills
    });

    // 7. Build /run prompt and execute
    const prompt = buildRunPrompt(parsed.workflowId, sandboxId);
    const result = await executeWorkflow(prompt, workspace, parsed.workflowId, parsed);

    // 8. Render result
    renderResult(result);
    // ...
  }
}
```

### 8.2 Skills Extraction

**File:** `packages/core/src/domain/workflow-parser.ts`

```typescript
/**
 * Extract skills from workflow definition
 * Uses explicit declaration if available, otherwise derives from steps
 */
export function extractWorkflowSkills(workflow: ParsedWorkflow): string[] {
  // Explicit declaration takes priority (v0.7.0)
  if (workflow.definition.skills && workflow.definition.skills.length > 0) {
    return workflow.definition.skills;
  }

  // Fallback: derive from steps (backward compatibility)
  const skills = new Set<string>();
  for (const step of workflow.definition.steps) {
    if (step.skill) {
      skills.add(step.skill);
    }
  }
  return [...skills];
}
```

### 8.3 Just-in-Time Installation

```typescript
/**
 * Ensure all workflow skills are installed before execution
 */
export async function ensureWorkflowSkills(
  workspace: string,
  workflow: ParsedWorkflow,
  catalog: SkillCatalog
): Promise<{
  ready: boolean;
  installed: InstallResult[];
  failed: string[];
}> {
  const requiredSkills = extractWorkflowSkills(workflow);
  const installed: InstallResult[] = [];
  const failed: string[] = [];

  for (const skillName of requiredSkills) {
    const skill = catalog.skills.find(s => s.name === skillName);

    if (!skill) {
      failed.push(skillName);
      continue;
    }

    if (skill.installed) {
      continue;  // Already installed
    }

    if (skill.sourceType === "builtin") {
      // Built-in skills should always be installed
      failed.push(skillName);
      continue;
    }

    // Third-party skill - install from git
    if (skill.gitUrl) {
      const result = await installThirdPartyPlugin(workspace, skill.gitUrl, skillName);
      installed.push(result);
    } else {
      failed.push(skillName);
    }
  }

  return {
    ready: failed.length === 0,
    installed,
    failed,
  };
}
```

---

## 9. Directory Structure

### 9.1 Workspace Layout

```
~/.looplia/
├── registry/                           # NEW: Registry system
│   ├── skill-catalog.json              # Skill catalog (aggregated from all sources)
│   ├── sources.json                    # Configured sources
│   └── cache/                          # Downloaded registry caches per source
│       └── looplia-official/           # Cached remote registry
│
├── looplia-core/                       # Built-in core plugin (from bundle)
│   ├── .claude-plugin/
│   │   └── plugin.json
│   └── skills/
│       ├── workflow-executor/
│       ├── workflow-validator/
│       ├── registry-loader/            # NEW: v0.7.0
│       └── ...
│
├── looplia-writer/                     # Built-in writer plugin (from bundle)
│   └── skills/
│       ├── media-reviewer/
│       ├── idea-synthesis/
│       └── ...
│
├── plugins/                            # NEW: Third-party plugins (live cloned)
│   ├── user-looplia-my-skills/         # e.g., from github.com/user/looplia-my-skills
│   │   ├── .claude-plugin/
│   │   └── skills/
│   └── another-repo/
│
├── sandbox/                            # Execution sandboxes (existing)
│   └── {sandboxId}/
│
├── workflows/                          # Workflow definitions (existing)
│   └── *.md
│
├── looplia.setting.json                # Provider configuration (existing)
└── user-profile.json                   # User settings (existing)
```

### 9.2 GitHub Release Assets

```
releases/v0.7.0/
├── registry.json                       # Full registry manifest
├── registry.json.sha256                # Checksum
├── plugins.tar.gz                      # Full bundle (existing)
├── plugins.tar.gz.sha256               # Checksum (existing)
└── skills/                             # Individual skill downloads (optional)
    ├── media-reviewer.tar.gz
    └── ...
```

---

## 10. Implementation Plan

### Phase 1: Core Types & Registry Schema

1. Create `packages/core/src/domain/registry.ts` with all type definitions
2. Extend `packages/core/src/domain/workflow.ts` with `skills` field
3. Update `packages/core/src/domain/workflow-parser.ts` to parse `skills` field

### Phase 2: Registry Compiler

1. Create `packages/provider/src/registry/compiler.ts`
2. Create `packages/provider/src/registry/loader.ts`
3. Implement registry sync logic

### Phase 3: CLI Commands

1. Create `apps/cli/src/commands/registry.ts`
2. Create `apps/cli/src/commands/skill.ts`
3. Update `apps/cli/src/index.ts` for command routing

### Phase 4: Build Integration

1. Create `plugins/looplia-core/skills/registry-loader/SKILL.md`
2. Update `skill-capability-matcher` skill
3. Update `workflow-schema-composer` skill

### Phase 5: Selective Loading

1. Create `packages/provider/src/bootstrap/skill-installer.ts`
2. Update `packages/provider/src/bootstrap/index.ts`
3. Update `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts`

### Phase 6: Run Enhancement

1. Update `apps/cli/src/commands/run.ts`
2. Add JIT installation logic
3. Pass `requiredSkills` to executor

### Phase 7: Release Scripts

1. Create `scripts/build-registry.ts`
2. Update CI/CD for registry generation

---

## 11. Migration & Backward Compatibility

### 11.1 Compatibility Matrix

| Workflow Version | Registry Available | Behavior |
|------------------|-------------------|----------|
| No `skills:` field | v0.7.0 | Derive from steps, load all plugins |
| `skills:` field | v0.7.0 | Use declaration, selective loading |
| `skills:` field | < v0.7.0 | Field ignored, load all plugins |

### 11.2 Backward Compatibility Guarantees

1. **Workflows without `skills:` field**: Derive skills from `steps[].skill`
2. **Build without skill catalog**: Fallback to `plugin-registry-scanner`
3. **Run without selective loading**: Load all plugins (existing behavior)

### 11.3 Deprecation Notes

The following are candidates for deprecation in future versions:

| Component | Status | Replacement |
|-----------|--------|-------------|
| `plugin-registry-scanner` (runtime) | Soft deprecated | `registry-loader` (compiled) |
| Full plugin loading | Replaced | Selective loading |

---

## 12. File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `packages/core/src/domain/registry.ts` | Registry type definitions |
| `packages/provider/src/registry/compiler.ts` | Registry compilation |
| `packages/provider/src/registry/loader.ts` | Registry loading |
| `packages/provider/src/bootstrap/skill-installer.ts` | JIT installation |
| `apps/cli/src/commands/registry.ts` | Registry CLI |
| `apps/cli/src/commands/skill.ts` | Skill CLI |
| `plugins/looplia-core/skills/registry-loader/SKILL.md` | Registry loading skill |
| `scripts/build-registry.ts` | Release artifact builder |

### Modified Files

| File | Changes |
|------|---------|
| `packages/core/src/domain/workflow.ts` | Add `skills` field |
| `packages/core/src/domain/workflow-parser.ts` | Parse `skills` field |
| `packages/provider/src/bootstrap/index.ts` | Selective plugin loading |
| `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts` | Accept `requiredSkills` |
| `apps/cli/src/commands/run.ts` | Skills parsing & JIT |
| `apps/cli/src/index.ts` | Command routing |
| `plugins/looplia-core/skills/skill-capability-matcher/SKILL.md` | Skill catalog support |
| `plugins/looplia-core/skills/workflow-schema-composer/SKILL.md` | Generate `skills:` field |

---

## Summary

v0.7.0 introduces a comprehensive skill registry system inspired by shadcn/ui's approach. The system enables:

1. **Discovery**: Remote registry on GitHub Releases + third-party sources
2. **Installation**: `looplia skill add` for on-demand skill installation
3. **Selective Loading**: Workflows declare skills → only those are loaded
4. **Third-party Support**: Live git clone for community plugins

**Key architectural insight:** Separating skill discovery (registry) from skill loading (runtime) enables both better developer experience and improved runtime performance.
