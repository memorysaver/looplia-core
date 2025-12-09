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
  print_pass "Markdown fixture available"

  # Check youtube fixtures
  print_step "Checking YouTube test fixtures..."
  if [ ! -f "$EXAMPLES_DIR/youtube/Anthropics/captions/EvtPBaaykdo.en.vtt" ]; then
    print_fail "VTT fixture not found: $EXAMPLES_DIR/youtube/Anthropics/captions/EvtPBaaykdo.en.vtt"
    exit 1
  fi
  print_pass "VTT fixture available"

  if [ ! -f "$EXAMPLES_DIR/youtube/Anthropics/transcripts/CBneTpXF1CQ.srt" ]; then
    print_fail "SRT fixture not found: $EXAMPLES_DIR/youtube/Anthropics/transcripts/CBneTpXF1CQ.srt"
    exit 1
  fi
  print_pass "SRT fixture available"

  if [ ! -f "$EXAMPLES_DIR/youtube/Anthropics/transcripts/CBneTpXF1CQ.json" ]; then
    print_fail "JSON fixture not found: $EXAMPLES_DIR/youtube/Anthropics/transcripts/CBneTpXF1CQ.json"
    exit 1
  fi
  print_pass "JSON transcript fixture available"
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

# Test VTT caption summarization
test_vtt_summarize() {
  print_header "Test 3: Summarize VTT Caption"

  print_step "Running summarize on VTT file..."
  # Run without --output to let it save to session folder naturally
  CONTAINER_ID=$(docker create \
    --env-file "$ENV_FILE" \
    -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
    "$IMAGE_NAME" \
    summarize --file /examples/youtube/Anthropics/captions/EvtPBaaykdo.en.vtt)

  docker start -a "$CONTAINER_ID"

  print_step "Extracting results from container..."
  # Copy to a unique subfolder to preserve session data
  mkdir -p "$WORKSPACE_DIR/vtt-test"
  docker cp "$CONTAINER_ID:/home/looplia/.looplia/." "$WORKSPACE_DIR/vtt-test/"
  docker rm "$CONTAINER_ID" > /dev/null

  # Find the session folder (should be contentItem/{sessionId}/)
  print_step "Checking session folder structure..."
  SESSION_DIR=$(find "$WORKSPACE_DIR/vtt-test/contentItem" -maxdepth 1 -type d ! -name contentItem 2>/dev/null | head -1)
  if [ -n "$SESSION_DIR" ]; then
    SESSION_ID=$(basename "$SESSION_DIR")
    print_pass "Session folder created: $SESSION_ID"
  else
    print_fail "No session folder found in contentItem/"
    ls -la "$WORKSPACE_DIR/vtt-test/contentItem/" 2>/dev/null || echo "contentItem folder missing"
    return 1
  fi

  # Check summary.json exists in session folder
  SUMMARY_FILE="$SESSION_DIR/summary.json"
  if [ -f "$SUMMARY_FILE" ]; then
    print_pass "summary.json found in session folder"
  else
    print_fail "summary.json not found in session folder"
    ls -la "$SESSION_DIR/" 2>/dev/null
    return 1
  fi

  # Schema validation
  print_step "Validating VTT summary schema..."
  if jq -e '.headline and .tldr and .bullets and .tags' "$SUMMARY_FILE" > /dev/null 2>&1; then
    print_pass "VTT schema validation passed"
  else
    print_fail "VTT schema validation failed - missing required fields"
    jq '.' "$SUMMARY_FILE" 2>/dev/null || cat "$SUMMARY_FILE"
    return 1
  fi

  # Source type detection validation
  print_step "Checking source type detection..."
  DETECTED_SOURCE=$(jq -r '.detectedSource // empty' "$SUMMARY_FILE")
  if [ -n "$DETECTED_SOURCE" ]; then
    print_pass "Source detected: $DETECTED_SOURCE"
  else
    print_warn "No source type detected (detectedSource field empty)"
  fi

  # Quality check
  TLDR_WORDS=$(jq -r '.tldr' "$SUMMARY_FILE" | wc -w | tr -d ' ')
  print_info "VTT TLDR word count: $TLDR_WORDS"
  if [ "$TLDR_WORDS" -ge 20 ]; then
    print_pass "VTT content extracted successfully"
  else
    print_warn "VTT TLDR seems short"
  fi
}

