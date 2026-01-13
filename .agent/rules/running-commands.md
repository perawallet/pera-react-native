---
trigger: always_on
---

# Pera Wallet Project Standards

This is a React Native monorepo for Pera Wallet. All code generation and modifications MUST follow the established project documentation.

## Package Manager

Always use `pnpm` for all commands:

```sh
pnpm install           # Install dependencies
pnpm test              # Run tests
pnpm lint              # Check linting
pnpm format            # Format code
```

## Required Documentation Reference

Before writing ANY code, reference the appropriate documentation in `docs/`:

| Task | Required Documentation |
|------|------------------------|
| Any code change | `docs/STYLE_GUIDE.md`, `docs/NAMING_CONVENTIONS.md` |
| Creating files/folders | `docs/FOLDER_STRUCTURE.md` |
| Business logic | `docs/ARCHITECTURE.md` |
| Writing tests | `docs/TESTING.md` |
| Security-sensitive code | `docs/SECURITY.md` |
| Performance-critical code | `docs/PERFORMANCE.md` |

## Code Location Rules

1. **Business logic** → `packages/[domain]/src/`
2. **UI components (shared)** → `apps/mobile/src/components/` (prefix with `PW`)
3. **Feature screens** → `apps/mobile/src/modules/[module]/screens/`
4. **Module components** → `apps/mobile/src/modules/[module]/components/`
5. **Hooks (business)** → `packages/[domain]/src/hooks/`
6. **Hooks (UI-specific)** → `apps/mobile/src/hooks/`
7. **Tests** → `__tests__/` directory colocated with source

## Core Values

- Build reusable, scalable patterns and components
- Refactor early and often for more reusability
- Minimize in-code comments - code should be self-documenting
- Keep documentation concise but accurate - quality over quantity
