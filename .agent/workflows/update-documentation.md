---
description: Update project documentation when patterns change
---

# Update Documentation Workflow

Use this workflow when the USER requests documentation updates or establishes new patterns.

## IMPORTANT: Pattern Authority

- Only update documentation when the USER initiates the change
- Never create new patterns on your own - suggest and wait for approval
- Document what EXISTS in the codebase, not idealized patterns

## When to Use

1. User explicitly requests documentation updates
2. User writes new code that establishes a pattern
3. User describes a new convention to follow
4. Major refactoring that changes existing patterns

## Steps

### 1. Identify What Changed

Determine which documentation files are affected:

| Change Type               | Documentation File           |
| ------------------------- | ---------------------------- |
| Architecture changes      | `docs/ARCHITECTURE.md`       |
| New directories/structure | `docs/FOLDER_STRUCTURE.md`   |
| Naming changes            | `docs/NAMING_CONVENTIONS.md` |
| Code style changes        | `docs/STYLE_GUIDE.md`        |
| Testing changes           | `docs/TESTING.md`            |
| Security patterns         | `docs/SECURITY.md`           |
| Performance patterns      | `docs/PERFORMANCE.md`        |

### 2. Update Documentation

Update the relevant files with:

- Clear explanation of the pattern
- Code examples (good AND bad)
- When to use / when not to use

### 3. Update Agent Rules (if needed)

If the change affects how code should be generated:

Update `.agent/rules/running-commands.md` or create a new rule file.

### 4. Keep It Agent-Agnostic

Documentation must be readable by:

- Any AI coding assistant
- Human developers
- Future maintainers

Avoid:

- Tool-specific syntax or commands
- Platform-specific references
- Markdown that only works in specific viewers

### 5. Format Documentation

// turbo

```sh
pnpm format "docs/**/*.md"
```
