# E2E Test Troubleshooting Guide

Common issues and solutions for looplia E2E testing.

## API Key Issues

### Error: "API key required"

**Symptoms:**
```
Error: API key required

Options:
  1. Set ANTHROPIC_API_KEY environment variable
  2. Set ZENMUX_API_KEY with a ZenMux preset
  ...
```

**Solutions:**

1. **Set API key directly:**
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

2. **Use ZenMux (recommended for testing):**
   ```bash
   export ZENMUX_API_KEY=xxx
   looplia config provider preset ZENMUX_ZAI_GLM47
   ```

3. **Use mock mode (for testing without API):**
   ```bash
   looplia build --mock "test prompt"
   ```

### ZenMux API key not recognized

**Symptoms:**
Build command fails even though `ZENMUX_API_KEY` is set.

**Cause:**
Pre-v0.6.10 build command validated API key before loading settings.

**Solution:**
Ensure looplia CLI is version 0.6.10 or later:
```bash
looplia --version
# Should be >= 0.6.10
```

## Docker Issues

### Cannot connect to Docker daemon

**Symptoms:**
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**Solutions:**

1. **Start Docker Desktop** (macOS/Windows)

2. **Start Docker service** (Linux):
   ```bash
   sudo systemctl start docker
   ```

3. **Check Docker permissions:**
   ```bash
   sudo usermod -aG docker $USER
   # Then logout and login again
   ```

### Docker build fails

**Symptoms:**
```
ERROR: failed to solve: process "/bin/sh -c ..." did not complete successfully
```

**Solutions:**

1. **Check Dockerfile exists:**
   ```bash
   ls -la Dockerfile.cli
   ```

2. **Clean Docker cache:**
   ```bash
   docker builder prune -f
   ```

3. **Build with verbose output:**
   ```bash
   docker build -t looplia-e2e --progress=plain -f Dockerfile.cli .
   ```

### Container exits immediately

**Symptoms:**
Container starts but exits with code 1.

**Solutions:**

1. **Check container logs:**
   ```bash
   docker logs <container-id>
   ```

2. **Run interactively:**
   ```bash
   docker run -it --entrypoint /bin/bash looplia-e2e
   ```

3. **Verify API key is passed:**
   ```bash
   docker run -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY looplia-e2e
   ```

## Workflow Execution Issues

### Missing output files

**Symptoms:**
One or more output files (summary.json, ideas.json, writing-kit.json) missing.

**Solutions:**

1. **Check sandbox directory:**
   ```bash
   find ~/.looplia/sandbox -name "*.json" -type f
   ```

2. **Check logs for errors:**
   ```bash
   cat ~/.looplia/sandbox/*/logs/*.log | grep -i error
   ```

3. **Verify workflow file exists:**
   ```bash
   cat ~/.looplia/workflows/writing-kit.md
   ```

### validation.json shows steps not validated

**Symptoms:**
```json
{
  "steps": {
    "summary": { "validated": false },
    ...
  }
}
```

**Solutions:**

1. **Check for partial execution:**
   ```bash
   ls -la ~/.looplia/sandbox/*/outputs/
   ```

2. **Review execution logs:**
   ```bash
   tail -100 ~/.looplia/sandbox/*/logs/*.log
   ```

3. **Re-run with debug output:**
   ```bash
   DEBUG=* looplia run writing-kit --file content.md
   ```

### Legacy agents detected in logs

**Symptoms:**
```
"subagent_type": "content-analyzer"  # Should be "general-purpose"
```

**Cause:**
Running old version of looplia (pre-v0.6.9).

**Solution:**
Update to latest version:
```bash
bun install -g @looplia/looplia-cli@latest
looplia --version  # Should be >= 0.6.9
```

## Workspace Issues

### Plugins not found

**Symptoms:**
```
Error: Plugin looplia-core not found
```

**Solutions:**

1. **Re-initialize workspace:**
   ```bash
   rm -rf ~/.looplia
   looplia init --yes
   ```

2. **Verify plugin installation:**
   ```bash
   ls -la ~/.looplia/looplia-core/
   ls -la ~/.looplia/looplia-writer/
   ```

### Settings file corrupt

**Symptoms:**
```
SyntaxError: Unexpected token in JSON
```

**Solution:**
Remove and reconfigure:
```bash
rm ~/.looplia/looplia.setting.json
looplia config provider preset ZENMUX_ZAI_GLM47  # or your preferred preset
```

## Test Script Issues

### jq not found

**Symptoms:**
```
jq: command not found
```

**Solutions:**

**macOS:**
```bash
brew install jq
```

**Ubuntu/Debian:**
```bash
sudo apt-get install jq
```

**Alpine (Docker):**
```bash
apk add jq
```

### bun not found

**Symptoms:**
```
bun: command not found
```

**Solution:**
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or ~/.zshrc
```

## Debug Tips

### Enable verbose logging
```bash
export DEBUG=looplia:*
looplia run writing-kit --file content.md
```

### Inspect raw API responses
```bash
# Check logs for API responses
grep -A 50 '"type": "message"' ~/.looplia/sandbox/*/logs/*.log
```

### Test individual components
```bash
# Test just the build command
looplia build --mock "simple test"

# Test settings loading
looplia config provider show

# Test workspace structure
looplia doctor  # if available
```

### Compare with expected output
```bash
# Expected writing-kit.json structure
jq 'keys' ~/.looplia/sandbox/*/outputs/writing-kit.json
# Should output: ["contentId", "ideas", "suggestedOutline", "summary"]
```

## Getting Help

If issues persist:

1. Check looplia version: `looplia --version`
2. Check Node.js/Bun version: `bun --version`
3. Review full logs: `cat ~/.looplia/sandbox/*/logs/*.log`
4. Check design docs: `docs/DESIGN-0.6.10.md`
