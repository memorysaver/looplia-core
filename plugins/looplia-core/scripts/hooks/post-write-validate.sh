#!/bin/bash
# Post-Write Artifact Validator Hook (v0.6.0)
# Triggered: When Write tool completes
# Action: Run semantic validation via validate.ts for sandbox outputs

set -euo pipefail

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only process sandbox/ files (matches sandbox/{id}/outputs/*.json pattern)
if [[ "$FILE_PATH" != *"/sandbox/"* ]]; then
  exit 0
fi

# Check if it's in outputs/ directory
if [[ "$FILE_PATH" != *"/outputs/"* ]]; then
  exit 0
fi

# Extract sandbox directory and artifact name
SANDBOX_DIR=$(dirname "$(dirname "$FILE_PATH")")
ARTIFACT=$(basename "$FILE_PATH" .json)
VALIDATION_JSON="$SANDBOX_DIR/validation.json"

# Check for validation.json
if [[ ! -f "$VALIDATION_JSON" ]]; then
  exit 0
fi

# Use file locking to prevent race conditions when multiple writes happen concurrently
# flock ensures exclusive access to validation.json during read-modify-write cycle
LOCK_FILE="${VALIDATION_JSON}.lock"

(
  # Acquire exclusive lock (wait up to 30 seconds)
  if ! flock -x -w 30 200; then
    echo "Failed to acquire lock on validation.json" >&2
    exit 1
  fi

  # Get validation criteria from validation.json (v0.6.0 uses "steps" not "outputs")
  CRITERIA=$(jq -r --arg art "$ARTIFACT" '.steps[$art].validate // empty' "$VALIDATION_JSON" 2>/dev/null)

  if [[ -z "$CRITERIA" || "$CRITERIA" == "null" ]]; then
    # No criteria defined - just check JSON validity
    if ! jq empty "$FILE_PATH" 2>/dev/null; then
      echo "Validation failed for $ARTIFACT: Invalid JSON" >&2
      exit 2
    fi
  else
    # Run full semantic validation via validate.ts
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    VALIDATOR_SCRIPT="$SCRIPT_DIR/../../skills/workflow-validator/scripts/validate.ts"

    if [[ -f "$VALIDATOR_SCRIPT" ]]; then
      # Run the validation script
      RESULT=$(bun "$VALIDATOR_SCRIPT" "$FILE_PATH" "$CRITERIA" 2>&1) || true
      PASSED=$(echo "$RESULT" | jq -r '.passed // false' 2>/dev/null) || PASSED="false"

      if [[ "$PASSED" != "true" ]]; then
        echo "Semantic validation failed for $ARTIFACT:" >&2
        echo "$RESULT" >&2
        exit 2
      fi
    else
      # Fallback to basic JSON check if validator script not found
      if ! jq empty "$FILE_PATH" 2>/dev/null; then
        echo "Validation failed for $ARTIFACT: Invalid JSON" >&2
        exit 2
      fi
    fi
  fi

  # Update validation.json to mark step as validated (v0.6.0 uses "steps")
  jq --arg art "$ARTIFACT" '.steps[$art].validated = true' "$VALIDATION_JSON" > "${VALIDATION_JSON}.tmp"
  mv "${VALIDATION_JSON}.tmp" "$VALIDATION_JSON"
  echo "✓ Validated: $ARTIFACT.json" >&2

) 200>"$LOCK_FILE"
