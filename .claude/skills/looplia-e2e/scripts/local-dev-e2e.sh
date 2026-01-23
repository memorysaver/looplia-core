#!/usr/bin/env bash
#
# Local Development E2E Test
# Tests looplia CLI from local build with hook system verification
#
# Prerequisites:
# - Claude Code subscription (OAuth token in Keychain)
# - OR ZENMUX_API_KEY / ANTHROPIC_API_KEY
# - Built CLI: bun run build
#
# Usage:
#   ./scripts/local-dev-e2e.sh              # Auto-detect auth
#   ./scripts/local-dev-e2e.sh --oauth      # Force Claude Code OAuth
#   ./scripts/local-dev-e2e.sh --zenmux     # Force ZenMux preset
#   ./scripts/local-dev-e2e.sh --mock       # Mock mode (no API calls)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
TEST_FILE="$SKILL_DIR/assets/ai-healthcare.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }
log_step() { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}[STEP]${NC} $1"; }

# Parse arguments
AUTH_MODE="auto"
MOCK_MODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --oauth)
      AUTH_MODE="oauth"
      shift
      ;;
    --zenmux)
      AUTH_MODE="zenmux"
      shift
      ;;
    --anthropic)
      AUTH_MODE="anthropic"
      shift
      ;;
    --mock)
      MOCK_MODE=true
      shift
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Step 1: Check prerequisites
log_step "Step 1: Checking prerequisites"

# Check if CLI is built
if [[ ! -f "$PROJECT_ROOT/apps/cli/dist/cli.js" ]]; then
  log_warn "CLI not built. Building now..."
  cd "$PROJECT_ROOT" && bun run build
fi

CLI="bun $PROJECT_ROOT/apps/cli/dist/cli.js"
log_success "CLI found at apps/cli/dist/cli.js"

# Check test file
if [[ ! -f "$TEST_FILE" ]]; then
  log_error "Test file not found: $TEST_FILE"
  exit 1
fi
log_success "Test file found: ai-healthcare.md"

# Step 2: Configure authentication
log_step "Step 2: Configuring authentication"

setup_oauth() {
  log_info "Setting up Claude Code OAuth..."

  # Extract OAuth token from Keychain
  if command -v security &> /dev/null; then
    OAUTH_TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken' 2>/dev/null || echo "")

    if [[ -n "$OAUTH_TOKEN" && "$OAUTH_TOKEN" != "null" ]]; then
      export CLAUDE_CODE_OAUTH_TOKEN="$OAUTH_TOKEN"
      $CLI config provider preset CLAUDE_CODE_SUBSCRIPTION_HAIKU
      log_success "Claude Code OAuth configured (Haiku preset)"
      return 0
    fi
  fi

  log_error "Failed to extract OAuth token from Keychain"
  return 1
}

setup_zenmux() {
  log_info "Setting up ZenMux..."

  if [[ -z "$ZENMUX_API_KEY" ]]; then
    log_error "ZENMUX_API_KEY not set"
    return 1
  fi

  $CLI config provider preset ZENMUX_GLM47
  log_success "ZenMux configured"
  return 0
}

setup_anthropic() {
  log_info "Setting up Anthropic direct..."

  if [[ -z "$ANTHROPIC_API_KEY" ]]; then
    log_error "ANTHROPIC_API_KEY not set"
    return 1
  fi

  $CLI config provider preset ANTHROPIC_HAIKU
  log_success "Anthropic configured"
  return 0
}

if [[ "$MOCK_MODE" == "true" ]]; then
  log_info "Mock mode enabled - no API configuration needed"
elif [[ "$AUTH_MODE" == "oauth" ]]; then
  setup_oauth || exit 1
elif [[ "$AUTH_MODE" == "zenmux" ]]; then
  setup_zenmux || exit 1
elif [[ "$AUTH_MODE" == "anthropic" ]]; then
  setup_anthropic || exit 1
else
  # Auto-detect: try OAuth first, then ZenMux, then Anthropic
  log_info "Auto-detecting authentication..."

  if setup_oauth 2>/dev/null; then
    :
  elif [[ -n "$ZENMUX_API_KEY" ]] && setup_zenmux 2>/dev/null; then
    :
  elif [[ -n "$ANTHROPIC_API_KEY" ]] && setup_anthropic 2>/dev/null; then
    :
  else
    log_error "No authentication available"
    log_info "Options:"
    log_info "  1. Use Claude Code subscription (macOS Keychain)"
    log_info "  2. Set ZENMUX_API_KEY environment variable"
    log_info "  3. Set ANTHROPIC_API_KEY environment variable"
    log_info "  4. Run with --mock for testing without API"
    exit 1
  fi
fi

# Step 3: Verify configuration
log_step "Step 3: Verifying configuration"
$CLI config provider show

# Step 4: Run workflow
log_step "Step 4: Running writing-kit workflow"

WORKFLOW_ARGS="--file $TEST_FILE"
if [[ "$MOCK_MODE" == "true" ]]; then
  WORKFLOW_ARGS="$WORKFLOW_ARGS --mock"
fi

