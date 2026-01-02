#!/usr/bin/env bash
# Debug Docker E2E Test with ZenMux
# Usage: ZENMUX_API_KEY=xxx ./scripts/debug-docker-e2e.sh
#
# This script builds and runs the Docker image with debug logging enabled,
# useful for diagnosing JSON parse errors in SDK communication.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
  echo -e "${GREEN}=== $1 ===${NC}"
}

print_warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Check for API key
if [[ -z "${ZENMUX_API_KEY:-}" ]]; then
  print_error "ZENMUX_API_KEY required"
  echo ""
  echo "Usage: ZENMUX_API_KEY=xxx $0 [options]"
  echo ""
  echo "Options:"
  echo "  --skip-build    Skip Docker image build (use existing)"
  echo "  --empty-hooks   Test with empty hooks.json"
  echo "  --test-name     Test with modified plugin name"
  echo "  --workflow NAME Run specific workflow (default: hn-reporter)"
  exit 1
fi

# Parse arguments
SKIP_BUILD=false
EMPTY_HOOKS=false
TEST_NAME=false
WORKFLOW="writing-kit --file /examples/ai-healthcare.md --topics 'ai,healthcare' --tone 'expert'"

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --empty-hooks)
      EMPTY_HOOKS=true
      shift
      ;;
    --test-name)
      TEST_NAME=true
      shift
      ;;
    --workflow)
      WORKFLOW="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Create temp workspace for outputs
WORKSPACE=$(mktemp -d)
echo "Debug workspace: $WORKSPACE"

# Backup files if modifying
cleanup() {
  print_step "Cleaning up"
  if [[ -f "plugins/looplia-core/hooks/hooks.json.bak" ]]; then
    mv plugins/looplia-core/hooks/hooks.json.bak plugins/looplia-core/hooks/hooks.json
    echo "Restored hooks.json"
  fi
  if [[ -f "plugins/looplia-core/.claude-plugin/plugin.json.bak" ]]; then
    mv plugins/looplia-core/.claude-plugin/plugin.json.bak plugins/looplia-core/.claude-plugin/plugin.json
    echo "Restored plugin.json"
  fi
}
trap cleanup EXIT

# Apply test modifications
if [[ "$EMPTY_HOOKS" == "true" ]]; then
  print_step "Phase 1: Testing with empty hooks.json"
  cp plugins/looplia-core/hooks/hooks.json plugins/looplia-core/hooks/hooks.json.bak
  echo '{"$schema":"https://code.claude.com/schemas/hooks.json","hooks":[]}' > plugins/looplia-core/hooks/hooks.json
  echo "Created empty hooks.json"
fi

if [[ "$TEST_NAME" == "true" ]]; then
  print_step "Plugin Name Test: Changing looplia to looplia-workflow-engine"
  cp plugins/looplia-core/.claude-plugin/plugin.json plugins/looplia-core/.claude-plugin/plugin.json.bak
  sed -i.tmp 's/"name": "looplia"/"name": "looplia-workflow-engine"/' plugins/looplia-core/.claude-plugin/plugin.json
  rm -f plugins/looplia-core/.claude-plugin/plugin.json.tmp
  echo "Modified plugin name"
  cat plugins/looplia-core/.claude-plugin/plugin.json
fi

# Build Docker image
if [[ "$SKIP_BUILD" == "false" ]]; then
  print_step "Building project"
  bun run build

  print_step "Building Docker image"
  docker build -t looplia:debug .
else
  print_warn "Skipping build (using existing image)"
fi

# Run container with debug logging
print_step "Running with LOOPLIA_DEBUG=true"
echo "Workflow: $WORKFLOW"
echo ""

docker run \
  --rm \
  -e LOOPLIA_DEV=false \
  -e LOOPLIA_DEBUG=true \
  -e ZENMUX_API_KEY="$ZENMUX_API_KEY" \
  -v "$(pwd)/examples:/examples:ro" \
  --entrypoint /bin/sh \
  looplia:debug \
  -c "
    set -x  # Enable command tracing

    echo '=== Environment ==='
    echo \"HOME: \$HOME\"
    echo \"USER: \$(whoami)\"
    echo \"PWD: \$(pwd)\"
    echo \"PATH: \$PATH\"

    echo ''
    echo '=== Shell Startup Files (checking for output pollution) ==='
    echo '--- /etc/profile ---'
    cat /etc/profile 2>/dev/null | head -20 || echo '(not found)'
    echo '--- ~/.profile ---'
    cat ~/.profile 2>/dev/null || echo '(not found)'
    echo '--- ~/.bashrc ---'
    cat ~/.bashrc 2>/dev/null || echo '(not found)'
    echo '--- ~/.ash_profile ---'
    cat ~/.ash_profile 2>/dev/null || echo '(not found)'

    echo ''
    echo '=== SDK Version ==='
    grep -A2 claude-agent-sdk /app/package.json 2>/dev/null || echo 'Package not found'

    echo ''
    echo '=== Plugin folder names (checking for looplia string sources) ==='
    ls -la ~/.looplia/ 2>/dev/null || echo 'Not initialized yet'

    echo ''
    echo '=== Initializing ==='
    bun run /app/apps/cli/dist/cli.js init --yes

    echo ''
    echo '=== Post-init folder structure ==='
    ls -la ~/.looplia/ || echo 'Init failed'
    echo ''
    echo 'Plugins installed:'
    ls -la ~/.looplia/*/  2>/dev/null | grep -E '^d|^total' || echo 'No plugins'

    echo ''
    echo '=== Configuring ZenMux ==='
    bun run /app/apps/cli/dist/cli.js config provider preset ZENMUX_ZAI_GLM47

    echo ''
    echo '=== Config file ==='
    cat ~/.looplia/looplia.setting.json 2>/dev/null || echo 'No settings file'

    echo ''
    echo '=== Hooks file ==='
    cat ~/.looplia/looplia-core/hooks/hooks.json 2>/dev/null || echo 'No hooks file'

    echo ''
    echo '=== Plugin.json ==='
    cat ~/.looplia/looplia-core/.claude-plugin/plugin.json 2>/dev/null || echo 'No plugin.json'

    echo ''
    echo '=== Running workflow: $WORKFLOW ==='
    bun run /app/apps/cli/dist/cli.js run $WORKFLOW 2>&1 || true

    echo ''
    echo '=== DEBUG FILES ==='
    echo '--- hook-debug.log ---'
    cat ~/.looplia/hook-debug.log 2>/dev/null || echo '(empty)'
    echo ''
    echo '--- claude-code-raw.log ---'
    cat ~/.looplia/claude-code-raw.log 2>/dev/null || echo '(empty)'
    echo ''
    echo '--- sandbox contents ---'
    find ~/.looplia/sandbox -type f 2>/dev/null | head -20 || echo '(no sandbox)'

    echo ''
    echo '=== All occurrences of lowercase looplia in logs ==='
    grep -rn 'looplia' ~/.looplia/sandbox/*/logs/*.log 2>/dev/null | head -50 || echo '(no matches or no logs)'
  " 2>&1 | tee "$WORKSPACE/full-output.log"

echo ""
print_step "Results"
echo "Full output saved to: $WORKSPACE/full-output.log"
echo ""
echo "To view: less $WORKSPACE/full-output.log"
echo "To search for 'looplia': grep -i looplia $WORKSPACE/full-output.log"
