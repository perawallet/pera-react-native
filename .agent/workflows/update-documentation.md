---
description: Update project documentation when patterns change
---

# Update Documentation Workflow

Use this workflow when the USER requests documentation updates or establishes new patterns.

## Prerequisites

Read `.agent/rules/documentation-standards.md` first - it defines where content belongs.

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

Determine which location is appropriate:

**docs/ (lean overviews for humans):**

| Change Type          | File                         |
| -------------------- | ---------------------------- |
| Architecture changes | `docs/ARCHITECTURE.md`       |
| New directories      | `docs/FOLDER_STRUCTURE.md`   |
| Naming changes       | `docs/NAMING_CONVENTIONS.md` |
| Code style           | `docs/STYLE_GUIDE.md`        |
| Testing              | `docs/TESTING.md`            |
| Security             | `docs/SECURITY.md`           |
| Performance          | `docs/PERFORMANCE.md`        |

**.agent/rules/ (detailed patterns for AI):**

| Change Type            | File                         |
| ---------------------- | ---------------------------- |
| UI components, styling | `component-patterns.md`      |
| Custom hooks           | `hook-patterns.md`           |
| Zustand stores         | `store-patterns.md`          |
| TypeScript conventions | `typescript-patterns.md`     |
| Testing templates      | `testing-patterns.md`        |
| What NOT to do         | `anti-patterns.md`           |
| Documentation rules    | `documentation-standards.md` |
| Project commands       | `running-commands.md`        |

### 2. Apply Content Rules

**For docs/:**

- Bullet points and tables only
- No extensive code examples
- Under 100 lines
- Point to `.agent/rules/` for details

**For .agent/rules/:**

- Full code examples (good AND bad)
- Include `trigger: always_on` frontmatter
- Under 150 lines per file
- One topic per file

### 3. Check for Duplication

Before adding content, verify:

- Same info doesn't exist in another location
- If adding to docs/, reference rules file for details
- If adding to rules/, don't repeat high-level overview

### 4. Format Documentation

// turbo

```sh
pnpm format
```

### 5. Verify

// turbo

```sh
pnpm pre-push --no-fail-on-error
```