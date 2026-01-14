---
trigger: always_on
---

# Documentation Standards

This project maintains a clear separation between human-readable documentation and AI agent rules.

## Documentation Locations

| Location            | Purpose                  | Content Type                       |
| ------------------- | ------------------------ | ---------------------------------- |
| `docs/`             | Human-readable overviews | Lean, high-level, no code examples |
| `.agent/rules/`     | AI agent patterns        | Detailed, with code examples       |
| `.agent/workflows/` | Step-by-step procedures  | Task-specific instructions         |

## docs/ Guidelines

Files in `docs/` are **lean overviews** for quick human reference:

- **DO**: Use bullet points, tables, short descriptions
- **DO**: Point to `.agent/rules/` for detailed patterns
- **DO**: Keep files under 100 lines
- **DON'T**: Include extensive code examples
- **DON'T**: Duplicate information from `.agent/rules/`

Example structure:

```markdown
# Topic Name

Brief description of what this covers.

## Section

- Key point 1
- Key point 2
- Key point 3

For detailed patterns and examples, see `.agent/rules/[relevant-file].md`.
```

## .agent/rules/ Guidelines

Files in `.agent/rules/` are **detailed patterns** for AI code generation:

- **DO**: Include full code examples (good AND bad)
- **DO**: Show anti-patterns with corrections
- **DO**: Use `trigger: always_on` frontmatter
- **DO**: Keep files focused on a single topic
- **DO**: Keep files under 150 lines each
- **DON'T**: Include high-level overviews (that's for docs/)

Example structure:

```markdown
---
trigger: always_on
---

# Pattern Name

## Pattern Section

[Code example]

## Anti-Pattern

[Bad example with correction]
```

## .agent/workflows/ Guidelines

Files in `.agent/workflows/` are **step-by-step procedures**:

- **DO**: Break down into numbered steps
- **DO**: Reference rules files for details
- **DO**: Use `// turbo` annotations for auto-runnable commands
- **DON'T**: Duplicate pattern details (reference rules instead)

## File Naming

| Location            | Convention              | Example                 |
| ------------------- | ----------------------- | ----------------------- |
| `docs/`             | SCREAMING_SNAKE_CASE.md | `STYLE_GUIDE.md`        |
| `.agent/rules/`     | kebab-case.md           | `component-patterns.md` |
| `.agent/workflows/` | kebab-case.md           | `create-component.md`   |

## When Updating Documentation

1. **Identify location**: Is it an overview (docs/) or detailed pattern (.agent/)?
2. **Avoid duplication**: Don't repeat the same content in both locations
3. **Keep focused**: One topic per file in `.agent/rules/`
4. **Reference, don't repeat**: Point to other files instead of duplicating
