#!/bin/bash
# Post-Write Artifact Validator Hook
# Triggered: When Write tool completes
# Action: Auto-validate artifacts written to sandbox directories

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
ARTIFACT=$(basename "$FILE_PATH")

# Check for validation.json
VALIDATION_JSON="$SANDBOX_DIR/validation.json"
if [[ ! -f "$VALIDATION_JSON" ]]; then
  exit 0
fi

# Get validation criteria for this artifact
ARTIFACT_KEY="${ARTIFACT%.json}"
CRITERIA=$(jq -r --arg art "$ARTIFACT_KEY" '.outputs[$art].criteria // empty' "$VALIDATION_JSON")

if [[ -z "$CRITERIA" ]]; then
  exit 0
fi

# Check if artifact file is valid JSON
if ! jq empty "$FILE_PATH" 2>/dev/null; then
  echo "Validation failed for $ARTIFACT: Invalid JSON" >&2
  exit 2
fi

# Basic validation passed - update validation.json
jq --arg art "$ARTIFACT_KEY" '.outputs[$art].validated = true' "$VALIDATION_JSON" > "${VALIDATION_JSON}.tmp"
mv "${VALIDATION_JSON}.tmp" "$VALIDATION_JSON"
echo "✓ Validated: $ARTIFACT"
