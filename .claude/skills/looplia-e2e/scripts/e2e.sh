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

# 6. Run writing-kit workflow with ai-healthcare.md
echo ""
echo "Running writing-kit workflow..."
echo "File: $TEST_FILE"
WORKFLOW_EXIT_CODE=0
$CLI run writing-kit --file "$TEST_FILE" || WORKFLOW_EXIT_CODE=$?

if [[ $WORKFLOW_EXIT_CODE -ne 0 ]]; then
  echo ""
  echo "⚠ Workflow exited with code $WORKFLOW_EXIT_CODE"
fi

# 7. Verify results (always run verification)
echo ""
echo "=== Verification ==="

# Find sandbox directory (most recent)
SANDBOX=$(find ~/.looplia/sandbox -maxdepth 1 -type d ! -name sandbox 2>/dev/null | sort -r | head -1)

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
echo "Outputs: $OUTPUT_COUNT/3"
echo "Validated: $VALIDATED/$TOTAL"

if [[ -f "$SANDBOX/outputs/writing-kit.json" ]] && [[ "$VALIDATED" -ge 3 ]]; then
  echo ""
  echo "✓ E2E test PASSED"
  exit 0
else
  echo ""
  echo "✗ E2E test FAILED"
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
fi
