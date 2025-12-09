#!/bin/bash
set -e

# Looplia Docker E2E Test Script
# Runs real API tests inside Docker container and evaluates output quality

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="looplia:test"
WORKSPACE_DIR="./test-workspace"
EXAMPLES_DIR="./examples"
ENV_FILE=".env"

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

# Check prerequisites
check_prerequisites() {
  print_header "Checking Prerequisites"

  # Check .env file
  print_step "Checking .env file..."
  if [ ! -f "$ENV_FILE" ]; then
    print_fail ".env file not found"
    echo ""
    echo "Create .env with your Anthropic API key:"
    echo "  echo 'ANTHROPIC_API_KEY=sk-ant-api03-xxx' > .env"
    exit 1
  fi
  print_pass ".env file exists"

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

  # Check examples directory
  print_step "Checking test fixtures..."
  if [ ! -f "$EXAMPLES_DIR/ai-healthcare.md" ]; then
    print_fail "Test fixture not found: $EXAMPLES_DIR/ai-healthcare.md"
    exit 1
  fi
  print_pass "Test fixtures available"
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

# Run summarize command
test_summarize() {
  print_header "Test 1: Summarize Command"

  print_step "Running summarize with real API..."
  # Run without volume mount - let container bootstrap naturally
  # Then copy results out using docker cp
  CONTAINER_ID=$(docker create \
    --env-file "$ENV_FILE" \
    -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
    "$IMAGE_NAME" \
    summarize --file /examples/ai-healthcare.md \
    --output /home/looplia/.looplia/summary.json)

  docker start -a "$CONTAINER_ID"

  # Copy results from container to local workspace
  print_step "Extracting results from container..."
  docker cp "$CONTAINER_ID:/home/looplia/.looplia/." "$WORKSPACE_DIR/"
  docker rm "$CONTAINER_ID" > /dev/null

  # Level 1: Schema validation
  print_step "Validating summary schema..."
  if jq -e '.headline and .tldr and .bullets and .tags' "$WORKSPACE_DIR/summary.json" > /dev/null 2>&1; then
    print_pass "Schema validation passed"
  else
    print_fail "Schema validation failed - missing required fields"
    jq '.' "$WORKSPACE_DIR/summary.json"
    return 1
  fi

  # Level 2: Quality metrics
  print_step "Checking quality metrics..."

  TLDR_WORDS=$(jq -r '.tldr' "$WORKSPACE_DIR/summary.json" | wc -w | tr -d ' ')
  BULLET_COUNT=$(jq '.bullets | length' "$WORKSPACE_DIR/summary.json")
  TAG_COUNT=$(jq '.tags | length' "$WORKSPACE_DIR/summary.json")

  print_info "TLDR word count: $TLDR_WORDS (expected: 30-200)"
  print_info "Bullet count: $BULLET_COUNT (expected: 3-7)"
  print_info "Tag count: $TAG_COUNT (expected: 3-10)"

  local quality_passed=true

  if [ "$TLDR_WORDS" -ge 30 ] && [ "$TLDR_WORDS" -le 200 ]; then
    print_pass "TLDR length acceptable"
  else
    print_warn "TLDR length out of range"
    quality_passed=false
  fi

  if [ "$BULLET_COUNT" -ge 3 ] && [ "$BULLET_COUNT" -le 7 ]; then
    print_pass "Bullet count acceptable"
  else
    print_warn "Bullet count out of range"
    quality_passed=false
  fi

  if [ "$TAG_COUNT" -ge 3 ]; then
    print_pass "Tag count acceptable"
  else
    print_warn "Tag count low"
    quality_passed=false
  fi

  if [ "$quality_passed" = true ]; then
    print_pass "Quality metrics passed"
  fi
}

# Run kit command
test_kit() {
  print_header "Test 2: Kit Command"

  print_step "Running kit with real API..."
  # Run without volume mount - let container bootstrap naturally
  # Then copy results out using docker cp
  CONTAINER_ID=$(docker create \
    --env-file "$ENV_FILE" \
    -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
    "$IMAGE_NAME" \
    kit --file /examples/ai-healthcare.md \
    --topics "ai,healthcare,technology" \
    --tone "expert" \
    --output /home/looplia/.looplia/kit.json)

  docker start -a "$CONTAINER_ID"

  # Copy results from container to local workspace
  print_step "Extracting results from container..."
  docker cp "$CONTAINER_ID:/home/looplia/.looplia/." "$WORKSPACE_DIR/"
  docker rm "$CONTAINER_ID" > /dev/null

  # Level 1: Schema validation
  print_step "Validating kit schema..."
  if jq -e '.contentId and .summary and .ideas and .suggestedOutline' "$WORKSPACE_DIR/kit.json" > /dev/null 2>&1; then
    print_pass "Schema validation passed"
  else
    print_fail "Schema validation failed - missing required fields"
    jq '.' "$WORKSPACE_DIR/kit.json"
    return 1
  fi

  # Level 2: Quality metrics
  print_step "Checking quality metrics..."

  HOOK_COUNT=$(jq '.ideas.hooks | length' "$WORKSPACE_DIR/kit.json")
  ANGLE_COUNT=$(jq '.ideas.angles | length' "$WORKSPACE_DIR/kit.json")
  QUESTION_COUNT=$(jq '.ideas.questions | length' "$WORKSPACE_DIR/kit.json")
  SECTION_COUNT=$(jq '.suggestedOutline | length' "$WORKSPACE_DIR/kit.json")

  print_info "Hook count: $HOOK_COUNT (expected: >= 2)"
  print_info "Angle count: $ANGLE_COUNT (expected: >= 2)"
  print_info "Question count: $QUESTION_COUNT (expected: >= 2)"
  print_info "Outline sections: $SECTION_COUNT (expected: >= 3)"

  local quality_passed=true

  if [ "$HOOK_COUNT" -ge 2 ]; then
    print_pass "Hook count acceptable"
  else
    print_warn "Hook count low"
    quality_passed=false
  fi

  if [ "$ANGLE_COUNT" -ge 2 ]; then
    print_pass "Angle count acceptable"
  else
    print_warn "Angle count low"
    quality_passed=false
  fi

  if [ "$QUESTION_COUNT" -ge 2 ]; then
    print_pass "Question count acceptable"
  else
    print_warn "Question count low"
    quality_passed=false
  fi

  if [ "$SECTION_COUNT" -ge 3 ]; then
    print_pass "Outline section count acceptable"
  else
    print_warn "Outline section count low"
    quality_passed=false
  fi

  if [ "$quality_passed" = true ]; then
    print_pass "Quality metrics passed"
  fi
}

# Check workspace structure
check_workspace() {
  print_header "Workspace Validation"

  print_step "Checking workspace structure..."

  if [ -f "$WORKSPACE_DIR/CLAUDE.md" ]; then
    print_pass "CLAUDE.md exists (workspace initialized)"
  else
    print_warn "CLAUDE.md not found"
  fi

  if [ -d "$WORKSPACE_DIR/contentItem" ]; then
    SESSION_COUNT=$(find "$WORKSPACE_DIR/contentItem" -maxdepth 1 -type d | wc -l | tr -d ' ')
    SESSION_COUNT=$((SESSION_COUNT - 1))
    print_pass "contentItem directory exists ($SESSION_COUNT sessions)"

    # Check for query logs (v0.3.3 feature)
    LOG_COUNT=$(find "$WORKSPACE_DIR/contentItem" -name "query-*.log" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$LOG_COUNT" -gt 0 ]; then
      print_pass "Query logs found ($LOG_COUNT log files)"
    else
      print_info "No query logs found (may be expected)"
    fi
  else
    print_warn "contentItem directory not found"
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
  echo "  - summary.json"
  echo "  - kit.json"
  echo "  - contentItem/ (session data)"
  echo ""
}

# Main execution
main() {
  print_header "Looplia Docker E2E Test Suite"
  echo "  Version: 0.3.3"
  echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"

  check_prerequisites
  prepare_workspace
  build_project
  test_summarize
  test_kit
  check_workspace
  print_summary
}

# Run main function
main "$@"
