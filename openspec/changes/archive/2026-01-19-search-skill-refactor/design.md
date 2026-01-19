# Design: Core/Domain Plugin Separation

## Context

Looplia uses a two-plugin model (`looplia-core` and `looplia-writer`), but the boundary between "core" (orchestration) and "domain" (capabilities) has been unclear. The `search` skill in looplia-core crosses this boundary by providing domain-specific web search functionality.

**Stakeholders:**
- Workflow authors who need search/research capabilities
- Core maintainers who want a focused orchestration plugin
- Community contributors who want to add domain skills without modifying core

## Goals / Non-Goals

**Goals:**
- Establish clear separation: core = orchestration, domain = external plugins
- Enable independent evolution of domain skills via `looplia-skills` repo
- Simplify looplia-core maintenance footprint

**Non-Goals:**
- Changing the skill registry architecture
- Modifying how skills are discovered or loaded
- Creating new skill categories or metadata schemas

## Decisions

### Decision 1: Core Plugin Contains Only Orchestration Skills

**What:** After this change, `looplia-core` will contain exactly these skills:
- `workflow-executor` - Execute workflow steps
- `workflow-executor-inline` - Inline step execution
- `workflow-validator` - Validate workflow structure
- `workflow-schema-composer` - Compose workflow schemas
- `registry-loader` - Load skill catalog
- `skill-capability-matcher` - Match requirements to skills

**Why:** These skills are essential for the workflow engine itself. They don't provide domain capabilities—they orchestrate skills that do.

**Alternatives considered:**
1. Keep local search (Glob/Grep) in core, move only web search → Rejected: Creates split responsibility
2. Create `looplia-search` as separate core plugin → Rejected: Unnecessary plugin proliferation

### Decision 2: Web Research Lives in looplia-skills Repository

**What:** The `browser-research` skill will be added to `github.com/memorysaver/looplia-skills` under the existing `search-and-research` plugin group.

**Why:**
- Already has `web-search` and `rss-reader` skills
- Established as the domain skills repository
- Listed as registry source during `looplia init`

### Decision 3: Tiered Research Strategy in browser-research

**What:** The new skill uses a tiered approach:
1. **Tier 1**: WebSearch/WebFetch (fast, ~1-3s)
2. **Tier 2**: agent-browser via Bash (slower, ~5-30s, auto-escalate)

**Why:** WebSearch/WebFetch are faster but limited to static content. agent-browser handles JavaScript-rendered pages, forms, and interactive content but is slower.

**Auto-escalation triggers:**
- WebFetch returns < 100 chars (likely JS-rendered)
- Mission specifies "interactive", "fill form", "click through"
- Known JS-heavy domains

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Users expect search in core | Document migration path; looplia-skills is added as registry source by default |
| Breaking existing workflows that use `skill: search` | The search skill was input-less and used in custom workflows only; document replacement |
| agent-browser not installed | browser-research skill should gracefully degrade to Tier 1 only |

## Migration Plan

1. Users with workflows using `skill: search` should:
   - Install `search-and-research` plugin: `/plugin install search-and-research@looplia-skills`
   - Update workflow to use `skill: web-search` or `skill: browser-research`

2. No data migration needed—skills are stateless

3. Rollback: Re-add search skill to looplia-core (simple file restore)

## Open Questions

None—all design decisions have been made through the brainstorming session.
