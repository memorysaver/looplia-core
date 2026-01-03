#!/usr/bin/env bash
set -e

# Published CLI E2E Test Script
# Tests the published @looplia/looplia-cli package after CI passes
# Usage: ./published-cli-e2e.sh [version]
#
# Arguments:
#   version - Optional version to test (default: latest)
#
# Environment (or .env file):
#   ZENMUX_API_KEY - Required for ZenMux provider testing
#   ANTHROPIC_API_KEY - Alternative for Anthropic direct testing

# Get script directory for sourcing
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions (including load_env_file)
source "$SCRIPT_DIR/verify-workflow.sh"

# Try to load .env file automatically
load_env_file

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
VERSION="${1:-latest}"
WORKSPACE_DIR="/tmp/looplia-e2e-$(date +%s)"
TEST_CONTENT="$SCRIPT_DIR/../assets/ai-healthcare.md"

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

# Check prerequisites
check_prerequisites() {
  print_header "Checking Prerequisites"

  # Check API key
  print_step "Checking API credentials..."
  if [ -n "$ZENMUX_API_KEY" ]; then
    print_pass "ZENMUX_API_KEY available"
  elif [ -n "$ANTHROPIC_API_KEY" ]; then
    print_pass "ANTHROPIC_API_KEY available"
  else
    print_fail "No API key found"
    echo ""
    echo "Set one of:"
    echo "  export ZENMUX_API_KEY=xxx"
    echo "  export ANTHROPIC_API_KEY=xxx"
    exit 1
  fi

  # Check bun
  print_step "Checking bun..."
  if ! command -v bun &> /dev/null; then
    print_fail "bun is not installed"
    echo "Install with: curl -fsSL https://bun.sh/install | bash"
    exit 1
  fi
  print_pass "bun is available"

  # Check jq
  print_step "Checking jq..."
  if ! command -v jq &> /dev/null; then
    print_fail "jq is not installed"
    exit 1
  fi
  print_pass "jq is available"

  # Check test content
  print_step "Checking test content..."
  if [ ! -f "$TEST_CONTENT" ]; then
    print_fail "Test content not found: $TEST_CONTENT"
    exit 1
  fi
  print_pass "Test content available"
}

# Install published CLI
install_cli() {
  print_header "Installing Published CLI"

  print_step "Installing @looplia/looplia-cli@$VERSION..."
  bun install -g "@looplia/looplia-cli@$VERSION"
  print_pass "CLI installed"

  print_step "Verifying installation..."
  INSTALLED_VERSION=$(looplia --version 2>/dev/null || echo "unknown")
  print_info "Installed version: $INSTALLED_VERSION"

  if [ "$INSTALLED_VERSION" = "unknown" ]; then
    print_fail "Failed to verify CLI installation"
    exit 1
  fi
  print_pass "CLI verified: $INSTALLED_VERSION"
}

# Verify version consistency between CLI and package
verify_version_consistency() {
  print_header "Verifying Version Consistency"

  # Get CLI reported version (format: "looplia X.Y.Z")
  print_step "Checking CLI version..."
  CLI_OUTPUT=$(looplia --version 2>/dev/null || echo "unknown")
  # Extract just the version number (last word)
  CLI_VERSION=$(echo "$CLI_OUTPUT" | awk '{print $NF}')
  print_info "CLI reports: $CLI_OUTPUT (version: $CLI_VERSION)"

  # Get package.json version from npm registry
  print_step "Checking package version..."
  if [ "$VERSION" = "latest" ]; then
    PKG_VERSION=$(npm view "@looplia/looplia-cli" version 2>/dev/null || echo "unknown")
  else
    PKG_VERSION=$(npm view "@looplia/looplia-cli@$VERSION" version 2>/dev/null || echo "unknown")
  fi
  print_info "Package version: $PKG_VERSION"

  # Compare versions
  if [ "$CLI_VERSION" = "unknown" ] || [ "$PKG_VERSION" = "unknown" ]; then
    print_fail "Could not determine versions"
  elif [ "$CLI_VERSION" = "$PKG_VERSION" ]; then
    print_pass "Version consistency: CLI ($CLI_VERSION) matches package ($PKG_VERSION)"
  else
    print_fail "Version mismatch: CLI=$CLI_VERSION, Package=$PKG_VERSION"
    print_info "Fix: Update VERSION constant in apps/cli/src/index.ts"
  fi
}

