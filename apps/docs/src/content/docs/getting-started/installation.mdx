---
title: Installation
description: Set up Looplia and configure your API keys to start running AI workflows.
---

import { Tabs, TabItem, Aside, Steps } from '@astrojs/starlight/components';

Get Looplia installed and configured in under 5 minutes.

## Prerequisites

- **Node.js 18+** or **Bun 1.0+**
- **Anthropic API key** (or ZenMux API key for proxy access)

## Install Looplia

<Tabs>
  <TabItem label="bun (recommended)">
```bash
bunx looplia init
```
  </TabItem>
  <TabItem label="npm">
```bash
npx looplia init
```
  </TabItem>
  <TabItem label="From Source">
```bash
# Clone the repository
git clone https://github.com/memorysaver/looplia-core.git
cd looplia-core

# Install dependencies
bun install

# Build the project
bun run build

# Initialize workspace
bun run apps/cli/dist/index.js init --yes
```
  </TabItem>
</Tabs>

The `init` command creates a workspace at `~/.looplia/` with:
- **Plugin files** — Skills and commands
- **Workflow definitions** — Ready-to-use workflows like `writing-kit`
- **Configuration** — User profile and settings

## Configure API Keys

Looplia needs an API key to access Claude. You have two options:

### Option 1: Anthropic Direct

Set your Anthropic API key as an environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
```

<Aside type="tip">
Add this to your shell profile (`~/.zshrc`, `~/.bashrc`) to persist across sessions.
</Aside>

### Option 2: ZenMux Proxy (Multi-Provider)

ZenMux provides access to multiple AI providers through a single API:

```bash
# Set the provider preset
looplia config provider preset ZENMUX_ZAI_GLM47

# Set your ZenMux API key
looplia config provider set auth-token sk-zenmux-...
```

Available presets include models from Google, OpenAI, xAI, DeepSeek, and more. See [config provider](/cli/config#provider-command) for the full list.

## Verify Installation

Run a quick test to verify everything is working:

```bash
# Check available workflows
looplia run --help

# Create a test file
echo "AI is transforming healthcare with predictive diagnostics." > test-article.md

# Run a workflow (requires API key)
looplia run writing-kit --file test-article.md
```

If successful, you'll see a streaming TUI showing the workflow progress.

## Workspace Structure

After installation, your workspace looks like this:

```
~/.looplia/
├── looplia-core/           # Infrastructure plugin
│   ├── commands/           # CLI commands
│   ├── skills/             # Workflow execution skills
│   └── hooks/              # Lifecycle hooks
├── looplia-writer/         # Domain plugin
│   └── skills/             # Content analysis skills
├── workflows/              # Workflow definitions
│   └── writing-kit.md      # Built-in writing kit workflow
├── sandbox/                # Workflow execution sandboxes
├── user-profile.json       # Your preferences
└── looplia.setting.json    # Provider configuration
```

## Next Steps

- [Quick Start](/getting-started/quick-start/) — Run your first workflow
- [Core Concepts](/getting-started/concepts/) — Understand skills and workflows
- [CLI Reference](/cli/run/) — Explore all commands
