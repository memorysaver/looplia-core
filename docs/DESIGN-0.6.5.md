# Looplia-Core Architecture Design v0.6.5

> **FEATURE RELEASE:** Agent SDK Local Plugin Loading Strategy
>
> **Version:** 0.6.5
> **Date:** 2025-12-26
> **Related:** [DESIGN-0.6.4.md](./DESIGN-0.6.4.md) | [AGENT-SDK.md](./AGENT-SDK.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Bootstrap Strategy](#4-bootstrap-strategy)
5. [Plugin Structure](#5-plugin-structure)
6. [System Prompt Architecture](#6-system-prompt-architecture)
7. [Query Executor Changes](#7-query-executor-changes)
8. [Bootstrap Implementation](#8-bootstrap-implementation)
9. [Command Namespace](#9-command-namespace)
10. [Hook Path Resolution](#10-hook-path-resolution)
11. [NPM Package Structure](#11-npm-package-structure)
12. [Implementation Guide](#12-implementation-guide)
13. [File Changes Summary](#13-file-changes-summary)

---

## 1. Executive Summary

### Feature Release: v0.6.4 → v0.6.5

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.4 | Interactive Build Wizard | Multi-turn TUI for clarifying workflow requirements |
| **v0.6.5** | **Plugin Loading Strategy** | **Run looplia from any directory via Agent SDK plugins** |

### What Changes in v0.6.5

v0.6.5 migrates from workspace-based configuration to the Agent SDK's local plugin loading strategy:

1. **PLUGIN STRUCTURE:** `~/.looplia` becomes a proper Agent SDK plugin with `.claude-plugin/plugin.json`
2. **SYSTEM PROMPT:** Agent behavior defined via `systemPrompt` append instead of CLAUDE.md file
3. **COMMAND NAMESPACE:** Commands auto-prefixed as `looplia:run`, `looplia:build`, etc.
4. **LOCATION INDEPENDENCE:** Users can run looplia from any directory
5. **THREE BOOTSTRAP MODES:** NPM bundle, Remote GitHub, Development

### Design Principle

> **Single Source of Truth, Multiple Distribution Methods**
>
> The `plugins/` folder in the project IS the plugin source. It gets distributed via:
> - NPM package (bundled, copied on init)
> - GitHub releases (tarball download)
> - Development mode (direct usage, no copy)

### The Shift

```
BEFORE (v0.6.4):
  # Must run from ~/.looplia or have cwd set to workspace
  cwd: "~/.looplia"
  settingSources: ["project"]  # Discovers .claude/ from cwd

AFTER (v0.6.5):
  # Run from anywhere, plugin loaded from absolute path
  cwd: process.cwd()           # User's current directory
  plugins: [{ type: "local", path: "~/.looplia" }]
  systemPrompt: { preset: "claude_code", append: loopliaSystemPrompt }

  # OR in development mode (LOOPLIA_DEV=true):
  plugins: [
    { type: "local", path: "./plugins/looplia-core" },
    { type: "local", path: "./plugins/looplia-writer" }
  ]
```

---

## 2. Problem Statement

### 2.1 The Workspace Lock-In Problem

Current (v0.6.4) architecture requires `cwd` to be the workspace directory:

```typescript
// Current implementation in query-executor.ts
const result = query({
  prompt,
  options: {
    cwd: workspace,                    // Must be ~/.looplia
    settingSources: ["project"],       // Loads from cwd/.claude/
    // ...
  },
});
```

This creates limitations:

| User Scenario | Current Behavior | Desired Behavior |
|---------------|------------------|------------------|
| Run from project dir | Commands/skills not found | Works - plugin from ~/.looplia |
| Run from /tmp | Commands/skills not found | Works - plugin from ~/.looplia |
| Use with other projects | Must symlink or copy | Works - always loads plugin |

### 2.2 The Bootstrap Complexity

Current bootstrap copies files from project to `~/.looplia`. But:

1. **NPM Distribution:** How do users get plugins after `npm install -g looplia`?
2. **Updates:** How do users update to new plugin versions?
3. **Development:** How do developers test plugin changes without reinstalling?

### 2.3 Single Source of Truth

The project's `plugins/` folder should be the authoritative source:

```
looplia-core/
├── plugins/
│   ├── looplia-core/          # Core plugin (commands, core skills, hooks)
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   ├── skills/
│   │   └── hooks/
│   └── looplia-writer/        # Domain plugin (domain skills, workflows)
│       ├── .claude-plugin/
│       │   └── plugin.json
│       └── skills/
```

---

## 3. Solution Overview

### 3.1 Three Bootstrap Modes

| Mode | Trigger | Plugin Source | Use Case |
|------|---------|---------------|----------|
| **NPM Bundle** | `looplia init` | npm package → ~/.looplia | Production users |
| **Remote** | `looplia init --remote` | GitHub release → ~/.looplia | Users without npm |
| **Development** | `LOOPLIA_DEV=true` | ./plugins directly | Developers |

### 3.2 Mode Detection Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         BOOTSTRAP MODE DETECTION                          │
└──────────────────────────────────────────────────────────────────────────┘

  looplia command invoked
         │
         ▼
  ┌──────────────────────────┐
  │ LOOPLIA_DEV=true ?       │
  └──────────┬───────────────┘
             │
     ┌───────┴───────┐
     │ YES           │ NO
     ▼               ▼
  ┌──────────┐   ┌──────────────────────────┐
  │ DEV MODE │   │ Check ~/.looplia exists? │
  │          │   └──────────┬───────────────┘
  │ Use:     │              │
  │ ./plugins│      ┌───────┴───────┐
  │ /looplia │      │ YES           │ NO
  │ -core    │      ▼               ▼
  │ ./plugins│   ┌──────────┐   ┌──────────────┐
  │ /looplia │   │ PROD     │   │ Need init    │
  │ -writer  │   │ MODE     │   │ Run:         │
  └──────────┘   │          │   │ looplia init │
                 │ Use:     │   │ or           │
                 │ ~/.loop- │   │ looplia init │
                 │ lia      │   │ --remote     │
                 └──────────┘   └──────────────┘
```

### 3.3 Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DISTRIBUTION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

  SOURCE (Single Source of Truth)
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ looplia-core/plugins/                                                    │
  │ ├── looplia-core/    # Commands, core skills, hooks                     │
  │ └── looplia-writer/  # Domain skills, workflows                         │
  └─────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │ NPM PACKAGE         │  │ GITHUB RELEASE      │  │ DEVELOPMENT         │
  │                     │  │                     │  │                     │
  │ npm publish         │  │ Release tarball     │  │ LOOPLIA_DEV=true    │
  │ Bundles plugins/    │  │ plugins.tar.gz      │  │                     │
  │ in package          │  │ in releases         │  │ Uses ./plugins      │
  │                     │  │                     │  │ directly            │
  └──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘
             │                        │                        │
             ▼                        ▼                        ▼
  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │ looplia init        │  │ looplia init        │  │ Query directly      │
  │                     │  │ --remote            │  │                     │
  │ Copies from npm     │  │ Downloads from      │  │ plugins: [          │
  │ package to          │  │ GitHub release to   │  │   ./plugins/core,   │
  │ ~/.looplia          │  │ ~/.looplia          │  │   ./plugins/writer  │
  └──────────┬──────────┘  └──────────┬──────────┘  │ ]                   │
             │                        │             └─────────────────────┘
             └────────────┬───────────┘
                          ▼
             ┌──────────────────────────┐
             │ ~/.looplia/              │
             │ (Merged single plugin)   │
             │ ├── .claude-plugin/      │
             │ ├── commands/            │
             │ ├── skills/              │
             │ ├── hooks/               │
             │ ├── workflows/           │
             │ └── ...                  │
             └──────────────────────────┘
```

### 3.4 Source as Plugin Architecture

The current project's `plugins/` folder is **already a valid Agent SDK plugin structure**. This is intentional - we use the source repository as the single source of truth.

#### Current Project Structure IS Plugin-Ready

```
looplia-core/                        # GitHub repository
├── plugins/
│   ├── looplia-core/                # ← This IS a valid Agent SDK plugin
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json          # Already exists with proper structure
│   │   ├── commands/                # /looplia:run, /looplia:build
│   │   ├── skills/                  # workflow-executor, etc.
│   │   ├── hooks/                   # hooks.json
│   │   └── scripts/                 # Hook scripts
│   │
│   └── looplia-writer/              # ← This IS a valid Agent SDK plugin
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── skills/                  # media-reviewer, etc.
│       └── workflows/               # writing-kit.md
│
├── apps/cli/                        # CLI package
├── packages/provider/               # SDK provider
└── ...
```

#### Why This Matters

1. **No Transformation Needed:** The source IS the plugin - no build step required for plugin content
2. **Immediate Development:** `LOOPLIA_DEV=true` loads plugins directly from source
3. **Version Consistency:** Plugin version in source matches release version
4. **Easy Contribution:** Contributors edit real plugins, not templates

#### Version Flow

```
Source (plugins/)          →  NPM Package        →  User Install
plugin.json: "0.6.5"          bundled as-is         ~/.looplia/
                              in package             plugin.json: "0.6.5"
                                   │
                                   ↓
                              GitHub Release
                              plugins.tar.gz
                              (merged plugin)
```

---

## 4. Bootstrap Strategy

### 4.1 Mode 1: NPM Bundle (Default)

**Trigger:** `looplia init` (after `npm install -g looplia` or `bun add -g looplia`)

**Flow:**
1. CLI detects its own package location via `import.meta.url` or `__dirname`
2. Locates bundled `plugins/` directory within npm package
3. Merges `looplia-core` + `looplia-writer` into `~/.looplia`
4. Creates combined `plugin.json` with name "looplia"

**Package Structure:**
```
node_modules/looplia/
├── dist/                    # Compiled CLI
├── plugins/                 # Bundled plugins (copied from source)
│   ├── looplia-core/
│   └── looplia-writer/
└── package.json
```

**User Experience:**
```bash
npm install -g looplia
looplia init              # Copies plugins to ~/.looplia
looplia run writing-kit   # Works from any directory
```

### 4.2 Mode 2: Remote (GitHub Release)

**Trigger:** `looplia init --remote` or `looplia init --remote v0.6.5`

**Flow:**
1. Fetch release tarball from GitHub:
   `https://github.com/memorysaver/looplia-core/releases/download/v{version}/plugins.tar.gz`
2. Extract to `~/.looplia`
3. Already merged in tarball, ready to use

**Release Tarball Contents:**
```
plugins.tar.gz
└── looplia/                 # Merged plugin (not separate core/writer)
    ├── .claude-plugin/
    │   └── plugin.json
    ├── commands/
    ├── skills/
    ├── hooks/
    ├── workflows/
    └── scripts/
```

**User Experience:**
```bash
# Without npm, just download and run
curl -fsSL https://looplia.dev/install.sh | bash
# OR manually:
looplia init --remote       # Downloads latest release
looplia init --remote v0.6.5  # Downloads specific version
```

### 4.3 Mode 3: Development

**Trigger:** `LOOPLIA_DEV=true` environment variable

**Flow:**
1. Skip ~/.looplia entirely
2. Load plugins directly from project's `plugins/` folder
3. Both `looplia-core` and `looplia-writer` loaded as separate plugins

**Why Two Plugins in Dev Mode:**
- Allows testing changes immediately without copying
- Each plugin maintains its own `plugin.json`
- Skills from both are discovered by Agent SDK

**Command Namespace in Dev Mode:**
- `looplia-core` plugin.json name should be "looplia" (not "looplia-core")
- This ensures commands are `/looplia:run` in both dev and prod

**User Experience:**
```bash
cd ~/looplia-core
export LOOPLIA_DEV=true
bun run dev                  # Start CLI in dev mode

# Edit plugins/looplia-core/skills/workflow-executor/SKILL.md
# Changes take effect immediately on next run
```

---

## 5. Plugin Structure

### 5.1 Source Structure (Single Source of Truth)

```
looplia-core/plugins/
├── looplia-core/                    # Core plugin
│   ├── .claude-plugin/
│   │   └── plugin.json              # name: "looplia" (for command namespace)
│   ├── commands/
│   │   ├── run.md                   # → /looplia:run
│   │   ├── build.md                 # → /looplia:build
│   │   ├── list-workflows.md
│   │   └── build-workflow.md
│   ├── skills/
│   │   ├── workflow-executor/
│   │   ├── workflow-validator/
│   │   ├── plugin-registry-scanner/
│   │   ├── skill-capability-matcher/
│   │   ├── workflow-schema-composer/
│   │   └── search/
│   ├── hooks/
│   │   └── hooks.json
│   └── scripts/
│       └── hooks/
│
└── looplia-writer/                  # Domain plugin
    ├── .claude-plugin/
    │   └── plugin.json              # name: "looplia-writer"
    ├── skills/
    │   ├── media-reviewer/
    │   ├── content-documenter/
    │   ├── idea-synthesis/
    │   ├── writing-enhancer/
    │   ├── user-profile-reader/
    │   ├── writing-kit-assembler/
    │   └── id-generator/
    └── workflows/
        └── writing-kit.md
```

### 5.2 Production Structure (Merged at ~/.looplia)

```
~/.looplia/                          # Single merged plugin
├── .claude-plugin/
│   └── plugin.json                  # name: "looplia", combined metadata
│
├── commands/                        # From looplia-core
│   ├── run.md
│   ├── build.md
│   ├── list-workflows.md
│   └── build-workflow.md
│
├── skills/                          # Merged from both plugins
│   ├── workflow-executor/           # From looplia-core
│   ├── workflow-validator/
│   ├── plugin-registry-scanner/
│   ├── skill-capability-matcher/
│   ├── workflow-schema-composer/
│   ├── search/
│   ├── media-reviewer/              # From looplia-writer
│   ├── content-documenter/
│   ├── idea-synthesis/
│   ├── writing-enhancer/
│   ├── user-profile-reader/
│   ├── writing-kit-assembler/
│   └── id-generator/
│
├── hooks/
│   └── hooks.json
│
├── scripts/
│   └── hooks/
│       ├── post-write-validate.sh
│       ├── stop-guard.sh
│       └── compact-inject-state.sh
│
├── workflows/                       # From looplia-writer
│   └── writing-kit.md
│
├── sandbox/                         # Runtime (created on use)
│   └── {execution-id}/
│
└── user-profile.json               # Created on init
```

### 5.3 Plugin Manifest (looplia-core)

**File:** `plugins/looplia-core/.claude-plugin/plugin.json`

```json
{
  "name": "looplia",
  "description": "Looplia workflow engine - Execute workflow-as-markdown definitions",
  "version": "0.6.5",
  "author": { "name": "Looplia" },
  "keywords": ["workflow", "agentic", "automation"],
  "homepage": "https://github.com/memorysaver/looplia-core"
}
```

**Note:** The `name` is "looplia" (not "looplia-core") to ensure commands are namespaced as `/looplia:run`.

---

## 6. System Prompt Architecture

### 6.1 From File to TypeScript Const

**Before (CLAUDE.md file):**
```
~/.looplia/CLAUDE.md              # File loaded via settingSources
```

**After (TypeScript const):**
```
packages/provider/src/claude-agent-sdk/streaming/prompts/looplia-system.ts
```

### 6.2 System Prompt Content

**File:** `packages/provider/src/claude-agent-sdk/streaming/prompts/looplia-system.ts`

```typescript
/**
 * Looplia System Prompt
 *
 * Defines the looplia workflow engine behavior.
 * Appended to claude_code preset via systemPrompt.append option.
 */
export const loopliaSystemPrompt = `
# Looplia Workflow Engine (v0.6.5)

You are a looplia workflow engine. Execute workflows by delegating to skills.

---

## Commands

| Command | Action |
|---------|--------|
| \`/looplia:run <workflow> --sandbox-id <id>\` | Use \`Skill("workflow-executor")\` |
| \`/looplia:build [description]\` | Use 3-skill pipeline (see below) |
| \`/looplia:list-workflows\` | List \`workflows/\` directory |

---

## Tool Usage Rules

### CRITICAL: No Subagents for File Operations

\`\`\`
✓ Read("workflows/writing-kit.md")
✓ Read("sandbox/{id}/validation.json")

❌ Task(general-purpose, "Read the file...")
\`\`\`

Spawning subagents for file reading wastes tokens. Use Read tool directly.

### Workflow Execution (/looplia:run)

When you receive \`/looplia:run\`:

1. Call \`Skill("workflow-executor")\` with the full command
2. workflow-executor handles ALL orchestration internally
3. Return the final result from workflow-executor

---

## Workflow Building (/looplia:build)

Use three skills in sequence:

1. \`Skill("plugin-registry-scanner")\` → Discover available skills
2. \`Skill("skill-capability-matcher")\` → Match requirements to skills
3. \`Skill("workflow-schema-composer")\` → Generate workflow file

Save generated workflow to \`workflows/{name}.md\`.

---

## Error Handling

| Error | Action |
|-------|--------|
| Workflow not found | List available workflows |
| Sandbox not found | Suggest using \`--file\` to create new sandbox |
| Skill error | Report error details from skill output |
`;
```

### 6.3 System Prompt Integration

```typescript
// In query-executor.ts
const result = query({
  prompt,
  options: {
    systemPrompt: {
      type: "preset",
      preset: "claude_code",      // Use Claude Code's base prompt
      append: loopliaSystemPrompt, // Append looplia behavior
    },
    // ...
  },
});
```

---

## 7. Query Executor Changes

### 7.1 Updated Implementation

**File:** `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts`

```typescript
import { homedir } from "node:os";
import { join } from "node:path";
import { loopliaSystemPrompt } from "./prompts/looplia-system";

/**
 * Get plugin paths based on mode
 */
function getPluginPaths(): Array<{ type: "local"; path: string }> {
  // Development mode: use project's plugins directly
  if (process.env.LOOPLIA_DEV === "true") {
    const projectRoot = process.cwd();
    return [
      { type: "local", path: join(projectRoot, "plugins", "looplia-core") },
      { type: "local", path: join(projectRoot, "plugins", "looplia-writer") },
    ];
  }

  // Production mode: use merged plugin at ~/.looplia
  return [
    { type: "local", path: join(homedir(), ".looplia") },
  ];
}

// In executeAgenticQueryStreaming():
const result = query({
  prompt,
  options: {
    model: resolvedConfig.model,
    cwd: process.cwd(),                  // User's current directory
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,

    // Load plugins based on mode
    plugins: getPluginPaths(),

    // Use claude_code preset with looplia behavior appended
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: loopliaSystemPrompt,
    },

    // REMOVED: settingSources: ["project"]

    allowedTools: [
      "Read", "Write", "Glob", "Task", "Skill", "WebSearch", "WebFetch",
    ],
    outputFormat: { type: "json_schema", schema: jsonSchema },
    agents: {
      "skill-executor": {
        description: "Universal skill orchestrator for looplia workflow steps...",
        prompt: skillExecutorPrompt,
        tools: ["Read", "Write", "Skill", "Glob", "Grep", "WebSearch", "WebFetch"],
        model: "haiku",
      },
    },
  },
});
```

### 7.2 Key Differences from v0.6.4

| Aspect | v0.6.4 | v0.6.5 |
|--------|--------|--------|
| `cwd` | `workspace` (~/.looplia) | `process.cwd()` |
| `settingSources` | `["project"]` | Removed |
| `plugins` | Not used | Mode-dependent array |
| `systemPrompt` | Not used | `{ preset, append }` |
| Dev mode | Not supported | `LOOPLIA_DEV=true` |

---

## 8. Bootstrap Implementation

### 8.1 Init Command Changes

**File:** `apps/cli/src/commands/init.ts`

```typescript
import { downloadRemotePlugins, copyBundledPlugins } from "../bootstrap";

type InitOptions = {
  remote?: boolean | string;  // --remote or --remote v0.6.5
  force?: boolean;            // --force (overwrite existing)
};

async function init(options: InitOptions): Promise<void> {
  const targetDir = join(homedir(), ".looplia");

  // Check if already initialized
  if (await pathExists(targetDir) && !options.force) {
    console.log("~/.looplia already exists. Use --force to reinitialize.");
    return;
  }

  if (options.remote) {
    // Mode 2: Download from GitHub release
    const version = typeof options.remote === "string" ? options.remote : "latest";
    await downloadRemotePlugins(version, targetDir);
  } else {
    // Mode 1: Copy from bundled npm package
    await copyBundledPlugins(targetDir);
  }

  console.log("✅ Looplia initialized at ~/.looplia");
}
```

### 8.2 Bootstrap Module

**File:** `packages/provider/src/bootstrap/index.ts`

```typescript
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Get the bundled plugins directory from the npm package
 */
function getBundledPluginsPath(): string {
  // Works for both ESM and CJS
  const currentFile = typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

  // Navigate from dist/ to package root, then to plugins/
  return join(currentFile, "..", "..", "plugins");
}

/**
 * Copy bundled plugins to target directory (merging core + writer)
 */
export async function copyBundledPlugins(targetDir: string): Promise<void> {
  const bundledPath = getBundledPluginsPath();
  const corePath = join(bundledPath, "looplia-core");
  const writerPath = join(bundledPath, "looplia-writer");

  // Clean target
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  // Create merged plugin.json
  await mkdir(join(targetDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(targetDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "looplia",
      description: "Looplia workflow engine",
      version: "0.6.5",
      author: { name: "Looplia" },
      homepage: "https://github.com/memorysaver/looplia-core"
    }, null, 2)
  );

  // Copy from looplia-core
  await cp(join(corePath, "commands"), join(targetDir, "commands"), { recursive: true });
  await cp(join(corePath, "skills"), join(targetDir, "skills"), { recursive: true });
  await cp(join(corePath, "hooks"), join(targetDir, "hooks"), { recursive: true });
  await cp(join(corePath, "scripts"), join(targetDir, "scripts"), { recursive: true });

  // Merge from looplia-writer
  await cp(join(writerPath, "skills"), join(targetDir, "skills"), { recursive: true });
  await cp(join(writerPath, "workflows"), join(targetDir, "workflows"), { recursive: true });

  // Create sandbox and user profile
  await mkdir(join(targetDir, "sandbox"), { recursive: true });
  await writeFile(
    join(targetDir, "user-profile.json"),
    JSON.stringify({
      userId: "default",
      topics: [],
      style: { tone: "intermediate", targetWordCount: 1000, voice: "first-person" }
    }, null, 2)
  );
}

/**
 * Download plugins from GitHub release
 */
export async function downloadRemotePlugins(
  version: string,
  targetDir: string
): Promise<void> {
  const releaseUrl = version === "latest"
    ? "https://github.com/memorysaver/looplia-core/releases/latest/download/plugins.tar.gz"
    : `https://github.com/memorysaver/looplia-core/releases/download/${version}/plugins.tar.gz`;

  console.log(`Downloading from ${releaseUrl}...`);

  // Clean target
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  // Download and extract
  const response = await fetch(releaseUrl);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  // Use tar to extract (assuming tar is available)
  const { execSync } = await import("node:child_process");
  const tarball = await response.arrayBuffer();
  const tarPath = join(targetDir, "plugins.tar.gz");
  await writeFile(tarPath, Buffer.from(tarball));
  execSync(`tar -xzf plugins.tar.gz -C . --strip-components=1`, { cwd: targetDir });
  await rm(tarPath);

  // Create sandbox and user profile
  await mkdir(join(targetDir, "sandbox"), { recursive: true });
  await writeFile(
    join(targetDir, "user-profile.json"),
    JSON.stringify({
      userId: "default",
      topics: [],
      style: { tone: "intermediate", targetWordCount: 1000, voice: "first-person" }
    }, null, 2)
  );
}
```

---

## 9. Command Namespace

### 9.1 Auto-Namespacing by Agent SDK

Commands are namespaced by the plugin's `name` field in `plugin.json`:

| Plugin | plugin.json name | Command Namespace |
|--------|------------------|-------------------|
| looplia-core | `"looplia"` | `/looplia:` |
| looplia-writer | `"looplia-writer"` | `/looplia-writer:` |

**Result:**

| Command File | In Dev Mode | In Production |
|--------------|-------------|---------------|
| `looplia-core/commands/run.md` | `/looplia:run` | `/looplia:run` |
| `looplia-core/commands/build.md` | `/looplia:build` | `/looplia:build` |

### 9.2 Rename Plugin

**File:** `plugins/looplia-core/.claude-plugin/plugin.json`

Change name from `"looplia-core"` to `"looplia"`:

```json
{
  "name": "looplia",          // Changed from "looplia-core"
  "description": "Looplia workflow engine - Execute workflow-as-markdown definitions",
  "version": "0.6.5"
}
```

---

## 10. Hook Path Resolution

### 10.1 How Hooks Work

Hooks use relative paths that resolve from the plugin root:

```json
{
  "command": "./scripts/hooks/post-write-validate.sh"
}
```

**In Production:**
- Plugin root: `~/.looplia`
- Resolves to: `~/.looplia/scripts/hooks/post-write-validate.sh`

**In Development:**
- Plugin root: `./plugins/looplia-core`
- Resolves to: `./plugins/looplia-core/scripts/hooks/post-write-validate.sh`

### 10.2 No Changes Needed

Hook paths work correctly in both modes since they're relative to their plugin root.

---

## 11. NPM Package Structure

### 11.1 package.json Configuration

```json
{
  "name": "looplia",
  "version": "0.6.5",
  "bin": {
    "looplia": "./dist/cli.js"
  },
  "files": [
    "dist",
    "plugins"
  ]
}
```

### 11.2 Build Pipeline

Add a build step to copy plugins into the npm package:

**File:** `apps/cli/package.json`

```json
{
  "scripts": {
    "build": "bun build ./src/cli.ts --outdir dist && bun run copy-plugins",
    "copy-plugins": "cp -r ../../plugins ./plugins"
  }
}
```

### 11.3 Release Pipeline for GitHub

**File:** `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Build CLI
        run: bun run build
        working-directory: apps/cli

      - name: Create merged plugin tarball
        run: |
          mkdir -p release/looplia/.claude-plugin

          # Create merged plugin.json with version from tag
          VERSION="${{ github.ref_name }}"
          cat > release/looplia/.claude-plugin/plugin.json << EOF
          {
            "name": "looplia",
            "description": "Looplia workflow engine",
            "version": "${VERSION#v}",
            "author": { "name": "Looplia" },
            "homepage": "https://github.com/memorysaver/looplia-core"
          }
          EOF

          # Copy from looplia-core (commands, skills, hooks, scripts)
          cp -r plugins/looplia-core/commands release/looplia/
          cp -r plugins/looplia-core/skills release/looplia/
          cp -r plugins/looplia-core/hooks release/looplia/
          cp -r plugins/looplia-core/scripts release/looplia/

          # Merge from looplia-writer (skills, workflows)
          cp -r plugins/looplia-writer/skills/* release/looplia/skills/
          cp -r plugins/looplia-writer/workflows release/looplia/

          # Create tarball
          cd release && tar -czf plugins.tar.gz looplia

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            release/plugins.tar.gz
            apps/cli/dist/cli.js
          generate_release_notes: true

      - name: Publish to NPM
        run: npm publish
        working-directory: apps/cli
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 11.4 Version Synchronization

Keep versions in sync across files:

| File | Version Field |
|------|---------------|
| `package.json` (root) | `version` |
| `apps/cli/package.json` | `version` |
| `plugins/looplia-core/.claude-plugin/plugin.json` | `version` |
| `plugins/looplia-writer/.claude-plugin/plugin.json` | `version` |

**Bump script** (`scripts/bump-version.sh`):

```bash
#!/bin/bash
VERSION=$1
# Update all version fields
jq ".version = \"$VERSION\"" package.json > tmp && mv tmp package.json
jq ".version = \"$VERSION\"" apps/cli/package.json > tmp && mv tmp apps/cli/package.json
jq ".version = \"$VERSION\"" plugins/looplia-core/.claude-plugin/plugin.json > tmp && mv tmp plugins/looplia-core/.claude-plugin/plugin.json
jq ".version = \"$VERSION\"" plugins/looplia-writer/.claude-plugin/plugin.json > tmp && mv tmp plugins/looplia-writer/.claude-plugin/plugin.json
echo "Bumped to v$VERSION"
```

---

## 12. Implementation Guide

### 12.1 Implementation Order

| Step | Task | Dependencies |
|------|------|--------------|
| 1 | Rename `looplia-core` plugin.json name to "looplia" | None |
| 2 | Create `looplia-system.ts` with system prompt const | None |
| 3 | Create `bootstrap/index.ts` with copy/download functions | None |
| 4 | Update `query-executor.ts` with `getPluginPaths()` | Steps 1-2 |
| 5 | Update `init.ts` command with --remote flag | Step 3 |
| 6 | Update `package.json` with files and copy-plugins script | None |
| 7 | Remove old `workspace.ts` bootstrap logic | Step 3 |
| 8 | Test all three modes | All above |

### 12.2 Testing Strategy

| Mode | Test Command | Expected Behavior |
|------|--------------|-------------------|
| Development | `LOOPLIA_DEV=true bun run dev` | Uses ./plugins directly |
| NPM Bundle | `looplia init && looplia run` | Copies to ~/.looplia |
| Remote | `looplia init --remote` | Downloads from GitHub |

### 12.3 Key Test Cases

1. **Dev mode loads both plugins**
   ```bash
   LOOPLIA_DEV=true looplia run writing-kit --file test.md
   # Should discover skills from both plugins
   ```

2. **Commands are namespaced correctly**
   ```bash
   # Both modes should use /looplia:run (not /looplia-core:run)
   ```

3. **Remote download works**
   ```bash
   rm -rf ~/.looplia
   looplia init --remote v0.6.5
   ls ~/.looplia/.claude-plugin/plugin.json  # Should exist
   ```

---

## 13. File Changes Summary

### 13.1 Files to Create

| File | Purpose |
|------|---------|
| `packages/provider/src/claude-agent-sdk/streaming/prompts/looplia-system.ts` | System prompt const |
| `packages/provider/src/bootstrap/index.ts` | Copy/download functions |

### 13.2 Files to Modify

| File | Changes |
|------|---------|
| `plugins/looplia-core/.claude-plugin/plugin.json` | Change name to "looplia" |
| `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts` | Add `getPluginPaths()`, `plugins`, `systemPrompt` |
| `apps/cli/src/commands/init.ts` | Add `--remote` flag, use new bootstrap |
| `apps/cli/package.json` | Add `copy-plugins` script, `files` field |

### 13.3 Files to Remove/Deprecate

| File | Reason |
|------|--------|
| `packages/provider/src/claude-agent-sdk/workspace.ts` | Replaced by `bootstrap/index.ts` |
| `plugins/looplia-core/CLAUDE.md` | Content moved to TypeScript const |

---

## Cross-References

- **Interactive Build Wizard (v0.6.4):** See [DESIGN-0.6.4.md](./DESIGN-0.6.4.md)
- **Agent SDK Documentation:** See [AGENT-SDK.md](./AGENT-SDK.md)
- **Plugin Architecture:** See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md)

---

*This document serves as the single source of truth for Looplia-Core v0.6.5 Agent SDK Local Plugin Loading Strategy architecture.*
