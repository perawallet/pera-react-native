# Documentation Standards

This project maintains documentation in two locations.

## Documentation Locations

| Location | Purpose | Content Type |
|----------|---------|--------------|
| `docs/` | Human-readable overviews | Lean, high-level, no code examples |
| `CLAUDE.md` | AI agent rules (inlined) | Dense, actionable rules with key examples |
| `.claude/skills/` | On-demand workflows | Step-by-step procedures invoked via `/command` |

## docs/ Guidelines

Files in `docs/` are **lean overviews** for quick human reference:

- **DO**: Use bullet points, tables, short descriptions
- **DO**: Keep files under 100 lines
- **DON'T**: Include extensive code examples
- **DON'T**: Duplicate information from `CLAUDE.md`

## CLAUDE.md Guidelines

`CLAUDE.md` contains **inlined rules** that are auto-loaded every session:

- **DO**: Keep rules dense and actionable
- **DO**: Include one good/bad example per critical pattern
- **DO**: Mark critical sections (Styling, Components, Hooks)
- **DON'T**: Include verbose reference material (that goes in skill references)

## .claude/skills/ Guidelines

Skills in `.claude/skills/` are **on-demand workflows**:

- Each skill has a `SKILL.md` with steps and optional `references/` dir
- Invoked via slash commands (e.g., `/create-component`)
- Reference files contain detailed code examples and templates

## File Naming

| Location | Convention | Example |
|----------|-----------|---------|
| `docs/` | SCREAMING_SNAKE_CASE.md | `ARCHITECTURE.md` |
| `.claude/skills/` | kebab-case dirs | `create-component/` |

## When Updating Documentation

1. **Identify location**: Overview (docs/) or actionable rule (CLAUDE.md)?
2. **Avoid duplication**: Don't repeat the same content across locations
3. **Keep focused**: One topic per section
4. **Reference, don't repeat**: Point to other files instead of duplicating
