#!/usr/bin/env bash
# E2E Test Setup - Shared environment setup for all E2E tests
#
# Usage:
#   source e2e-setup.sh  # Sets up environment variables and functions
#
# Provides:
#   - TEST_WORKSPACE: Path to isolated test workspace
#   - CLI: Path to built CLI
#   - setup_test_env(): Build CLI, clean workspace, init, configure provider
#   - cleanup_test_env(): Remove test workspace

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Test workspace at project root (not ~/.looplia)
export TEST_WORKSPACE="$PROJECT_ROOT/test-workspace"
export LOOPLIA_HOME="$TEST_WORKSPACE"

# CLI path
export CLI="bun $PROJECT_ROOT/apps/cli/dist/cli.js"

# Test assets
export TEST_CONTENT="$SCRIPT_DIR/../assets/ai-healthcare.md"

# Load API key from .env
load_env() {
  if [[ -f "$PROJECT_ROOT/.env" ]]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
  fi

  # Check for API key
  if [[ -z "${ZENMUX_API_KEY:-}" ]]; then
    echo "✗ ZENMUX_API_KEY not set"
    echo "  Create .env with: ZENMUX_API_KEY=your-key"
    return 1
  fi
  echo "✓ API key loaded"
}

# Build CLI from source
build_cli() {
  echo "Building CLI..."

  # In a git worktree, node_modules symlinks resolve to the ROOT repo's packages,
  # not the worktree's packages. Rebuild the root repo's provider dist first so
  # the CLI bundle picks up any new presets or changes from the worktree source.
  local root_repo
  root_repo="$(cd "$PROJECT_ROOT/../.." 2>/dev/null && pwd)" || true
  if [[ -d "$root_repo/packages/provider" ]] && [[ "$root_repo" != "$PROJECT_ROOT" ]]; then
    echo "Rebuilding root provider (worktree node_modules share root packages)..."
    if ! (cd "$root_repo/packages/provider" && bun x tsup --silent 2>/dev/null || bun x tsup); then
      echo "✗ Root provider build failed"
      return 1
    fi
  fi

  if ! (cd "$PROJECT_ROOT" && bun run build); then
    echo "✗ Build failed"
    return 1
  fi

  # In a worktree, turbo caches the CLI against the root node_modules, so the
  # `bun run build` above may give a cache hit even though we just rebuilt the
  # root provider. Force-rebuild the CLI with tsup directly so it bundles the
  # freshly updated root provider (which now contains any new presets).
  if [[ -n "${root_repo:-}" ]] && [[ -d "$root_repo/packages/provider" ]] && [[ "$root_repo" != "$PROJECT_ROOT" ]]; then
    echo "Force-rebuilding CLI (worktree: bypass turbo cache)..."
    if ! (cd "$PROJECT_ROOT/apps/cli" && bun x tsup); then
      echo "✗ CLI rebuild failed"
      return 1
    fi
  fi
  # Populate apps/cli/plugins/ from root /plugins/ so `looplia init` can copy
  # bundled plugins. This mirrors what prepublishOnly does at npm publish time.
  # Required when running the dist CLI directly (e.g. in a git worktree) since
  # apps/cli/plugins/ is gitignored and only exists in published npm packages.
  if ! (cd "$PROJECT_ROOT/apps/cli" && bun run copy-plugins); then
    echo "✗ copy-plugins failed"
    return 1
  fi
  echo "✓ CLI built: $CLI"
}

# Clean test workspace
cleanup_test_env() {
  echo "Cleaning test workspace..."
  rm -rf "$TEST_WORKSPACE"
  echo "✓ Test workspace cleaned: $TEST_WORKSPACE"
}

# Initialize test workspace
init_test_workspace() {
  echo "Initializing test workspace..."
  mkdir -p "$TEST_WORKSPACE"

  if ! $CLI init --yes; then
    echo "✗ Init failed"
    return 1
  fi
  echo "✓ Workspace initialized: $TEST_WORKSPACE"
}

# Configure provider preset
configure_provider() {
  local preset="${1:-ZENMUX_MINIMAX_M25}"
  echo "Configuring provider preset: $preset..."

  if ! $CLI config provider preset "$preset"; then
    echo "✗ Config failed"
    return 1
  fi
  echo "✓ Provider configured: $preset"
}

# Full setup: build, clean, init, configure
setup_test_env() {
  local preset="${1:-ZENMUX_MINIMAX_M25}"

  echo "=== E2E Test Setup ==="
  echo "Project: $PROJECT_ROOT"
  echo "Workspace: $TEST_WORKSPACE"
  echo ""

  # Unset CLAUDECODE so the CLI can spawn a nested Claude Code subprocess.
  # When this script is invoked from inside a Claude Code session the variable
  # is set, which causes Claude Code to refuse to launch ("cannot be launched
  # inside another Claude Code session").
  unset CLAUDECODE

  load_env || return 1
  build_cli || return 1
  cleanup_test_env
  init_test_workspace || return 1
  configure_provider "$preset" || return 1

  echo ""
  echo "✓ Setup complete"
  echo ""
}

# Export functions for sourcing
export -f load_env build_cli cleanup_test_env init_test_workspace configure_provider setup_test_env
