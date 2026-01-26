#!/usr/bin/env bash
# Simple E2E test for looplia CLI
# Tests: build → init → configure → run workflow → verify outputs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CLI="bun $PROJECT_ROOT/apps/cli/dist/cli.js"
TEST_FILE="$SCRIPT_DIR/../assets/ai-healthcare.md"

echo "=== Looplia E2E Test ==="
echo "Project: $PROJECT_ROOT"
echo ""

# 1. Load .env to get ZENMUX_API_KEY
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
  if [[ -n "$ZENMUX_API_KEY" ]]; then
    echo "✓ Loaded .env (ZENMUX_API_KEY set)"
  else
    echo "✗ .env loaded but ZENMUX_API_KEY not found"
    exit 1
  fi
else
  echo "✗ .env not found - ZENMUX_API_KEY required"
  echo "  Create .env with: ZENMUX_API_KEY=your-key"
  exit 1
fi

# 2. Build source
echo ""
echo "Building source..."
if ! (cd "$PROJECT_ROOT" && bun run build); then
  echo "✗ Build failed"
  exit 1
fi
echo "✓ Build complete"

# 3. Remove ~/.looplia for fresh start
echo ""
echo "Removing ~/.looplia for fresh start..."
rm -rf ~/.looplia
echo "✓ Workspace cleared"

# 4. Init workspace using dist CLI
echo ""
echo "Initializing workspace..."
if ! $CLI init --yes; then
  echo "✗ Init failed"
  exit 1
fi
echo "✓ Workspace initialized"

# 5. Configure ZenMux MiniMax M2.1 preset
echo ""
echo "Configuring provider preset..."
if ! $CLI config provider preset ZENMUX_MINIMAX_M21; then
  echo "✗ Config failed"
  exit 1
fi
echo "✓ Provider configured: ZENMUX_MINIMAX_M21"

# 6. Test build command (workflow generation)
echo ""
echo "Testing build command..."
BUILD_EXIT_CODE=0
$CLI build "read hacker news and select top 5 ai news that has traction for my social account then compile it into one markdown file for me" --name e2e-build-test --no-interactive || BUILD_EXIT_CODE=$?

if [[ $BUILD_EXIT_CODE -ne 0 ]]; then
  echo ""
  echo "⚠ Build exited with code $BUILD_EXIT_CODE"
else
  echo "✓ Build command completed"
fi

# Verify build result
BUILD_WORKFLOW="$HOME/.looplia/workflows/e2e-build-test.md"
BUILD_SANDBOX=$(find ~/.looplia/sandbox -maxdepth 1 -type d -name "build-*" 2>/dev/null | sort -r | head -1)

echo ""
echo "Build verification:"
if [[ -f "$BUILD_WORKFLOW" ]]; then
  echo "  ✓ Workflow file created: $BUILD_WORKFLOW"
  BUILD_WORKFLOW_EXISTS=1
else
  echo "  ✗ Workflow file not created"
  BUILD_WORKFLOW_EXISTS=0
fi

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

# 7. Run writing-kit workflow with ai-healthcare.md
echo ""
echo "Running writing-kit workflow..."
echo "File: $TEST_FILE"
WORKFLOW_EXIT_CODE=0
$CLI run writing-kit --file "$TEST_FILE" || WORKFLOW_EXIT_CODE=$?

if [[ $WORKFLOW_EXIT_CODE -ne 0 ]]; then
  echo ""
  echo "⚠ Workflow exited with code $WORKFLOW_EXIT_CODE"
fi

# 8. Verify run results (always run verification)
echo ""
echo "=== Run Verification ==="

# Find run sandbox directory (most recent non-build)
SANDBOX=$(find ~/.looplia/sandbox -maxdepth 1 -type d ! -name sandbox ! -name "build-*" 2>/dev/null | sort -r | head -1)

if [[ -z "$SANDBOX" ]]; then
  echo "✗ No sandbox directory found"
  exit 1
fi

echo "Sandbox: $SANDBOX"

# Check outputs
echo ""
echo "Output files:"
OUTPUT_COUNT=0
if [[ -f "$SANDBOX/outputs/summary.json" ]]; then
  echo "  ✓ summary.json"
  ((OUTPUT_COUNT++))
else
  echo "  ✗ summary.json"
fi
if [[ -f "$SANDBOX/outputs/ideas.json" ]]; then
  echo "  ✓ ideas.json"
  ((OUTPUT_COUNT++))
