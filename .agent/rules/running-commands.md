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

Before writing ANY code, reference the appropriate documentation:

| Task                       | Reference                       |
| -------------------------- | ------------------------------- |
| Understanding architecture | `docs/ARCHITECTURE.md`          |
| File/folder placement      | `docs/FOLDER_STRUCTURE.md`      |
| Naming rules               | `docs/NAMING_CONVENTIONS.md`    |
| Code patterns (detailed)   | `.agent/rules/code-patterns.md` |
| Writing tests              | `docs/TESTING.md`               |
| Security considerations    | `docs/SECURITY.md`              |
| Performance optimization   | `docs/PERFORMANCE.md`           |

## Core Values

- Build reusable, scalable patterns and components
- Refactor early and often for more reusability
- Minimize in-code comments - code should be self-documenting
- Keep documentation concise but accurate - quality over quantity
