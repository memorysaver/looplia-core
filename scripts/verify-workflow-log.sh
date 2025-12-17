#!/bin/bash
# verify-workflow-log.sh
# Verifies that workflow execution used correct subagents and skills

set -e

LOG_FILE=$1

if [ -z "$LOG_FILE" ]; then
  # Try to find the latest log file
  LOG_FILE=$(ls -t ~/.looplia/contentItem/*/logs/*.log 2>/dev/null | head -1)

  if [ -z "$LOG_FILE" ]; then
    echo "Usage: ./verify-workflow-log.sh <log-file>"
    echo "   or: ./verify-workflow-log.sh (auto-detect latest log)"
    exit 1
  fi
fi

echo "=== Workflow Log Verification ==="
echo "Log: $LOG_FILE"
echo ""

PASS=true

# Check for custom subagent types
echo "1. Custom Subagent Types:"
if grep -q '"subagent_type".*"content-analyzer"' "$LOG_FILE"; then
  echo "   ✓ content-analyzer"
else
  echo "   ✗ content-analyzer NOT FOUND"
  PASS=false
fi

if grep -q '"subagent_type".*"idea-generator"' "$LOG_FILE"; then
  echo "   ✓ idea-generator"
else
  echo "   ✗ idea-generator NOT FOUND"
  PASS=false
fi

if grep -q '"subagent_type".*"writing-kit-builder"' "$LOG_FILE"; then
  echo "   ✓ writing-kit-builder"
else
  echo "   ✗ writing-kit-builder NOT FOUND"
  PASS=false
fi

# Check for general-purpose (should NOT exist)
if grep -q '"subagent_type".*"general-purpose"' "$LOG_FILE"; then
  echo "   ✗ FAIL: general-purpose subagent detected!"
  PASS=false
else
  echo "   ✓ No general-purpose subagent"
fi

echo ""

# Check for Task tool invocations
TASK_COUNT=$(grep -c '"name".*"Task"' "$LOG_FILE" 2>/dev/null || echo "0")
echo "2. Task Tool Invocations: $TASK_COUNT (expected: 3)"
if [ "$TASK_COUNT" -lt 3 ]; then
  echo "   ⚠ Warning: Expected at least 3 Task invocations"
fi

echo ""

# Check for Skill tool invocations
SKILL_COUNT=$(grep -c '"name".*"Skill"' "$LOG_FILE" 2>/dev/null || echo "0")
echo "3. Skill Tool Invocations: $SKILL_COUNT"

echo ""

# Check for validation script
VALIDATE_COUNT=$(grep -c "validate.ts" "$LOG_FILE" 2>/dev/null || echo "0")
echo "4. Validation Script Calls: $VALIDATE_COUNT (expected: 3)"
if [ "$VALIDATE_COUNT" -lt 3 ]; then
  echo "   ⚠ Warning: Expected at least 3 validation script calls"
fi

echo ""

# Check validation.json if available
SESSION_DIR=$(dirname "$(dirname "$LOG_FILE")")
VALIDATION_FILE="$SESSION_DIR/validation.json"

if [ -f "$VALIDATION_FILE" ]; then
  echo "5. Validation State:"

  # Check each output's validated status
  for output in summary ideas writing-kit; do
    VALIDATED=$(cat "$VALIDATION_FILE" | grep -A5 "\"$output\"" | grep "validated" | grep -o "true\|false" | head -1)
    if [ "$VALIDATED" = "true" ]; then
      echo "   ✓ $output: validated"
    else
      echo "   ✗ $output: NOT validated"
      PASS=false
    fi
  done
else
  echo "5. Validation State: (validation.json not found)"
fi

echo ""
echo "=== Verification Complete ==="

if [ "$PASS" = true ]; then
  echo "Result: ✓ PASS"
  exit 0
else
  echo "Result: ✗ FAIL"
  exit 1
fi
