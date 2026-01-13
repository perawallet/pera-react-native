---
trigger: always_on
---

# Documentation Maintenance

This rule governs when and how to update project documentation.

## When to Update Documentation

Update documentation when the USER explicitly:

1. **Requests documentation updates** - User asks to update docs
2. **Introduces new patterns** - User writes new code patterns or describes them
3. **Changes existing patterns** - User modifies established conventions
4. **Adds new features** - User adds functionality that requires documentation

## IMPORTANT: Pattern Authority

**Only the USER can establish or change patterns.**

- NEVER introduce new patterns on your own initiative
- If you notice the codebase has inconsistent patterns, ASK the user which to follow
- Suggest improvements but wait for user approval before documenting them
- Document EXISTING patterns from the codebase, not ideal patterns you prefer

## What to Update

### For New Patterns (User-Initiated)

1. Update the relevant doc in `docs/`:
    - `ARCHITECTURE.md` - Architecture changes
    - `FOLDER_STRUCTURE.md` - New directories or organization
    - `NAMING_CONVENTIONS.md` - New naming rules
    - `STYLE_GUIDE.md` - New coding patterns
    - `TESTING.md` - New testing approaches
    - `SECURITY.md` - New security considerations
    - `PERFORMANCE.md` - New optimization patterns

2. Update `.agent/rules/` if the change affects code generation guidance

### For Code Changes

1. Add examples to documentation if the pattern is non-obvious
2. Update anti-patterns if a mistake should be prevented
3. Keep documentation agent-agnostic - no tool-specific syntax

## Documentation Principles

1. **Agent-Agnostic** - Write for any AI or human reader, avoid platform-specific syntax
2. **Concise** - Quality over quantity, avoid verbose explanations
3. **Example-Driven** - Show code examples for patterns
4. **Good/Bad Examples** - Show what TO do and what NOT to do
5. **Accurate** - Documentation must match actual codebase patterns
