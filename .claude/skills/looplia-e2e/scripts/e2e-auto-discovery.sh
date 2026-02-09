#!/usr/bin/env bash
# E2E Test: Auto-Discovery (v0.8.0)
#
# Tests skill auto-discovery during `looplia build`:
# 1. Build command with prompt triggers skills.sh search
# 2. Skills are installed to auto-discovery-plugin
# 3. Skill catalog includes auto-discovered skills
#
# Usage:
#   ./e2e-auto-discovery.sh          # Run standalone (includes setup)
#   ./e2e-auto-discovery.sh --skip-setup  # Skip setup (when called from e2e.sh)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/e2e-setup.sh"

# Parse args
SKIP_SETUP=0
for arg in "$@"; do
  case $arg in
    --skip-setup) SKIP_SETUP=1 ;;
  esac
done

echo "=== E2E Test: Auto-Discovery ==="
echo ""

# Setup if not skipped
if [[ $SKIP_SETUP -eq 0 ]]; then
  setup_test_env || exit 1
fi

# --- Test: Build command with skill auto-discovery ---
echo "Testing build command with auto-discovery..."

BUILD_EXIT_CODE=0
$CLI build "read hacker news and select top 5 ai news that has traction for my social account then compile it into one markdown file for me" \
  --name e2e-auto-discovery-test \
  --no-interactive || BUILD_EXIT_CODE=$?

if [[ $BUILD_EXIT_CODE -ne 0 ]]; then
  echo "⚠ Build exited with code $BUILD_EXIT_CODE"
fi

# --- Verify: Workflow created ---
echo ""
echo "Build verification:"

BUILD_WORKFLOW="$TEST_WORKSPACE/workflows/e2e-auto-discovery-test.md"
if [[ -f "$BUILD_WORKFLOW" ]]; then
  echo "  ✓ Workflow file created"
  WORKFLOW_EXISTS=1
else
  echo "  ✗ Workflow file not created"
  WORKFLOW_EXISTS=0
fi

# --- Verify: Build sandbox validation ---
BUILD_SANDBOX=$(find "$TEST_WORKSPACE/sandbox" -maxdepth 1 -type d -name "build-*" 2>/dev/null | sort -r | head -1)
BUILD_VALIDATED=0

if [[ -n "$BUILD_SANDBOX" ]] && [[ -f "$BUILD_SANDBOX/validation.json" ]]; then
  BUILD_VALIDATED=$(jq -r '.workflowValidated // false' "$BUILD_SANDBOX/validation.json" 2>/dev/null)
  if [[ "$BUILD_VALIDATED" == "true" ]]; then
    echo "  ✓ Workflow validated: true"
  else
    echo "  ✗ Workflow validated: false"
  fi
else
  echo "  ✗ Build validation.json not found"
fi

# --- Verify: Auto-discovery plugin ---
echo ""
echo "Auto-discovery verification:"

AUTO_DISCOVERY_PLUGIN="$TEST_WORKSPACE/plugins/auto-discovery-plugin"
AUTO_DISCOVERED_SKILLS="$AUTO_DISCOVERY_PLUGIN/skills"
SKILL_CATALOG="$TEST_WORKSPACE/registry/skill-catalog.json"

# Check plugin structure
if [[ -d "$AUTO_DISCOVERY_PLUGIN/.claude-plugin" ]]; then
  echo "  ✓ Auto-discovery plugin initialized"
  PLUGIN_INITIALIZED=1
else
  echo "  ✗ Auto-discovery plugin not initialized"
  PLUGIN_INITIALIZED=0
fi

# Check discovered skills
SKILL_COUNT=0
SKILLS_DISCOVERED=0
if [[ -d "$AUTO_DISCOVERED_SKILLS" ]]; then
  SKILL_COUNT=$(find "$AUTO_DISCOVERED_SKILLS" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$SKILL_COUNT" -gt 0 ]]; then
    echo "  ✓ Auto-discovered skills: $SKILL_COUNT"
    find "$AUTO_DISCOVERED_SKILLS" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | head -5 | while read skill; do
      echo "    - $skill"
    done
    SKILLS_DISCOVERED=1
  else
    echo "  ✗ No skills auto-discovered"
  fi
else
  echo "  ✗ Auto-discovery skills directory not found"
fi

# Check skill catalog
THIRD_PARTY_COUNT=0
CATALOG_UPDATED=0
if [[ -f "$SKILL_CATALOG" ]]; then
  THIRD_PARTY_COUNT=$(jq '[.skills[] | select(.sourceType == "third-party")] | length' "$SKILL_CATALOG" 2>/dev/null || echo 0)
  if [[ "$THIRD_PARTY_COUNT" -gt 0 ]]; then
    echo "  ✓ Skill catalog has $THIRD_PARTY_COUNT third-party skills"
    CATALOG_UPDATED=1
  else
    echo "  ⚠ Skill catalog has no third-party skills"
  fi
else
  echo "  ✗ Skill catalog not found"
fi

# --- Summary ---
echo ""
echo "=== Summary ==="
echo ""
echo "Build:"
echo "  Workflow created: $([[ $WORKFLOW_EXISTS -eq 1 ]] && echo "yes" || echo "no")"
echo "  Workflow validated: $BUILD_VALIDATED"
echo ""
echo "Auto-discovery:"
echo "  Plugin initialized: $([[ $PLUGIN_INITIALIZED -eq 1 ]] && echo "yes" || echo "no")"
echo "  Skills discovered: $SKILL_COUNT"
echo "  Catalog third-party: $THIRD_PARTY_COUNT"

# --- Determine pass/fail ---
echo ""

# Build must pass
if [[ $WORKFLOW_EXISTS -eq 1 ]] && [[ "$BUILD_VALIDATED" == "true" ]]; then
  BUILD_PASSED=1
else
  BUILD_PASSED=0
fi

# Auto-discovery check (non-blocking warning)
if [[ $PLUGIN_INITIALIZED -eq 1 ]] && [[ $SKILLS_DISCOVERED -eq 1 ]]; then
  AUTO_DISCOVERY_PASSED=1
else
  AUTO_DISCOVERY_PASSED=0
fi

if [[ $BUILD_PASSED -eq 1 ]] && [[ $AUTO_DISCOVERY_PASSED -eq 1 ]]; then
  echo "✓ Auto-discovery E2E test PASSED"
  exit 0
elif [[ $BUILD_PASSED -eq 1 ]]; then
  echo "⚠ Auto-discovery E2E test PARTIAL (build passed, auto-discovery incomplete)"
  echo "  Note: skills.sh availability affects this test"
  exit 0  # Don't fail on auto-discovery issues (external dependency)
else
  echo "✗ Auto-discovery E2E test FAILED"
  exit 1
fi
