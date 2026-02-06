#!/usr/bin/env bash
# E2E Test Suite - Orchestrates all E2E tests
#
# Usage:
#   ./e2e.sh                 # Run all tests
#   ./e2e.sh --test auto     # Run only auto-discovery test
#   ./e2e.sh --test workflow # Run only workflow test

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/e2e-setup.sh"

# Parse args
RUN_ALL=1
RUN_AUTO=0
RUN_WORKFLOW=0
NEXT_IS_TEST=0

for arg in "$@"; do
  if [[ $NEXT_IS_TEST -eq 1 ]]; then
    case $arg in
      auto|auto-discovery)
        RUN_AUTO=1
        RUN_ALL=0
        ;;
      workflow|run)
        RUN_WORKFLOW=1
        RUN_ALL=0
        ;;
    esac
    NEXT_IS_TEST=0
  else
    case $arg in
      --test)
        NEXT_IS_TEST=1
        ;;
    esac
  fi
done

# Default: run all
if [[ $RUN_ALL -eq 1 ]]; then
  RUN_AUTO=1
  RUN_WORKFLOW=1
fi

echo "=== Looplia E2E Test Suite ==="
echo ""

# Shared setup (only once)
setup_test_env || exit 1

# Track results
TESTS_PASSED=0
TESTS_FAILED=0

# --- Run auto-discovery test ---
if [[ $RUN_AUTO -eq 1 ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  AUTO_RESULT=0
  "$SCRIPT_DIR/e2e-auto-discovery.sh" --skip-setup || AUTO_RESULT=$?
  if [[ $AUTO_RESULT -eq 0 ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

# --- Run workflow test ---
if [[ $RUN_WORKFLOW -eq 1 ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "=== E2E Test: Workflow Execution ==="
  echo ""

  # Run writing-kit workflow
  echo "Running writing-kit workflow..."
  WORKFLOW_EXIT=0
  $CLI run writing-kit --file "$TEST_CONTENT" || WORKFLOW_EXIT=$?

  # Verify outputs
  SANDBOX=$(find "$TEST_WORKSPACE/sandbox" -maxdepth 1 -type d ! -name sandbox ! -name "build-*" 2>/dev/null | sort -r | head -1)

  if [[ -z "$SANDBOX" ]]; then
    echo "✗ No run sandbox found"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  else
    echo "Sandbox: $SANDBOX"
    echo ""
    echo "Output files:"

    OUTPUT_COUNT=0
    for file in summary.json ideas.json writing-kit.json; do
      if [[ -f "$SANDBOX/outputs/$file" ]]; then
        echo "  ✓ $file"
        OUTPUT_COUNT=$((OUTPUT_COUNT + 1))
      else
        echo "  ✗ $file"
      fi
    done

    # Check validation
    VALIDATED=0
    if [[ -f "$SANDBOX/validation.json" ]]; then
      VALIDATED=$(jq '[.steps | to_entries[] | select(.value.validated == true)] | length' "$SANDBOX/validation.json" 2>/dev/null || echo 0)
    fi

    echo ""
    echo "Validation: $VALIDATED/3 steps validated"

    if [[ $OUTPUT_COUNT -ge 3 ]] && [[ $VALIDATED -ge 3 ]]; then
      echo ""
      echo "✓ Workflow E2E test PASSED"
      TESTS_PASSED=$((TESTS_PASSED + 1))
    else
      echo ""
      echo "✗ Workflow E2E test FAILED"
      TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
  fi
fi

# --- Final Summary ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "=== E2E Test Suite Summary ==="
echo ""
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
  echo "✓ All E2E tests PASSED"
  exit 0
else
  echo "✗ Some E2E tests FAILED"
  exit 1
fi
