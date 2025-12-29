---
title: Troubleshooting
description: Common issues and solutions when using Looplia.
---

import { Aside, Steps } from '@astrojs/starlight/components';

This page covers common issues you might encounter when using Looplia and how to resolve them.

## Installation Issues

### "Command not found: looplia"

The CLI isn't in your PATH or not installed globally.

**Solution:**

```bash
# Use bunx/npx instead of bare command
bunx looplia run writing-kit --file article.md

# Or install globally
cd looplia-core
bun link
looplia --help
```

### "Permission denied" during init

Can't write to `~/.looplia/` directory.

**Solution:**

```bash
# Check permissions
ls -la ~/.looplia/

# Fix ownership
sudo chown -R $(whoami) ~/.looplia/

# Retry
looplia init --yes
```

### Plugin load errors after init

Plugins fail to load or register.

**Solution:**

```bash
# Remove and reinitialize
rm -rf ~/.looplia/looplia-core ~/.looplia/looplia-writer
looplia init --yes
```

---

## API Key Issues

### "Missing API key" or "Authentication failed"

API key not set or invalid.

**Solution:**

<Steps>

1. Verify the key is set:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```

2. If empty, set it:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

3. For ZenMux, verify provider config:
   ```bash
   looplia config provider show
   ```

4. Set ZenMux key if needed:
   ```bash
   looplia config provider set auth-token sk-zenmux-...
   ```

</Steps>

### "Invalid API key format"

API key doesn't match expected format.

**Solution:**

- Anthropic keys start with `sk-ant-`
- ZenMux keys start with `sk-zenmux-` (or provider-specific prefix)
- Check for extra whitespace or quotes

```bash
# Correct
export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Wrong (quotes included in value)
export ANTHROPIC_API_KEY="sk-ant-api03-xxxxx"
```

---

## Workflow Execution Issues

### "Workflow not found"

The specified workflow doesn't exist.

**Solution:**

```bash
# List available workflows
ls ~/.looplia/workflows/

# Check exact name (without .md extension)
looplia run writing-kit --file article.md  # Correct
looplia run writing-kit.md --file article.md  # Wrong
```

### "File not found" for --file

Input file path is incorrect.

**Solution:**

```bash
# Use absolute path
looplia run writing-kit --file /Users/you/Documents/article.md

# Or relative to current directory
looplia run writing-kit --file ./article.md

# Check file exists
ls -la ./article.md
```

### Step validation failures

A step's output doesn't meet validation criteria.

**Solution:**

1. Check the output file:
   ```bash
   cat ~/.looplia/sandbox/*/outputs/summary.json | jq
   ```

2. View validation requirements in workflow:
   ```bash
   cat ~/.looplia/workflows/writing-kit.md
   ```

3. Resume after fixing:
   ```bash
   looplia run writing-kit --sandbox-id your-sandbox-id
   ```

### Workflow hangs or takes too long

Network issues or complex content.

**Solution:**

- Check your internet connection
- Try with simpler content first
- Use `--no-streaming` for batch mode:
  ```bash
  looplia run writing-kit --file article.md --no-streaming
  ```
- Check API status at [status.anthropic.com](https://status.anthropic.com)

---

## Sandbox Issues

### "Sandbox not found" when resuming

Invalid or deleted sandbox ID.

**Solution:**

```bash
# List available sandboxes
ls ~/.looplia/sandbox/

# Use correct ID (full name)
looplia run writing-kit --sandbox-id my-article-2025-12-28-x7km
```

### Outputs missing or incomplete

Workflow interrupted before completion.

**Solution:**

1. Check validation state:
   ```bash
   cat ~/.looplia/sandbox/*/validation.json
   ```

2. Resume from last validated step:
   ```bash
   looplia run writing-kit --sandbox-id your-sandbox-id
   ```

### Sandbox directory full

Many old sandboxes consuming disk space.

**Solution:**

```bash
# View sandbox sizes
du -sh ~/.looplia/sandbox/*

# Remove old sandboxes (careful!)
rm -rf ~/.looplia/sandbox/old-sandbox-*

# Keep only recent (last 7 days)
find ~/.looplia/sandbox -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
```

---

## Provider Issues

### ZenMux connection errors

Can't connect to ZenMux proxy.

**Solution:**

1. Verify preset is applied:
   ```bash
   looplia config provider show
   ```

2. Check API key is set:
   ```bash
   looplia config provider set auth-token sk-zenmux-...
   ```

3. Try Anthropic direct as fallback:
   ```bash
   looplia config provider preset ANTHROPIC_CLAUDE_SONNET
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

### Model not available

Specified model doesn't exist for provider.

**Solution:**

```bash
# Reset to default
looplia config provider reset

# Use a known-working preset
looplia config provider preset ANTHROPIC_CLAUDE_SONNET
```

---

## Development Mode Issues

### "Dev mode enabled but plugins not found"

`LOOPLIA_DEV_ROOT` not set correctly.

**Solution:**

```bash
# Verify path exists
ls -la $LOOPLIA_DEV_ROOT/plugins/

# Set correct path
export LOOPLIA_DEV_ROOT=/full/path/to/looplia-core

# Verify both variables
echo "DEV=$LOOPLIA_DEV, ROOT=$LOOPLIA_DEV_ROOT"
```

### Changes not taking effect in dev mode

Cached state from previous runs.

**Solution:**

```bash
# Ensure dev mode is enabled
export LOOPLIA_DEV=true

# Clear any cached state
rm -rf ~/.looplia/looplia-core ~/.looplia/looplia-writer

# Run again
looplia run writing-kit --file test.md
```

---

## Getting Help

### Debug Logging

Enable verbose output:

```bash
export LOOPLIA_DEBUG=1
looplia run writing-kit --file test.md
```

Check logs:

```bash
cat ~/.looplia/sandbox/*/logs/session.log
ls ~/.looplia/logs/
```

### Report an Issue

If you can't resolve the issue:

1. Gather diagnostic info:
   ```bash
   looplia --version
   cat ~/.looplia/looplia.setting.json
   ls ~/.looplia/
   ```

2. Open an issue at [GitHub Issues](https://github.com/memorysaver/looplia-core/issues)

3. Include:
   - Command you ran
   - Error message
   - Relevant logs
   - Environment (OS, Node/Bun version)

## See Also

- [Installation](/getting-started/installation/) — Setup guide
- [Environment Variables](/reference/environment-variables/) — Configuration reference
- [CLI Commands](/cli/run/) — Command reference
