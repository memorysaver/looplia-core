#!/bin/bash
# Workflow Completion Guard Hook
# Triggered: When main agent attempts to stop
# Action: Block if any output has validated: false

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

# Check all outputs are validated
PENDING=$(jq -r '.outputs | to_entries[] | select(.value.validated == false) | .key' "$VALIDATION_JSON" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')

if [[ -n "$PENDING" ]]; then
  echo "{\"decision\": \"block\", \"reason\": \"Workflow incomplete. Pending outputs: $PENDING\"}"
  exit 0
fi

# All validated - allow stop
exit 0
