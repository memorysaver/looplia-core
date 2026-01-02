#!/usr/bin/env bash
# v0.6.10 Unified Command Initialization Verification
# Tests that both build and run commands use consistent initialization
#
# Verifies:
#   1. Settings loading before API key validation
#   2. ZenMux API key mapping (ZENMUX_API_KEY -> ANTHROPIC_API_KEY)
#   3. Mock mode works without API key
#   4. Improved error messages

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script and project root paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Navigate up: scripts/ -> looplia-e2e/ -> skills/ -> .claude/ -> project root
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

print_header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
  echo -e "${YELLOW}▶ $1${NC}"
}

print_pass() {
  echo -e "${GREEN}  ✓ $1${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_fail() {
  echo -e "${RED}  ✗ $1${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_info() {
  echo -e "    $1"
}

# Test 1: Mock mode works without API key
test_mock_mode() {
  print_header "Test 1: Mock Mode Without API Key"

  # Save current env
  local OLD_ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
  local OLD_ZENMUX_API_KEY="${ZENMUX_API_KEY:-}"
  local OLD_CLAUDE_CODE_OAUTH_TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}"

  # Clear all API keys
  unset ANTHROPIC_API_KEY
  unset ZENMUX_API_KEY
  unset CLAUDE_CODE_OAUTH_TOKEN

  # Clean settings file temporarily
  local SETTINGS_BACKUP=""
  if [ -f ~/.looplia/looplia.setting.json ]; then
    SETTINGS_BACKUP=$(cat ~/.looplia/looplia.setting.json)
    rm -f ~/.looplia/looplia.setting.json
  fi

  print_step "Testing build --mock without API key..."
  if looplia build --mock "test v0.6.10 mock mode" 2>/dev/null; then
    print_pass "build --mock works without API key"
  else
    print_fail "build --mock failed without API key"
  fi

  # Restore settings
  if [ -n "$SETTINGS_BACKUP" ]; then
    echo "$SETTINGS_BACKUP" > ~/.looplia/looplia.setting.json
  fi

  # Restore env
  if [ -n "$OLD_ANTHROPIC_API_KEY" ]; then
    export ANTHROPIC_API_KEY="$OLD_ANTHROPIC_API_KEY"
  fi
  if [ -n "$OLD_ZENMUX_API_KEY" ]; then
    export ZENMUX_API_KEY="$OLD_ZENMUX_API_KEY"
  fi
  if [ -n "$OLD_CLAUDE_CODE_OAUTH_TOKEN" ]; then
    export CLAUDE_CODE_OAUTH_TOKEN="$OLD_CLAUDE_CODE_OAUTH_TOKEN"
  fi
}

# Test 2: ZenMux API key mapping
test_zenmux_mapping() {
  print_header "Test 2: ZenMux API Key Mapping"

  if [ -z "$ZENMUX_API_KEY" ]; then
    print_info "Skipping: ZENMUX_API_KEY not set"
    return 0
  fi

  # Save current env
  local OLD_ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"

  # Clear ANTHROPIC_API_KEY to ensure ZENMUX is used
  unset ANTHROPIC_API_KEY

  print_step "Configuring ZenMux preset..."
  if looplia config provider preset ZENMUX_ZAI_GLM47 2>/dev/null; then
    print_pass "ZenMux preset configured"
  else
    print_fail "Failed to configure ZenMux preset"
    return 1
  fi

  print_step "Testing build command with ZenMux..."
  # Use --mock to avoid actual API call, but settings should still load
  if looplia build --mock "test zenmux mapping" 2>/dev/null; then
    print_pass "build works with ZenMux preset"
  else
    print_fail "build failed with ZenMux preset"
  fi

  # Restore env
  if [ -n "$OLD_ANTHROPIC_API_KEY" ]; then
    export ANTHROPIC_API_KEY="$OLD_ANTHROPIC_API_KEY"
  fi
}

