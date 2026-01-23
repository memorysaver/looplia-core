# Spec Delta: Validation System Documentation

## ADDED Requirements

### Requirement: Validation System Documentation Page

The documentation site SHALL provide a reference page explaining the workflow validation system.

#### Scenario: User navigates to validation documentation
- **GIVEN** a user is on the documentation site
- **WHEN** they navigate to `/reference/validation/`
- **THEN** they see documentation explaining the validation system

#### Scenario: Documentation covers all validation criteria
- **GIVEN** the validation documentation page exists
- **WHEN** a user reads the page
- **THEN** they find documentation for all 5 criteria types:
  - `required_fields`
  - `min_quotes`
  - `min_key_points`
  - `min_outline_sections`
  - `has_hooks`

#### Scenario: Documentation includes lifecycle diagram
- **GIVEN** the validation documentation page exists
- **WHEN** a user reads the page
- **THEN** they see a diagram showing the validation lifecycle flow

### Requirement: Cross-References from Related Pages

Related documentation pages SHALL link to the validation system documentation.

#### Scenario: Understanding workflows links to validation
- **GIVEN** a user is reading understanding-workflows.mdx
- **WHEN** they reach the validation section
- **THEN** they find a link to the validation reference page

#### Scenario: Sandbox docs link to validation
- **GIVEN** a user is reading sandbox.mdx
- **WHEN** they reach the validation tracking section
- **THEN** they find a link to the validation reference page

## Related Capabilities

- **Sandbox Architecture** - validation.json lives in sandbox
- **Workflow Schema** - validate field on steps
