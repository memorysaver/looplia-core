#!/bin/sh
set -e

# Auto-initialize if workspace not initialized (v0.6.5: check plugin folder, two-plugin mode)
if [ ! -d "$HOME/.looplia/looplia-core" ]; then
  echo "Initializing looplia workspace..."
  # Use --yes to skip confirmation prompt
  bun run /app/apps/cli/dist/index.js init --yes
fi

# Run the CLI with provided arguments
exec bun run /app/apps/cli/dist/index.js "$@"