# Bootstrap workspace
bootstrap_workspace() {
  print_header "Bootstrapping Workspace"

  print_step "Cleaning existing workspace..."
  rm -rf ~/.looplia
  print_pass "Workspace cleaned"

  print_step "Initializing looplia..."
  looplia init --yes
  print_pass "Workspace initialized"

  # Verify structure
  print_step "Verifying workspace structure..."

  if [ -d ~/.looplia/looplia-core ]; then
    print_pass "looplia-core plugin installed"
  else
    print_fail "looplia-core plugin missing"
  fi

  if [ -d ~/.looplia/looplia-writer ]; then
    print_pass "looplia-writer plugin installed"
  else
    print_fail "looplia-writer plugin missing"
  fi

  if [ -f ~/.looplia/workflows/writing-kit.md ]; then
    print_pass "writing-kit workflow available"
  else
    print_fail "writing-kit workflow missing"
  fi
}

# Configure provider
configure_provider() {
  print_header "Configuring Provider"

  if [ -n "$ZENMUX_API_KEY" ]; then
    print_step "Configuring ZenMux provider..."
    looplia config provider preset ZENMUX_ZAI_GLM47
    print_pass "ZenMux preset configured"
  else
    print_step "Using Anthropic provider (default)..."
    print_pass "Using ANTHROPIC_API_KEY from environment"
  fi

  print_step "Verifying provider configuration..."
  looplia config provider show
}

# Run workflow test
run_workflow_test() {
  print_header "Running Workflow Test"

  # Copy test content
  print_step "Preparing test content..."
  mkdir -p "$WORKSPACE_DIR"
  cp "$TEST_CONTENT" "$WORKSPACE_DIR/content.md"
  print_pass "Test content prepared"

  # Run workflow
  print_step "Executing writing-kit workflow..."
  looplia run writing-kit \
    --file "$WORKSPACE_DIR/content.md" \
    --topics "ai,healthcare,technology" \
    --tone "expert"

  print_pass "Workflow execution completed"
}

# Verify results using common functions
verify_results() {
  print_header "Verifying Results"

  # Source common verification functions
  source "$SCRIPT_DIR/verify-workflow.sh"

  # Find sandbox directory
  SANDBOX_DIR=$(find ~/.looplia/sandbox -maxdepth 1 -type d ! -name sandbox 2>/dev/null | head -1)

  if [ -z "$SANDBOX_DIR" ]; then
    print_fail "No sandbox directory found"
    return 1
  fi

  SANDBOX_ID=$(basename "$SANDBOX_DIR")
  print_pass "Sandbox folder: $SANDBOX_ID"

  # Run verifications
  verify_outputs "$SANDBOX_DIR"
  verify_validation_state "$SANDBOX_DIR"
  verify_subagent_usage "$SANDBOX_DIR"
}

# Print summary
print_summary() {
  print_header "Test Summary"

  echo ""
  echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
  echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
  echo ""

  if [ "$TESTS_FAILED" -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
  else
    echo -e "${GREEN}All tests passed!${NC}"
  fi

  echo ""
  echo "Published CLI E2E test completed successfully."
  echo "Tested version: $VERSION"
}

# Cleanup
cleanup() {
  print_step "Cleaning up..."
  rm -rf "$WORKSPACE_DIR"
}

# Main
main() {
  print_header "Published CLI E2E Test"
  echo "  Version to test: $VERSION"
  echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"

  check_prerequisites
  install_cli
  verify_version_consistency
  bootstrap_workspace
  configure_provider
  run_workflow_test
  verify_results
  cleanup
  print_summary
}

# Run main
main "$@"
