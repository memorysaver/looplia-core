#!/usr/bin/env bash
set -e

# Looplia Docker E2E Test Script
# Runs real API tests inside Docker container with v0.6.9 unified skill executor architecture
# Tests: Workflow-as-Markdown with general-purpose subagent, skills auto-loading, and sandbox isolation

# Configuration
IMAGE_NAME="looplia:test"
WORKSPACE_DIR="./test-workspace"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TEST_CONTENT="$SKILL_DIR/assets/ai-healthcare.md"
ENV_FILE=".env"

# Source common functions (including load_env_file)
source "$SCRIPT_DIR/verify-workflow.sh"

# Try to load .env file automatically (for local env vars)
load_env_file

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNED=0

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

print_warn() {
  echo -e "${YELLOW}  ⚠ $1${NC}"
  TESTS_WARNED=$((TESTS_WARNED + 1))
}

print_info() {
  echo -e "    $1"
}

# Track which provider to use
USE_ZENMUX=false

# Get Docker environment arguments
# Priority: ZENMUX_API_KEY (cheapest) > CLAUDE_CODE_OAUTH_TOKEN > ANTHROPIC_API_KEY > .env
# Always sets LOOPLIA_DEV=false to ensure production mode in Docker
get_env_args() {
  # Always disable dev mode in Docker (uses ~/.looplia plugins instead of ./plugins)
  local base_args="-e LOOPLIA_DEV=false"

  if [ -n "$ZENMUX_API_KEY" ]; then
    # ZenMux mode: cheapest option (GLM 4.7)
    USE_ZENMUX=true
    echo "$base_args -e ZENMUX_API_KEY=$ZENMUX_API_KEY"
  elif [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
    # CI mode: subscription plan token
    echo "$base_args -e CLAUDE_CODE_OAUTH_TOKEN=$CLAUDE_CODE_OAUTH_TOKEN"
  elif [ -n "$ANTHROPIC_API_KEY" ]; then
    # Direct API key from environment
    echo "$base_args -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  elif [ -f "$ENV_FILE" ]; then
    # Local mode: .env file (override LOOPLIA_DEV from file)
    echo "$base_args --env-file $ENV_FILE"
  else
    echo "$base_args"
  fi
}

# Check prerequisites
check_prerequisites() {
  print_header "Checking Prerequisites"

  # Check API credentials (prefer ZenMux for cost savings)
  print_step "Checking API credentials..."
  if [ -n "$ZENMUX_API_KEY" ]; then
    print_pass "ZENMUX_API_KEY available (cheapest - GLM 4.7)"
  elif [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
    print_pass "OAuth token available (CI mode)"
  elif [ -n "$ANTHROPIC_API_KEY" ]; then
    print_pass "ANTHROPIC_API_KEY available via environment"
  elif [ -f "$ENV_FILE" ]; then
    print_pass ".env file exists (local mode)"
  else
    print_fail "No API credentials found"
    echo ""
    echo "Provide credentials via (in order of preference):"
    echo "  - ZENMUX_API_KEY (cheapest - uses GLM 4.7)"
    echo "  - CLAUDE_CODE_OAUTH_TOKEN (CI/subscription plan)"
    echo "  - ANTHROPIC_API_KEY environment variable"
    echo "  - .env file with ANTHROPIC_API_KEY=sk-ant-..."
    exit 1
  fi

  # Check Docker
  print_step "Checking Docker..."
  if ! command -v docker &> /dev/null; then
    print_fail "Docker is not installed"
    exit 1
  fi
  if ! docker info &> /dev/null; then
    print_fail "Docker daemon is not running"
    exit 1
  fi
  print_pass "Docker is available"

  # Check jq
  print_step "Checking jq..."
  if ! command -v jq &> /dev/null; then
    print_fail "jq is not installed (required for JSON validation)"
    echo "  Install with: brew install jq (macOS) or apt install jq (Linux)"
    exit 1
  fi
  print_pass "jq is available"

  # Check test content
  print_step "Checking test fixtures..."
  if [ ! -f "$TEST_CONTENT" ]; then
    print_fail "Test fixture not found: $TEST_CONTENT"
    exit 1
  fi
  print_pass "Test content available: $(basename "$TEST_CONTENT")"

  # Check youtube fixtures (commented out - focus on markdown processing)
  # print_step "Checking YouTube test fixtures..."
  # if [ ! -f "$EXAMPLES_DIR/youtube/Anthropics/captions/EvtPBaaykdo.en.vtt" ]; then
  #   print_fail "VTT fixture not found: $EXAMPLES_DIR/youtube/Anthropics/captions/EvtPBaaykdo.en.vtt"
  #   exit 1
  # fi
  # print_pass "VTT fixture available"
  #
  # if [ ! -f "$EXAMPLES_DIR/youtube/Anthropics/transcripts/CBneTpXF1CQ.srt" ]; then
  #   print_fail "SRT fixture not found: $EXAMPLES_DIR/youtube/Anthropics/transcripts/CBneTpXF1CQ.srt"
  #   exit 1
  # fi
  # print_pass "SRT fixture available"
}

# Clean and prepare workspace
prepare_workspace() {
  print_header "Preparing Workspace"

  print_step "Cleaning test workspace..."
  rm -rf "$WORKSPACE_DIR"
  mkdir -p "$WORKSPACE_DIR"
  print_pass "Workspace cleaned: $WORKSPACE_DIR"
}

# Build project and Docker image
build_project() {
  print_header "Building Project"

  print_step "Building packages..."
  bun run build
  print_pass "Packages built"

  print_step "Building Docker image..."
  docker build -t "$IMAGE_NAME" . --quiet
  print_pass "Docker image built: $IMAGE_NAME"
}

# Verify workflow logs for subagent and skill usage (v0.6.1 skills-first)
verify_workflow_log() {
  local SESSION_DIR=$1
  local LOG_FILE=$(ls "$SESSION_DIR/logs/"*.log 2>/dev/null | head -1)

  if [ -z "$LOG_FILE" ]; then
    print_warn "No log file found in $SESSION_DIR/logs/"
    return 1
  fi

  print_step "Verifying workflow execution logs (v0.6.9 unified executor)..."

  local pass=true

  # Check for general-purpose subagent (CRITICAL for v0.6.9)
  # v0.6.9: Uses built-in general-purpose subagent for all workflow steps
  GP_COUNT=$(grep -c '"subagent_type".*"general-purpose"' "$LOG_FILE" 2>/dev/null || echo "0")
  if [ "$GP_COUNT" -ge 3 ]; then
    print_pass "general-purpose subagent used $GP_COUNT times"
  else
    print_fail "general-purpose count: $GP_COUNT (expected >= 3)"
    pass=false
  fi

  # Check for legacy agents (should NOT exist)
  for legacy in content-analyzer idea-generator writing-kit-builder skill-executor; do
    if grep -q "\"subagent_type\".*\"$legacy\"" "$LOG_FILE"; then
      print_fail "Legacy agent $legacy detected!"
      pass=false
    fi
  done
  if [ "$pass" = true ]; then
    print_pass "No legacy agents found"
  fi

  # Check Task tool invocations
  TASK_COUNT=$(grep -c '"name".*"Task"' "$LOG_FILE" 2>/dev/null || echo "0")
  if [ "$TASK_COUNT" -ge 3 ]; then
    print_pass "Task tool invocations: $TASK_COUNT"
  else
    print_warn "Task tool invocations: $TASK_COUNT (expected >= 3)"
  fi

  # Check Skill tool invocations
  SKILL_COUNT=$(grep -c '"name".*"Skill"' "$LOG_FILE" 2>/dev/null || echo "0")
  print_info "Skill tool invocations: $SKILL_COUNT"

  # Verify correct skills used for each step
  # v0.6.9 Log format: Task tool calls have:
  # { "subagent_type": "general-purpose",
  #   "description": "Execute step: {step-id}",
  #   "prompt": "Execute skill '{skill-name}' for step '{step-id}'..." }
  print_step "Checking skill-to-step mapping..."

  # Define expected mappings: step → skill
  declare -A STEP_SKILL_MAP=(
    ["summary"]="media-reviewer"
    ["ideas"]="idea-synthesis"
    ["writing-kit"]="writing-kit-assembler"
  )

  for step in "${!STEP_SKILL_MAP[@]}"; do
    expected_skill="${STEP_SKILL_MAP[$step]}"

    # Find Task call for this step and check if prompt contains expected skill
    # v0.6.9: Uses general-purpose subagent with skill name in prompt
    if grep -A10 "\"description\".*\"Execute step: $step\"" "$LOG_FILE" | grep -q "$expected_skill"; then
      print_pass "Step '$step' uses skill '$expected_skill'"
    else
      print_fail "Step '$step' should use skill '$expected_skill'"
      pass=false
    fi
  done

  [ "$pass" = true ] && return 0 || return 1
}

# Check validation.json state
check_validation_state() {
  local SESSION_DIR=$1
  local VALIDATION_FILE="$SESSION_DIR/validation.json"

  print_step "Checking validation state..."

  if [ ! -f "$VALIDATION_FILE" ]; then
    print_fail "validation.json not found"
    return 1
  fi

  print_pass "validation.json exists"

  local pass=true

  # Check each step is validated (v0.6.0 uses "steps" not "outputs")
  for step in summary ideas writing-kit; do
    VALIDATED=$(jq -r ".steps.\"$step\".validated // false" "$VALIDATION_FILE" 2>/dev/null)
    if [ "$VALIDATED" = "true" ]; then
      print_pass "$step: validated"
    else
      print_fail "$step: NOT validated"
      pass=false
    fi
  done

  [ "$pass" = true ] && return 0 || return 1
}

# Test: Markdown workflow (3-stage pipeline)
test_workflow_markdown() {
  print_header "Test 1: Markdown Workflow (3-stage pipeline)"

  print_step "Running writing-kit workflow with real API..."

  ENV_ARGS=$(get_env_args)

  # Build command based on provider
  if [ "$USE_ZENMUX" = true ]; then
    print_info "Using ZenMux GLM 4.7 preset (cheapest)"
    CONTAINER_ID=$(docker create \
      $ENV_ARGS \
      -v "$TEST_CONTENT:/test-content.md:ro" \
      --entrypoint sh \
      "$IMAGE_NAME" \
      -c "looplia config provider preset ZENMUX_ZAI_GLM47 && looplia run writing-kit --file /test-content.md --topics 'ai,healthcare,technology' --tone 'expert'")
  else
    CONTAINER_ID=$(docker create \
      $ENV_ARGS \
      -v "$TEST_CONTENT:/test-content.md:ro" \
      "$IMAGE_NAME" \
      run writing-kit --file /test-content.md \
      --topics "ai,healthcare,technology" \
      --tone "expert")
  fi

  docker start -a "$CONTAINER_ID" || true

  # Copy results from container
  print_step "Extracting results from container..."
  mkdir -p "$WORKSPACE_DIR/markdown-test"
  docker cp "$CONTAINER_ID:/home/looplia/.looplia/." "$WORKSPACE_DIR/markdown-test/"
  docker rm "$CONTAINER_ID" > /dev/null

  # Find sandbox directory
  SANDBOX_DIR=$(find "$WORKSPACE_DIR/markdown-test/sandbox" -maxdepth 1 -type d ! -name sandbox 2>/dev/null | head -1)
  if [ -z "$SANDBOX_DIR" ]; then
    print_fail "No sandbox directory found"
    return 1
  fi
  SANDBOX_ID=$(basename "$SANDBOX_DIR")
  print_pass "Sandbox folder created: $SANDBOX_ID"

  # Verify artifacts exist in outputs/
  print_step "Checking pipeline artifacts..."

  if [ -f "$SANDBOX_DIR/outputs/summary.json" ]; then
    print_pass "outputs/summary.json exists (Stage 1)"
  else
    print_fail "outputs/summary.json NOT found"
  fi

  if [ -f "$SANDBOX_DIR/outputs/ideas.json" ]; then
    print_pass "outputs/ideas.json exists (Stage 2)"
  else
    print_fail "outputs/ideas.json NOT found"
  fi

  if [ -f "$SANDBOX_DIR/outputs/writing-kit.json" ]; then
    print_pass "outputs/writing-kit.json exists (Stage 3)"
  else
    print_fail "outputs/writing-kit.json NOT found"
    return 1
  fi

  # Schema validation
  print_step "Validating outputs/writing-kit.json schema..."
  if jq -e '.contentId and .summary and .ideas and .suggestedOutline' "$SANDBOX_DIR/outputs/writing-kit.json" > /dev/null 2>&1; then
    print_pass "Schema validation passed"
  else
    print_fail "Schema validation failed - missing required fields"
    jq '.' "$SANDBOX_DIR/outputs/writing-kit.json"
    return 1
  fi

  # Quality metrics
  print_step "Checking quality metrics..."

  HOOK_COUNT=$(jq '.ideas.hooks | length' "$SANDBOX_DIR/outputs/writing-kit.json" 2>/dev/null || echo "0")
  SECTION_COUNT=$(jq '.suggestedOutline | length' "$SANDBOX_DIR/outputs/writing-kit.json" 2>/dev/null || echo "0")

  print_info "Hook count: $HOOK_COUNT (expected: >= 2)"
  print_info "Outline sections: $SECTION_COUNT (expected: >= 3)"

  if [ "$HOOK_COUNT" -ge 2 ]; then
    print_pass "Hook count acceptable"
  else
    print_warn "Hook count low"
  fi

  if [ "$SECTION_COUNT" -ge 3 ]; then
    print_pass "Outline section count acceptable"
  else
    print_warn "Outline section count low"
  fi

  # Verify log patterns (subagent/skill usage)
  verify_workflow_log "$SANDBOX_DIR"

  # Check validation state
  check_validation_state "$SANDBOX_DIR"
}

# Test: VTT caption workflow
test_workflow_vtt() {
  print_header "Test 2: VTT Caption Workflow"

  print_step "Running writing-kit workflow on VTT file..."

  ENV_ARGS=$(get_env_args)
  CONTAINER_ID=$(docker create \
    $ENV_ARGS \
    -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
    "$IMAGE_NAME" \
    run writing-kit --file /examples/youtube/Anthropics/captions/EvtPBaaykdo.en.vtt)

  docker start -a "$CONTAINER_ID" || true

  print_step "Extracting results from container..."
  mkdir -p "$WORKSPACE_DIR/vtt-test"
  docker cp "$CONTAINER_ID:/home/looplia/.looplia/." "$WORKSPACE_DIR/vtt-test/"
  docker rm "$CONTAINER_ID" > /dev/null

  # Find sandbox directory
  SANDBOX_DIR=$(find "$WORKSPACE_DIR/vtt-test/sandbox" -maxdepth 1 -type d ! -name sandbox 2>/dev/null | head -1)
  if [ -z "$SANDBOX_DIR" ]; then
    print_fail "No sandbox directory found"
    return 1
  fi
  SANDBOX_ID=$(basename "$SANDBOX_DIR")
  print_pass "Sandbox folder created: $SANDBOX_ID"

  # Check outputs/writing-kit.json exists
  if [ -f "$SANDBOX_DIR/outputs/writing-kit.json" ]; then
    print_pass "outputs/writing-kit.json found"
  else
    print_fail "outputs/writing-kit.json not found"
    return 1
  fi

  # Schema validation
  print_step "Validating VTT writing-kit schema..."
  if jq -e '.contentId and .summary and .ideas' "$SANDBOX_DIR/outputs/writing-kit.json" > /dev/null 2>&1; then
    print_pass "VTT schema validation passed"
  else
    print_fail "VTT schema validation failed"
    return 1
  fi

  # Verify subagent usage
  verify_workflow_log "$SANDBOX_DIR"

  # Check validation state
  check_validation_state "$SANDBOX_DIR"
}

# Test: SRT transcript workflow
test_workflow_srt() {
  print_header "Test 3: SRT Transcript Workflow"

  print_step "Running writing-kit workflow on SRT file..."

  ENV_ARGS=$(get_env_args)
  CONTAINER_ID=$(docker create \
    $ENV_ARGS \
    -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
    "$IMAGE_NAME" \
    run writing-kit --file /examples/youtube/Anthropics/transcripts/CBneTpXF1CQ.srt)

  docker start -a "$CONTAINER_ID" || true

  print_step "Extracting results from container..."
  mkdir -p "$WORKSPACE_DIR/srt-test"
  docker cp "$CONTAINER_ID:/home/looplia/.looplia/." "$WORKSPACE_DIR/srt-test/"
  docker rm "$CONTAINER_ID" > /dev/null

  # Find sandbox directory
  SANDBOX_DIR=$(find "$WORKSPACE_DIR/srt-test/sandbox" -maxdepth 1 -type d ! -name sandbox 2>/dev/null | head -1)
  if [ -z "$SANDBOX_DIR" ]; then
    print_fail "No sandbox directory found"
    return 1
  fi
  SANDBOX_ID=$(basename "$SANDBOX_DIR")
  print_pass "Sandbox folder created: $SANDBOX_ID"

  # Check outputs/writing-kit.json exists
  if [ -f "$SANDBOX_DIR/outputs/writing-kit.json" ]; then
    print_pass "outputs/writing-kit.json found"
  else
    print_fail "outputs/writing-kit.json not found"
    return 1
  fi

  # Schema validation
  print_step "Validating SRT writing-kit schema..."
  if jq -e '.contentId and .summary and .ideas' "$SANDBOX_DIR/outputs/writing-kit.json" > /dev/null 2>&1; then
    print_pass "SRT schema validation passed"
  else
    print_fail "SRT schema validation failed"
    return 1
  fi

  # Verify subagent usage
  verify_workflow_log "$SANDBOX_DIR"

  # Check validation state
  check_validation_state "$SANDBOX_DIR"
}

# Check workspace structure
check_workspace() {
  print_header "Workspace Validation"

  print_step "Checking workspace structure..."

  # Check main test workspace
  if [ -f "$WORKSPACE_DIR/markdown-test/CLAUDE.md" ]; then
    print_pass "CLAUDE.md exists (workspace initialized)"
  else
    print_warn "CLAUDE.md not found"
  fi

  # Check workflows directory
  if [ -d "$WORKSPACE_DIR/markdown-test/workflows" ]; then
    print_pass "workflows/ directory exists"
  else
    print_warn "workflows/ directory not found"
  fi

  # Check .claude structure
  if [ -d "$WORKSPACE_DIR/markdown-test/.claude/agents" ]; then
    AGENT_COUNT=$(ls "$WORKSPACE_DIR/markdown-test/.claude/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
    print_pass ".claude/agents/ exists ($AGENT_COUNT agents)"
  else
    print_warn ".claude/agents/ not found"
  fi

  if [ -d "$WORKSPACE_DIR/markdown-test/.claude/skills" ]; then
    SKILL_COUNT=$(find "$WORKSPACE_DIR/markdown-test/.claude/skills" -maxdepth 1 -type d | wc -l | tr -d ' ')
    SKILL_COUNT=$((SKILL_COUNT - 1))
    print_pass ".claude/skills/ exists ($SKILL_COUNT skills)"
  else
    print_warn ".claude/skills/ not found"
  fi

  # Check sandbox directory (v0.5.2 architecture)
  if [ -d "$WORKSPACE_DIR/markdown-test/sandbox" ]; then
    SANDBOX_COUNT=$(find "$WORKSPACE_DIR/markdown-test/sandbox" -maxdepth 1 -type d | wc -l | tr -d ' ')
    SANDBOX_COUNT=$((SANDBOX_COUNT - 1))
    print_pass "sandbox/ exists ($SANDBOX_COUNT sandboxes)"

    # Check for query logs
    LOG_COUNT=$(find "$WORKSPACE_DIR" -name "*.log" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$LOG_COUNT" -gt 0 ]; then
      print_pass "Query logs found ($LOG_COUNT log files)"
    else
      print_info "No query logs found"
    fi
  else
    print_warn "sandbox/ not found"
  fi
}

# Print summary
print_summary() {
  print_header "Test Summary"

  echo ""
  echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
  echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
  echo -e "  ${YELLOW}Warnings:${NC} $TESTS_WARNED"
  echo ""

  if [ "$TESTS_FAILED" -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
  else
    echo -e "${GREEN}All tests passed!${NC}"
  fi

  echo ""
  echo "Test artifacts saved to: $WORKSPACE_DIR/"
  echo "  - markdown-test/ (Test 1: Markdown source)"
  # echo "  - vtt-test/ (Test 2: VTT caption)"      # Commented out
  # echo "  - srt-test/ (Test 3: SRT transcript)"   # Commented out
  echo ""
  echo "Each sandbox folder contains (v0.6.9 unified executor architecture):"
  echo "  - inputs/content.md (raw input)"
  echo "  - outputs/summary.json (Stage 1)"
  echo "  - outputs/ideas.json (Stage 2)"
  echo "  - outputs/writing-kit.json (Stage 3 - final)"
  echo "  - logs/*.log (query log for verification)"
  echo "  - validation.json (validation state)"
  echo ""
}

# Main execution
main() {
  print_header "Looplia Docker E2E Test Suite"
  echo "  Version: 0.6.9"
  echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  Architecture: Unified Skill Executor with general-purpose Subagent"

  check_prerequisites
  prepare_workspace
  build_project
  test_workflow_markdown
  # test_workflow_vtt   # Commented out - focus on markdown processing
  # test_workflow_srt   # Commented out - focus on markdown processing
  check_workspace
  print_summary
}

# Run main function
main "$@"