# Test SRT transcript summarization
test_srt_summarize() {
  print_header "Test 4: Summarize SRT Transcript"

  print_step "Running summarize on SRT file..."
  # Run without --output to let it save to session folder naturally
  CONTAINER_ID=$(docker create \
    --env-file "$ENV_FILE" \
    -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
    "$IMAGE_NAME" \
    summarize --file /examples/youtube/Anthropics/transcripts/CBneTpXF1CQ.srt)

  docker start -a "$CONTAINER_ID"

  print_step "Extracting results from container..."
  # Copy to a unique subfolder to preserve session data
  mkdir -p "$WORKSPACE_DIR/srt-test"
  docker cp "$CONTAINER_ID:/home/looplia/.looplia/." "$WORKSPACE_DIR/srt-test/"
  docker rm "$CONTAINER_ID" > /dev/null

  # Find the session folder
  print_step "Checking session folder structure..."
  SESSION_DIR=$(find "$WORKSPACE_DIR/srt-test/contentItem" -maxdepth 1 -type d ! -name contentItem 2>/dev/null | head -1)
  if [ -n "$SESSION_DIR" ]; then
    SESSION_ID=$(basename "$SESSION_DIR")
    print_pass "Session folder created: $SESSION_ID"
  else
    print_fail "No session folder found in contentItem/"
    return 1
  fi

  # Check summary.json exists in session folder
  SUMMARY_FILE="$SESSION_DIR/summary.json"
  if [ -f "$SUMMARY_FILE" ]; then
    print_pass "summary.json found in session folder"
  else
    print_fail "summary.json not found in session folder"
    return 1
  fi

  # Schema validation
  print_step "Validating SRT summary schema..."
  if jq -e '.headline and .tldr and .bullets and .tags' "$SUMMARY_FILE" > /dev/null 2>&1; then
    print_pass "SRT schema validation passed"
  else
    print_fail "SRT schema validation failed - missing required fields"
    jq '.' "$SUMMARY_FILE" 2>/dev/null || cat "$SUMMARY_FILE"
    return 1
  fi

  # Quality check
  TLDR_WORDS=$(jq -r '.tldr' "$SUMMARY_FILE" | wc -w | tr -d ' ')
  print_info "SRT TLDR word count: $TLDR_WORDS"
  if [ "$TLDR_WORDS" -ge 20 ]; then
    print_pass "SRT content extracted successfully"
  else
    print_warn "SRT TLDR seems short"
  fi
}

# Test JSON transcript summarization (Whisper output)
test_json_summarize() {
  print_header "Test 5: Summarize JSON Transcript"

  print_step "Running summarize on JSON transcript..."
  # Run without --output to let it save to session folder naturally
  CONTAINER_ID=$(docker create \
    --env-file "$ENV_FILE" \
    -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
    "$IMAGE_NAME" \
    summarize --file /examples/youtube/Anthropics/transcripts/CBneTpXF1CQ.json)

  docker start -a "$CONTAINER_ID"

  print_step "Extracting results from container..."
  # Copy to a unique subfolder to preserve session data
  mkdir -p "$WORKSPACE_DIR/json-test"
  docker cp "$CONTAINER_ID:/home/looplia/.looplia/." "$WORKSPACE_DIR/json-test/"
  docker rm "$CONTAINER_ID" > /dev/null

  # Find the session folder
  print_step "Checking session folder structure..."
  SESSION_DIR=$(find "$WORKSPACE_DIR/json-test/contentItem" -maxdepth 1 -type d ! -name contentItem 2>/dev/null | head -1)
  if [ -n "$SESSION_DIR" ]; then
    SESSION_ID=$(basename "$SESSION_DIR")
    print_pass "Session folder created: $SESSION_ID"
  else
    print_fail "No session folder found in contentItem/"
    return 1
  fi

  # Check summary.json exists in session folder
  SUMMARY_FILE="$SESSION_DIR/summary.json"
  if [ -f "$SUMMARY_FILE" ]; then
    print_pass "summary.json found in session folder"
  else
    print_fail "summary.json not found in session folder"
    return 1
  fi

  # Schema validation
  print_step "Validating JSON transcript summary schema..."
  if jq -e '.headline and .tldr and .bullets and .tags' "$SUMMARY_FILE" > /dev/null 2>&1; then
    print_pass "JSON transcript schema validation passed"
  else
    print_fail "JSON transcript schema validation failed - missing required fields"
    jq '.' "$SUMMARY_FILE" 2>/dev/null || cat "$SUMMARY_FILE"
    return 1
  fi

  # Quality check
  TLDR_WORDS=$(jq -r '.tldr' "$SUMMARY_FILE" | wc -w | tr -d ' ')
  print_info "JSON transcript TLDR word count: $TLDR_WORDS"
  if [ "$TLDR_WORDS" -ge 20 ]; then
    print_pass "JSON transcript content extracted successfully"
  else
    print_warn "JSON transcript TLDR seems short"
  fi
}

