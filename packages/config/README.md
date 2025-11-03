# Pera Config

Basic configuration for the perawallet packages - loaded dynamically at runtime

## Testing

- Unit tests use Vitest
- Run coverage from root: pnpm test

## Conventions

- TypeScript strictness; format with pnpm format at root.
- Regenerate clients when specs change.
- Keep modules tree-shakeable; avoid side effects in module top-level code.