log_info "Command: looplia run writing-kit $WORKFLOW_ARGS"
echo ""

# Run workflow and capture sandbox ID from output
WORKFLOW_OUTPUT=$($CLI run writing-kit $WORKFLOW_ARGS 2>&1) || {
  log_error "Workflow failed"
  echo "$WORKFLOW_OUTPUT"
  exit 1
}

echo "$WORKFLOW_OUTPUT"

# Extract sandbox ID from output (e.g., "Created sandbox: ai-healthcare-2026-01-23-abc123")
SANDBOX_ID=$(echo "$WORKFLOW_OUTPUT" | grep -o 'Created sandbox: [^ ]*' | sed 's/Created sandbox: //' || echo "")

if [[ -z "$SANDBOX_ID" ]]; then
  log_warn "Could not extract sandbox ID from output"
  # Try to find most recent sandbox
  SANDBOX_DIR=$(find ~/.looplia/sandbox -maxdepth 1 -type d -name "ai-healthcare-*" 2>/dev/null | sort -r | head -1)
else
  SANDBOX_DIR="$HOME/.looplia/sandbox/$SANDBOX_ID"
fi

if [[ -z "$SANDBOX_DIR" || ! -d "$SANDBOX_DIR" ]]; then
  log_error "Sandbox directory not found"
  exit 1
fi

log_success "Sandbox directory: $SANDBOX_DIR"

# Step 5: Verify outputs
log_step "Step 5: Verifying outputs"

source "$SCRIPT_DIR/verify-workflow.sh"

verify_outputs "$SANDBOX_DIR"
OUTPUTS_RESULT=$?

verify_validation_state "$SANDBOX_DIR"
VALIDATION_RESULT=$?

# Step 6: Check hook system (programmatic hooks v0.7.4)
log_step "Step 6: Checking hook system"

# Hook evidence is now tracked via validation.json state
HOOK_EVIDENCE=0

# Check 1: validation.json exists with step tracking
if [[ -f "$SANDBOX_DIR/validation.json" ]]; then
  log_success "validation.json exists (workflow validation tracking)"
  HOOK_EVIDENCE=$((HOOK_EVIDENCE + 1))
else
  log_warn "validation.json not found"
fi

# Check 2: All steps have validated: true (PostToolUse hook evidence)
if [[ -f "$SANDBOX_DIR/validation.json" ]]; then
  VALIDATED_COUNT=$(jq '[.steps | to_entries[] | select(.value.validated == true)] | length' "$SANDBOX_DIR/validation.json" 2>/dev/null || echo "0")
  TOTAL_STEPS=$(jq '[.steps | to_entries[]] | length' "$SANDBOX_DIR/validation.json" 2>/dev/null || echo "0")

  if [[ "$VALIDATED_COUNT" == "$TOTAL_STEPS" && "$TOTAL_STEPS" != "0" ]]; then
    log_success "All $VALIDATED_COUNT/$TOTAL_STEPS steps validated (PostToolUse Write hook)"
    HOOK_EVIDENCE=$((HOOK_EVIDENCE + 1))
  else
    log_warn "Only $VALIDATED_COUNT/$TOTAL_STEPS steps validated"
  fi
fi

# Check 3: Status is completed (Stop/SubagentStop hook evidence)
if [[ -f "$SANDBOX_DIR/validation.json" ]]; then
  STATUS=$(jq -r '.status // "unknown"' "$SANDBOX_DIR/validation.json" 2>/dev/null)
  if [[ "$STATUS" == "completed" ]]; then
    log_success "Workflow status: completed (Stop hook allowed completion)"
    HOOK_EVIDENCE=$((HOOK_EVIDENCE + 1))
  else
    log_warn "Workflow status: $STATUS (expected: completed)"
  fi
fi

# Check 4: All output files created
if [[ -d "$SANDBOX_DIR/outputs" ]]; then
  OUTPUT_COUNT=$(ls -1 "$SANDBOX_DIR/outputs/"*.json 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$OUTPUT_COUNT" -ge 3 ]]; then
    log_success "All 3 output files created"
    HOOK_EVIDENCE=$((HOOK_EVIDENCE + 1))
  else
    log_warn "Only $OUTPUT_COUNT output files (expected: 3)"
  fi
fi

echo ""
log_info "Hook evidence score: $HOOK_EVIDENCE/4"

# Step 7: Summary
log_step "Step 7: Test Summary"

TOTAL_CHECKS=0
PASSED_CHECKS=0

check_result() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if [[ $1 -eq 0 ]]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_success "$2"
  else
    log_error "$2"
  fi
}

check_result $OUTPUTS_RESULT "Output files verification"
check_result $VALIDATION_RESULT "Validation state verification"
[[ $HOOK_EVIDENCE -ge 3 ]] && check_result 0 "Hook system evidence ($HOOK_EVIDENCE/4)" || check_result 1 "Hook system evidence ($HOOK_EVIDENCE/4)"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Results: ${GREEN}$PASSED_CHECKS${NC}/${TOTAL_CHECKS} checks passed"

if [[ $PASSED_CHECKS -eq $TOTAL_CHECKS ]]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
