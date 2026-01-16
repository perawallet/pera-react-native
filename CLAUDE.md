# Pera Wallet - Claude Code Context

React Native monorepo for Pera Wallet. **Always use `pnpm`** for all commands.

## Required Reading

Before writing any code, read the relevant files in `.agent/`:

### Rules (Always Active)

- `.agent/rules/running-commands.md` - Project commands and standards
- `.agent/rules/component-patterns.md` - UI components and styling
- `.agent/rules/hook-patterns.md` - Custom hooks
- `.agent/rules/store-patterns.md` - Zustand state management
- `.agent/rules/typescript-patterns.md` - TypeScript conventions
- `.agent/rules/testing-patterns.md` - Writing tests
- `.agent/rules/anti-patterns.md` - What NOT to do
- `.agent/rules/work-completion.md` - Definition of done

### Workflows

- `.agent/workflows/create-component.md` - Creating new components
- `.agent/workflows/create-hook.md` - Creating new hooks
- `.agent/workflows/create-module.md` - Creating feature modules
- `.agent/workflows/create-package.md` - Creating packages
- `.agent/workflows/verify-work.md` - Pre-completion verification

### Architecture Docs

- `docs/ARCHITECTURE.md` - System architecture
- `docs/FOLDER_STRUCTURE.md` - Where files go
- `docs/NAMING_CONVENTIONS.md` - Naming rules

## Quick Reference

```sh
pnpm pre-push    # Run before completing any task
pnpm test        # Run tests
```