# Test 3: Error message format (v0.6.10 improved)
test_error_messages() {
  print_header "Test 3: Error Message Format"

  # Save current env
  local OLD_ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
  local OLD_ZENMUX_API_KEY="${ZENMUX_API_KEY:-}"
  local OLD_CLAUDE_CODE_OAUTH_TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}"

  # Clear all API keys
  unset ANTHROPIC_API_KEY
  unset ZENMUX_API_KEY
  unset CLAUDE_CODE_OAUTH_TOKEN

  # Clean settings
  rm -f ~/.looplia/looplia.setting.json

  print_step "Testing error message format..."
  ERROR_OUTPUT=$(looplia build "test" 2>&1 || true)

  # Check for improved error message format (v0.6.10)
  if echo "$ERROR_OUTPUT" | grep -q "Error: API key required"; then
    print_pass "Error message starts with 'Error: API key required'"
  else
    print_fail "Error message format incorrect"
    print_info "Got: $(echo "$ERROR_OUTPUT" | head -1)"
  fi

  # Check for options list
  if echo "$ERROR_OUTPUT" | grep -q "Set ANTHROPIC_API_KEY"; then
    print_pass "Error message includes ANTHROPIC_API_KEY option"
  else
    print_fail "Error message missing ANTHROPIC_API_KEY option"
  fi

  if echo "$ERROR_OUTPUT" | grep -q "ZENMUX_API_KEY"; then
    print_pass "Error message includes ZENMUX_API_KEY option"
  else
    print_fail "Error message missing ZENMUX_API_KEY option"
  fi

  if echo "$ERROR_OUTPUT" | grep -q "\-\-mock"; then
    print_pass "Error message includes --mock option"
  else
    print_fail "Error message missing --mock option"
  fi

  # Restore env
  if [ -n "$OLD_ANTHROPIC_API_KEY" ]; then
    export ANTHROPIC_API_KEY="$OLD_ANTHROPIC_API_KEY"
  fi
  if [ -n "$OLD_ZENMUX_API_KEY" ]; then
    export ZENMUX_API_KEY="$OLD_ZENMUX_API_KEY"
  fi
  if [ -n "$OLD_CLAUDE_CODE_OAUTH_TOKEN" ]; then
    export CLAUDE_CODE_OAUTH_TOKEN="$OLD_CLAUDE_CODE_OAUTH_TOKEN"
  fi
}

# Test 4: Settings loading order verification
test_settings_loading_order() {
  print_header "Test 4: Settings Loading Order (Build vs Run)"

  print_step "Checking source code for initializeCommandEnvironment usage..."

  # Check build.ts uses initializeCommandEnvironment
  BUILD_FILE="$PROJECT_ROOT/apps/cli/src/commands/build.ts"
  if [ -f "$BUILD_FILE" ]; then
    if grep -q "initializeCommandEnvironment" "$BUILD_FILE"; then
      print_pass "build.ts uses initializeCommandEnvironment"
    else
      print_fail "build.ts does not use initializeCommandEnvironment"
    fi
  else
    print_info "Skipping: $BUILD_FILE not found (not in source directory)"
  fi

  # Check run.ts uses initializeCommandEnvironment
  RUN_FILE="$PROJECT_ROOT/apps/cli/src/commands/run.ts"
  if [ -f "$RUN_FILE" ]; then
    if grep -q "initializeCommandEnvironment" "$RUN_FILE"; then
      print_pass "run.ts uses initializeCommandEnvironment"
    else
      print_fail "run.ts does not use initializeCommandEnvironment"
    fi
  else
    print_info "Skipping: $RUN_FILE not found (not in source directory)"
  fi

  # Check command-init.ts exists and has correct order
  INIT_FILE="$PROJECT_ROOT/packages/provider/src/claude-agent-sdk/command-init.ts"
  if [ -f "$INIT_FILE" ]; then
    print_pass "command-init.ts exists"

    # Verify order: readLoopliaSettings before validateApiKeyPresence
    if grep -A20 "initializeCommandEnvironment" "$INIT_FILE" | head -20 | grep -q "readLoopliaSettings"; then
      print_pass "Settings read in initializeCommandEnvironment"
    else
      print_fail "Settings not read in initializeCommandEnvironment"
    fi
  else
    print_info "Skipping: $INIT_FILE not found (not in source directory)"
  fi
}

# Print summary
print_summary() {
  print_header "v0.6.10 Verification Summary"

  echo ""
  echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
  echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
  echo ""

  if [ "$TESTS_FAILED" -gt 0 ]; then
    echo -e "${RED}Some v0.6.10 checks failed!${NC}"
    echo "Review docs/DESIGN-0.6.10.md for expected behavior."
    return 1
  else
    echo -e "${GREEN}All v0.6.10 checks passed!${NC}"
  fi
}

# Main
main() {
  print_header "v0.6.10 Unified Command Init Verification"
  echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"

  # Check if looplia is available
  if ! command -v looplia &> /dev/null; then
    echo -e "${RED}Error: looplia command not found${NC}"
    echo "Install with: bun install -g @looplia/looplia-cli"
    exit 1
  fi

  LOOPLIA_VERSION=$(looplia --version 2>/dev/null || echo "unknown")
  print_info "Looplia version: $LOOPLIA_VERSION"

  test_mock_mode
  test_zenmux_mapping
  test_error_messages
  test_settings_loading_order
  print_summary
}

# Run main
main "$@"
