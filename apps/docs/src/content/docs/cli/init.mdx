---
title: looplia init
description: Initialize the Looplia workspace with plugins and workflows.
---

import { Aside } from '@astrojs/starlight/components';

The `init` command sets up your Looplia workspace at `~/.looplia/` with all required plugins and workflows.

## Usage

```bash
looplia init [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--yes`, `-y` | Skip confirmation prompts |

## What It Does

The `init` command:

1. **Creates the workspace directory** at `~/.looplia/`
2. **Installs plugins** from the marketplace:
   - `looplia-core` — Infrastructure plugin with commands and executor
   - `looplia-writer` — Domain plugin with content analysis skills
3. **Extracts workflows** to `~/.looplia/workflows/`
4. **Creates configuration files** for user profile and provider settings

<Aside type="caution">
Running `init` is a **destructive refresh**. It will overwrite existing plugin files in `~/.looplia/`. Your sandbox outputs and user configuration are preserved.
</Aside>

## Examples

```bash
# Interactive initialization
looplia init

# Non-interactive (skip prompts)
looplia init --yes
```

## Workspace Structure

After initialization:

```
~/.looplia/
├── looplia-core/              # Infrastructure plugin
│   ├── .claude-plugin/
│   │   └── plugin.json        # Plugin manifest
│   ├── CLAUDE.md              # Plugin instructions
│   ├── commands/
│   │   ├── run.md             # /looplia:run command
│   │   └── build.md           # /looplia:build command
│   ├── skills/
│   │   ├── workflow-executor/
│   │   ├── workflow-validator/
│   │   └── ...
│   └── hooks/
│       └── session-logger.md
│
├── looplia-writer/            # Domain plugin
│   ├── .claude-plugin/
│   │   └── plugin.json
│   └── skills/
│       ├── media-reviewer/
│       ├── idea-synthesis/
│       └── writing-kit-assembler/
│
├── workflows/                 # Workflow definitions
│   └── writing-kit.md
│
├── sandbox/                   # Execution sandboxes (preserved)
├── user-profile.json          # User preferences (preserved)
└── looplia.setting.json       # Provider config (preserved)
```

## Re-initialization

Run `init` again to update plugins to the latest version:

```bash
# Update plugins (will overwrite existing)
looplia init --yes
```

Your sandboxes, user profile, and provider settings are **not** overwritten.

## Troubleshooting

### Permission Denied

If you see permission errors:

```bash
# Check directory permissions
ls -la ~/.looplia/

# Fix ownership if needed
sudo chown -R $(whoami) ~/.looplia/
```

### Plugin Load Errors

If plugins fail to load after init:

```bash
# Remove and reinitialize
rm -rf ~/.looplia/looplia-core ~/.looplia/looplia-writer
looplia init --yes
```

## See Also

- [Installation](/getting-started/installation/) — Full installation guide
- [run](/cli/run/) — Execute workflows
- [config](/cli/config/) — Configure settings
