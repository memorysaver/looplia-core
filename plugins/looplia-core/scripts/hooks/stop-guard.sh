#!/bin/bash
# Workflow Completion Guard Hook (v0.6.1)
# Triggered: When main agent attempts to stop
# Action: Block if any step has validated: false OR output files missing

set -euo pipefail

INPUT=$(cat)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# Prevent infinite loop
if [[ "$STOP_HOOK_ACTIVE" == "true" ]]; then
  exit 0
fi

# Find active sandbox (most recently modified sandbox directory)
SANDBOX_BASE="${HOME}/.looplia/sandbox"
if [[ ! -d "$SANDBOX_BASE" ]]; then
  exit 0
fi

# Sort by modification time (newest first) to get most recent sandbox
SANDBOX_DIR=$(ls -td "$SANDBOX_BASE"/*/ 2>/dev/null | head -1 | sed 's:/$::')
if [[ -z "$SANDBOX_DIR" ]]; then
  exit 0
fi

VALIDATION_JSON="$SANDBOX_DIR/validation.json"
if [[ ! -f "$VALIDATION_JSON" ]]; then
  exit 0
fi

# Check for missing output files first (more actionable feedback)
MISSING=""
for step in $(jq -r '.steps | keys[]' "$VALIDATION_JSON" 2>/dev/null); do
  OUTPUT_PATH=$(jq -r --arg s "$step" '.steps[$s].output // empty' "$VALIDATION_JSON" 2>/dev/null)
  if [[ -n "$OUTPUT_PATH" && ! -f "$OUTPUT_PATH" ]]; then
    MISSING="$MISSING $step"
  fi
done

if [[ -n "$MISSING" ]]; then
  # Following ralph-loop pattern: reason field is the continuation prompt fed back to agent
  REASON="Your workflow is not complete. You still need to create output files for these steps:$MISSING. Please continue working on the workflow by using the Write tool to create the required JSON files at the paths specified in validation.json for each incomplete step. Do not stop until all workflow steps have their output files created."
  echo "{\"decision\": \"block\", \"reason\": \"$REASON\"}"
  exit 0
fi

# Check all steps are validated (v0.6.0 uses "steps" not "outputs")
PENDING=$(jq -r '.steps | to_entries[] | select(.value.validated == false) | .key' "$VALIDATION_JSON" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')

if [[ -n "$PENDING" ]]; then
  # Following ralph-loop pattern: reason field is the continuation prompt fed back to agent
  REASON="Your workflow is not complete. The following steps need validation: $PENDING. The output files exist but have not been validated yet. Please re-write these output files using the Write tool to trigger validation. Do not stop until all workflow steps are validated."
  echo "{\"decision\": \"block\", \"reason\": \"$REASON\"}"
  exit 0
fi

# All validated - allow stop
exit 0
