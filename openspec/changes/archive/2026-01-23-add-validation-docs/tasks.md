# Tasks: Add Validation System Documentation

## Implementation Tasks

### 1. Create validation.mdx documentation page
- [x] Create `apps/docs/src/content/docs/reference/validation.mdx`
- [x] Add frontmatter with title and description
- [x] Write overview section explaining the validation system purpose
- [x] Document all 5 validation criteria types with examples
- [x] Add validation lifecycle diagram (ASCII art)
- [x] Document validation.json structure
- [x] Add troubleshooting section

### 2. Update sidebar navigation
- [x] Add "Validation System" entry to reference section in `astro.config.mjs` or sidebar config

### 3. Add cross-references from existing pages
- [x] Update `understanding-workflows.mdx` validation section to link to new page
- [x] Update `sandbox.mdx` validation tracking section to link to new page
- [x] Update `custom-workflows.mdx` validation section to link to new page

### 4. Verify documentation builds
- [x] Run `bun run build` in apps/docs
- [x] Verify new page renders correctly
- [x] Check all internal links work

## Validation Criteria to Document

1. `required_fields` - Check for existence of JSON fields
2. `min_quotes` - Minimum items in importantQuotes array
3. `min_key_points` - Minimum items in bullets/keyPoints array
4. `min_outline_sections` - Minimum items in suggestedOutline array
5. `has_hooks` - Check for non-empty hooks array

## Dependencies

- None (documentation-only change)

## Parallelizable Work

- Tasks 1 and 2 can be done in parallel
- Task 3 depends on Task 1 completion
- Task 4 depends on all previous tasks
