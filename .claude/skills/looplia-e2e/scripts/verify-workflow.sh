#!/usr/bin/env bash
# Common Workflow Verification Functions
# Sourced by other E2E test scripts
#
# Functions:
#   load_env_file [env_file]
#   verify_outputs <sandbox_dir>
#   verify_validation_state <sandbox_dir>
#   verify_subagent_usage <sandbox_dir>
#   verify_v0610_init <sandbox_dir>

# Colors (if not already defined)
RED="${RED:-\033[0;31m}"
GREEN="${GREEN:-\033[0;32m}"
YELLOW="${YELLOW:-\033[1;33m}"
NC="${NC:-\033[0m}"

# Counters (can be overridden by parent script)
: "${TESTS_PASSED:=0}"
: "${TESTS_FAILED:=0}"

_print_pass() {
  echo -e "${GREEN}  ✓ $1${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

_print_fail() {
  echo -e "${RED}  ✗ $1${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

_print_warn() {
  echo -e "${YELLOW}  ⚠ $1${NC}"
}

_print_info() {
  echo -e "    $1"
}

# Load .env file safely (handles special characters in API keys)
# Usage: load_env_file [env_file]
# Default: looks for .env in current directory, then project root
load_env_file() {
  local env_file="${1:-}"

  # Auto-detect .env file location
  if [ -z "$env_file" ]; then
    # Try common locations
    if [ -f ".env" ]; then
      env_file=".env"
    elif [ -f "../../.env" ]; then
      env_file="../../.env"
    elif [ -f "../../../.env" ]; then
      env_file="../../../.env"
    else
      # Try to find project root (look for package.json)
      local dir="$(pwd)"
      while [ "$dir" != "/" ]; do
        if [ -f "$dir/.env" ]; then
          env_file="$dir/.env"
          break
        fi
        dir="$(dirname "$dir")"
      done
    fi
  fi

  if [ ! -f "$env_file" ]; then
    return 1
  fi

  # Read line by line, properly handle special characters
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

    # Extract key and value
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local value="${BASH_REMATCH[2]}"

      # Remove surrounding quotes if present
      if [[ "$value" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi

      # Export with proper quoting
      export "$key=$value"
    fi
  done < "$env_file"

  return 0
}

# Verify workflow outputs exist
# Usage: verify_outputs <sandbox_dir>
verify_outputs() {
  local SANDBOX_DIR="$1"
  local pass=true

  echo -e "${YELLOW}▶ Verifying workflow outputs...${NC}"

  # Check summary.json (Stage 1)
  if [ -f "$SANDBOX_DIR/outputs/summary.json" ]; then
    _print_pass "outputs/summary.json exists (Stage 1)"
  else
    _print_fail "outputs/summary.json NOT found"
    pass=false
  fi

  # Check ideas.json (Stage 2)
  if [ -f "$SANDBOX_DIR/outputs/ideas.json" ]; then
    _print_pass "outputs/ideas.json exists (Stage 2)"
  else
    _print_fail "outputs/ideas.json NOT found"
    pass=false
  fi

  # Check writing-kit.json (Stage 3 - final)
  if [ -f "$SANDBOX_DIR/outputs/writing-kit.json" ]; then
    _print_pass "outputs/writing-kit.json exists (Stage 3)"

    # Schema validation
    if jq -e '.contentId and .summary and .ideas and .suggestedOutline' \
       "$SANDBOX_DIR/outputs/writing-kit.json" > /dev/null 2>&1; then
      _print_pass "Schema validation passed"
    else
      _print_fail "Schema validation failed - missing required fields"
      pass=false
    fi

    # Quality metrics
    HOOK_COUNT=$(jq '.ideas.hooks | length' "$SANDBOX_DIR/outputs/writing-kit.json" 2>/dev/null || echo "0")
    SECTION_COUNT=$(jq '.suggestedOutline | length' "$SANDBOX_DIR/outputs/writing-kit.json" 2>/dev/null || echo "0")

    _print_info "Hook count: $HOOK_COUNT (expected: >= 2)"
    _print_info "Outline sections: $SECTION_COUNT (expected: >= 3)"

    if [ "$HOOK_COUNT" -ge 2 ]; then
      _print_pass "Hook count acceptable"
    else
      _print_warn "Hook count low"
    fi

    if [ "$SECTION_COUNT" -ge 3 ]; then
      _print_pass "Outline section count acceptable"
    else
      _print_warn "Outline section count low"
    fi
  else
    _print_fail "outputs/writing-kit.json NOT found"
    pass=false
  fi

  [ "$pass" = true ] && return 0 || return 1
}

# Verify validation.json state
# Usage: verify_validation_state <sandbox_dir>
verify_validation_state() {
  local SANDBOX_DIR="$1"
  local VALIDATION_FILE="$SANDBOX_DIR/validation.json"
  local pass=true

  echo -e "${YELLOW}▶ Checking validation state...${NC}"

  if [ ! -f "$VALIDATION_FILE" ]; then
    _print_fail "validation.json not found"
    return 1
  fi

  _print_pass "validation.json exists"

  # Check each step is validated (v0.6.0+ uses "steps")
  for step in summary ideas writing-kit; do
    VALIDATED=$(jq -r ".steps.\"$step\".validated // false" "$VALIDATION_FILE" 2>/dev/null)
    if [ "$VALIDATED" = "true" ]; then
      _print_pass "$step: validated"
    else
      _print_fail "$step: NOT validated"
      pass=false
    fi
  done

  [ "$pass" = true ] && return 0 || return 1
}

# Verify subagent usage (v0.6.9+ architecture)
# Usage: verify_subagent_usage <sandbox_dir>
verify_subagent_usage() {
  local SANDBOX_DIR="$1"
  local LOG_FILE=$(ls "$SANDBOX_DIR/logs/"*.log 2>/dev/null | head -1)
  local pass=true

  echo -e "${YELLOW}▶ Verifying subagent usage (v0.6.9+)...${NC}"

  if [ -z "$LOG_FILE" ]; then
    _print_warn "No log file found in $SANDBOX_DIR/logs/"
    return 1
  fi

  # Check for general-purpose subagent (v0.6.9+)
  GP_COUNT=$(grep -c '"subagent_type".*"general-purpose"' "$LOG_FILE" 2>/dev/null || echo "0")
  if [ "$GP_COUNT" -ge 3 ]; then
    _print_pass "general-purpose subagent used $GP_COUNT times"
  else
    _print_fail "general-purpose count: $GP_COUNT (expected >= 3)"
    pass=false
  fi

  # Check for legacy agents (should NOT exist)
  for legacy in content-analyzer idea-generator writing-kit-builder skill-executor; do
    if grep -q "\"subagent_type\".*\"$legacy\"" "$LOG_FILE"; then
      _print_fail "Legacy agent $legacy detected!"
      pass=false
    fi
  done
  if [ "$pass" = true ]; then
    _print_pass "No legacy agents found"
  fi

  # Check Task tool invocations
  TASK_COUNT=$(grep -c '"name".*"Task"' "$LOG_FILE" 2>/dev/null || echo "0")
  if [ "$TASK_COUNT" -ge 3 ]; then
    _print_pass "Task tool invocations: $TASK_COUNT"
  else
    _print_warn "Task tool invocations: $TASK_COUNT (expected >= 3)"
  fi

  # Verify skill-to-step mapping
  echo -e "${YELLOW}▶ Checking skill-to-step mapping...${NC}"

  declare -A STEP_SKILL_MAP=(
    ["summary"]="media-reviewer"
    ["ideas"]="idea-synthesis"
    ["writing-kit"]="writing-kit-assembler"
  )

  for step in "${!STEP_SKILL_MAP[@]}"; do
    expected_skill="${STEP_SKILL_MAP[$step]}"

    if grep -A10 "\"description\".*\"Execute step: $step\"" "$LOG_FILE" | grep -q "$expected_skill"; then
      _print_pass "Step '$step' uses skill '$expected_skill'"
    else
      _print_fail "Step '$step' should use skill '$expected_skill'"
      pass=false
    fi
  done

  [ "$pass" = true ] && return 0 || return 1
}

# Verify v0.6.10 unified command initialization
# Usage: verify_v0610_init
verify_v0610_init() {
  local pass=true

  echo -e "${YELLOW}▶ Verifying v0.6.10 command initialization...${NC}"

  # Test 1: Check looplia version
  LOOPLIA_VERSION=$(looplia --version 2>/dev/null || echo "unknown")
  _print_info "Looplia version: $LOOPLIA_VERSION"

  # Test 2: Mock mode should work without API key
  # Save current env
  local OLD_ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
  local OLD_ZENMUX_API_KEY="${ZENMUX_API_KEY:-}"

  unset ANTHROPIC_API_KEY
  unset ZENMUX_API_KEY

  # Clean settings to test mock mode
  rm -f ~/.looplia/looplia.setting.json

  if looplia build --mock "test v0.6.10" 2>/dev/null; then
    _print_pass "Mock mode works without API key"
  else
    _print_fail "Mock mode failed without API key"
    pass=false
  fi

  # Restore env
  if [ -n "$OLD_ANTHROPIC_API_KEY" ]; then
    export ANTHROPIC_API_KEY="$OLD_ANTHROPIC_API_KEY"
  fi
  if [ -n "$OLD_ZENMUX_API_KEY" ]; then
    export ZENMUX_API_KEY="$OLD_ZENMUX_API_KEY"
  fi

  [ "$pass" = true ] && return 0 || return 1
}

# If script is run directly, show usage
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Common Workflow Verification Functions"
  echo ""
  echo "This script is meant to be sourced by other scripts:"
  echo "  source verify-workflow.sh"
  echo ""
  echo "Available functions:"
  echo "  load_env_file [env_file]        - Load .env file safely (handles special chars)"
  echo "  verify_outputs <sandbox_dir>"
  echo "  verify_validation_state <sandbox_dir>"
  echo "  verify_subagent_usage <sandbox_dir>"
  echo "  verify_v0610_init"
fi
