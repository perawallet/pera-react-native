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

Determine which files are affected:

**For human-readable overviews (docs/):**

| Change Type | File |
|-------------|------|
| Architecture changes | `docs/ARCHITECTURE.md` |
| New directories | `docs/FOLDER_STRUCTURE.md` |
| Naming changes | `docs/NAMING_CONVENTIONS.md` |
| Code style | `docs/STYLE_GUIDE.md` |
| Testing | `docs/TESTING.md` |
| Security | `docs/SECURITY.md` |
| Performance | `docs/PERFORMANCE.md` |

**For agent rules with code examples (.agent/):**

| Change Type | File |
|-------------|------|
| Code patterns | `.agent/rules/code-patterns.md` |
| Project standards | `.agent/rules/running-commands.md` |
| Work completion | `.agent/rules/work-completion.md` |

### 2. Update Documentation

**In `docs/`**: Keep it high-level and human-readable
- Tables, simple lists
- Minimal code examples
- Focus on "what" and "why"

**In `.agent/`**: Add detailed patterns
- Full code examples (good AND bad)
- Anti-patterns with explanations
- Specific implementation details

### 3. Avoid Duplication

- `docs/` = overview for humans
- `.agent/` = details for agents
- Don't repeat the same information in both

### 4. Keep It Agent-Agnostic

Documentation must be readable by any AI or human. Avoid:
- Tool-specific syntax
- Platform-specific references

### 5. Format Documentation

// turbo
```sh
pnpm format "docs/**/*.md"
```