else
  echo "  ✗ ideas.json"
fi
if [[ -f "$SANDBOX/outputs/writing-kit.json" ]]; then
  echo "  ✓ writing-kit.json"
  ((OUTPUT_COUNT++))
else
  echo "  ✗ writing-kit.json"
fi

# Check validation state
VALIDATED=0
TOTAL=0
if [[ -f "$SANDBOX/validation.json" ]]; then
  VALIDATED=$(jq '[.steps | to_entries[] | select(.value.validated == true)] | length' "$SANDBOX/validation.json" 2>/dev/null || echo 0)
  TOTAL=$(jq '.steps | length' "$SANDBOX/validation.json" 2>/dev/null || echo 0)
  echo ""
  echo "Validation: $VALIDATED/$TOTAL steps validated"
else
  echo ""
  echo "✗ validation.json not found"
fi

# Check log for tool calls
LOG=$(ls "$SANDBOX/logs/"*.log 2>/dev/null | head -1)

if [[ -n "$LOG" && -f "$LOG" ]]; then
  echo ""
  echo "Log analysis:"
  TASK_CALLS=$(grep -c '"name"[[:space:]]*:[[:space:]]*"Task"' "$LOG" 2>/dev/null || echo 0)
  SUBAGENT_CALLS=$(grep -c '"subagent_type"[[:space:]]*:[[:space:]]*"general-purpose"' "$LOG" 2>/dev/null || echo 0)
  SKILL_CALLS=$(grep -c '"name"[[:space:]]*:[[:space:]]*"Skill"' "$LOG" 2>/dev/null || echo 0)

  echo "  Task tool calls: $TASK_CALLS"
  echo "  Subagent (general-purpose): $SUBAGENT_CALLS"
  echo "  Skill tool calls: $SKILL_CALLS"
else
  echo ""
  echo "✗ No log file found"
fi

# Summary
echo ""
echo "=== Summary ==="
echo ""
echo "Build command:"
echo "  Workflow created: $([[ $BUILD_WORKFLOW_EXISTS -eq 1 ]] && echo "yes" || echo "no")"
echo "  Workflow validated: $BUILD_VALIDATED"
echo ""
echo "Run command:"
echo "  Outputs: $OUTPUT_COUNT/3"
echo "  Steps validated: $VALIDATED/$TOTAL"

# Determine overall pass/fail
BUILD_PASSED=0
RUN_PASSED=0

if [[ $BUILD_WORKFLOW_EXISTS -eq 1 ]] && [[ "$BUILD_VALIDATED" == "true" ]]; then
  BUILD_PASSED=1
fi

if [[ -f "$SANDBOX/outputs/writing-kit.json" ]] && [[ "$VALIDATED" -ge 3 ]]; then
  RUN_PASSED=1
fi

echo ""
if [[ $BUILD_PASSED -eq 1 ]] && [[ $RUN_PASSED -eq 1 ]]; then
  echo "✓ E2E test PASSED (build + run)"
  exit 0
elif [[ $BUILD_PASSED -eq 1 ]]; then
  echo "⚠ E2E test PARTIAL (build passed, run failed)"
  if [[ $WORKFLOW_EXIT_CODE -ne 0 ]]; then
    echo "  Workflow exit code: $WORKFLOW_EXIT_CODE"
  fi
  if [[ $OUTPUT_COUNT -lt 3 ]]; then
    echo "  Missing outputs: $((3 - OUTPUT_COUNT))"
  fi
  if [[ "$VALIDATED" -lt 3 ]]; then
    echo "  Unvalidated steps: $((TOTAL - VALIDATED))"
  fi
  exit 1
elif [[ $RUN_PASSED -eq 1 ]]; then
  echo "⚠ E2E test PARTIAL (run passed, build failed)"
  if [[ $BUILD_EXIT_CODE -ne 0 ]]; then
    echo "  Build exit code: $BUILD_EXIT_CODE"
  fi
  exit 1
else
  echo "✗ E2E test FAILED (both build and run)"
  if [[ $BUILD_EXIT_CODE -ne 0 ]]; then
    echo "  Build exit code: $BUILD_EXIT_CODE"
  fi
  if [[ $WORKFLOW_EXIT_CODE -ne 0 ]]; then
    echo "  Workflow exit code: $WORKFLOW_EXIT_CODE"
  fi
  exit 1
fi