# Test kit command with SRT transcript
test_kit_with_srt() {
  print_header "Test 6: Kit Command with SRT Transcript"

  print_step "Running kit on SRT file..."
  # Run without --output to let it save to session folder naturally
  CONTAINER_ID=$(docker create \
    --env-file "$ENV_FILE" \
    -v "$(pwd)/$EXAMPLES_DIR:/examples:ro" \
    "$IMAGE_NAME" \
    kit --file /examples/youtube/Anthropics/transcripts/CBneTpXF1CQ.srt \
    --topics "coding,claude,automation" \
    --tone "expert")

  docker start -a "$CONTAINER_ID"

  print_step "Extracting results from container..."
  # Copy to a unique subfolder to preserve session data
  mkdir -p "$WORKSPACE_DIR/kit-srt-test"
  docker cp "$CONTAINER_ID:/home/looplia/.looplia/." "$WORKSPACE_DIR/kit-srt-test/"
  docker rm "$CONTAINER_ID" > /dev/null

  # Find the session folder
  print_step "Checking session folder structure..."
  SESSION_DIR=$(find "$WORKSPACE_DIR/kit-srt-test/contentItem" -maxdepth 1 -type d ! -name contentItem 2>/dev/null | head -1)
  if [ -n "$SESSION_DIR" ]; then
    SESSION_ID=$(basename "$SESSION_DIR")
    print_pass "Session folder created: $SESSION_ID"
  else
    print_fail "No session folder found in contentItem/"
    return 1
  fi

  # Check writing-kit.json exists in session folder
  KIT_FILE="$SESSION_DIR/writing-kit.json"
  if [ -f "$KIT_FILE" ]; then
    print_pass "writing-kit.json found in session folder"
  else
    print_fail "writing-kit.json not found in session folder"
    ls -la "$SESSION_DIR/" 2>/dev/null
    return 1
  fi

  # Schema validation
  print_step "Validating SRT kit schema..."
  if jq -e '.contentId and .summary and .ideas and .suggestedOutline' "$KIT_FILE" > /dev/null 2>&1; then
    print_pass "SRT kit schema validation passed"
  else
    print_fail "SRT kit schema validation failed - missing required fields"
    jq '.' "$KIT_FILE" 2>/dev/null || cat "$KIT_FILE"
    return 1
  fi

  # Quality metrics
  print_step "Checking SRT kit quality metrics..."
  HOOK_COUNT=$(jq '.ideas.hooks | length' "$KIT_FILE")
  SECTION_COUNT=$(jq '.suggestedOutline | length' "$KIT_FILE")

  print_info "Hook count: $HOOK_COUNT (expected: >= 2)"
  print_info "Outline sections: $SECTION_COUNT (expected: >= 3)"

  if [ "$HOOK_COUNT" -ge 2 ]; then
    print_pass "SRT kit hook count acceptable"
  else
    print_warn "SRT kit hook count low"
  fi

  if [ "$SECTION_COUNT" -ge 3 ]; then
    print_pass "SRT kit outline section count acceptable"
  else
    print_warn "SRT kit outline section count low"
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
  echo "  - contentItem/ (Test 1-2: markdown source)"
  echo "  - vtt-test/contentItem/{sessionId}/ (Test 3: VTT caption)"
  echo "  - srt-test/contentItem/{sessionId}/ (Test 4: SRT transcript)"
  echo "  - json-test/contentItem/{sessionId}/ (Test 5: JSON transcript)"
  echo "  - kit-srt-test/contentItem/{sessionId}/ (Test 6: SRT full kit)"
  echo ""
  echo "Each session folder contains:"
  echo "  - content.md (raw input)"
  echo "  - summary.json (analysis output)"
  echo "  - writing-kit.json (full kit, if kit command)"
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
  test_vtt_summarize
  test_srt_summarize
  test_json_summarize
  test_kit_with_srt
  check_workspace
  print_summary
}

# Run main function
main "$@"
