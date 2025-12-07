#!/usr/bin/env python3
"""
Update material markdown files with AI-generated documentation.

This script updates material files (e.g., ai-{video-id}.md) by:
1. Preserving the YAML frontmatter
2. Replacing the content below the frontmatter
3. Updating metadata fields (ai_status, generated_at)

Usage:
    python update_material.py <file_path> < markdown_content.txt

Example:
    python update_material.py "youtube-channels/Anthropic/items/ai.v123.md" << 'EOF'
    # Content here
    ## Section
    More content...
    EOF
"""

import sys
import re
import time
import yaml
from pathlib import Path
from typing import Tuple, Optional


def split_frontmatter(content: str) -> Tuple[str, str]:
    """
    Split markdown content into frontmatter and body.

    Returns:
        Tuple of (frontmatter_str, body_str)
        If no frontmatter found, returns ("", full_content)
    """
    if not content.startswith("---"):
        return "", content

    # Find the second --- marker (end of frontmatter)
    remaining = content[3:]  # Skip initial ---
    match = re.search(r"^---\s*$", remaining, re.MULTILINE)

    if not match:
        return "", content

    end_pos = match.start()
    frontmatter = content[:3 + end_pos + 3]  # Include both --- markers
    body = remaining[end_pos + 3:]  # Skip the closing ---

    return frontmatter, body.lstrip("\n")


def extract_yaml_content(frontmatter: str) -> str:
    """Extract YAML content from frontmatter (strip --- markers)."""
    # Remove leading and trailing ---
    content = frontmatter.strip()
    if content.startswith("---"):
        content = content[3:].lstrip()
    if content.endswith("---"):
        content = content[:-3].rstrip()
    return content


def update_material_file(file_path: str, new_content: str) -> bool:
    """
    Update material file with new markdown content.

    Args:
        file_path: Path to the material file (e.g., ai-{id}.md)
        new_content: New markdown content (body only, without frontmatter)

    Returns:
        True if successful, False otherwise
    """
    path = Path(file_path).resolve()

    # Security: Ensure file matches expected pattern
    if not re.search(r"items/ai\.[a-zA-Z0-9_-]+\.md$", str(path)):
        print(f"Error: Invalid file path pattern: {file_path}", file=sys.stderr)
        print("File must match pattern: */items/ai.{id}.md", file=sys.stderr)
        return False

    # Check if file exists
    if not path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        return False

    try:
        # Read existing file
        with open(path, "r", encoding="utf-8") as f:
            existing_content = f.read()

        # Split frontmatter and old body
        frontmatter, _old_body = split_frontmatter(existing_content)

        if not frontmatter:
            print(f"Error: No frontmatter found in {file_path}", file=sys.stderr)
            return False

        # Parse YAML
        yaml_content = extract_yaml_content(frontmatter)
        metadata = yaml.safe_load(yaml_content)

        if not isinstance(metadata, dict):
            print(f"Error: Invalid YAML in frontmatter", file=sys.stderr)
            return False

        # Update metadata
        metadata["ai_status"] = "documented"
        metadata["generated_at"] = int(time.time() * 1000)  # Milliseconds

        # Reconstruct frontmatter with updated metadata
        new_yaml = yaml.dump(
            metadata,
            default_flow_style=False,
            sort_keys=False,
            allow_unicode=True,
            width=80
        )
        new_frontmatter = f"---\n{new_yaml}---\n"

        # Combine and write
        final_content = new_frontmatter + "\n" + new_content + "\n"

        with open(path, "w", encoding="utf-8") as f:
            f.write(final_content)

        print(f"✅ Successfully updated: {file_path}", file=sys.stderr)
        return True

    except yaml.YAMLError as e:
        print(f"Error: Failed to parse YAML in frontmatter: {e}", file=sys.stderr)
        return False
    except IOError as e:
        print(f"Error: Failed to read/write file: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error: Unexpected error: {e}", file=sys.stderr)
        return False


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python update_material.py <file_path>", file=sys.stderr)
        print("Reads markdown content from stdin", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]

    # Read markdown content from stdin
    try:
        markdown_content = sys.stdin.read()
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        sys.exit(1)

    # Update file
    success = update_material_file(file_path, markdown_content)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
