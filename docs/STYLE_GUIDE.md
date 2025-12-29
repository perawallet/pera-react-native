# Style Guide & Coding Standards

We follow strict standards to keep the codebase clean, consistent, and maintainable.

## Git

- **Branches**: Use `<user-name>/[branch-name]` branch naming so it's easy to determine who owns the branch.
- **Commits**: We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- **PR**: PRs are required and should be based on `main` in most cases. Use Squash Merge when merging the PR.

## TypeScript

- **Strict Mode**: Enabled. Do not disable it.
- **No `any`**: Avoid `any` whenever possible. Use `unknown` with type guards or define proper interfaces.
- **Explicit Returns**: Define return types for functions, especially exported ones.

## Components & Hooks

- **Functional Components**: Use functional components with Hooks wherever possible. Class components are legacy.
- **PascalCase**: Component names and files containing components (e.g., `AccountList.tsx`).
- **Custom Hooks**: Encapsulate logic in `use[Feature]` hooks (e.g., `useAccountStore`).

## Naming Conventions

- **Variables/Functions**: `camelCase` (e.g., `fetchBalance`, `isValid`).
- **Components/Classes**: `PascalCase` (e.g., `UserProfile`, `WalletStore`).
- **Constants**: `UPPER_CASE` (e.g., `MAX_RETRIES`, `API_URL`).
- **Boolean Props**: Prefix with `is`, `has`, `should` (e.g., `isLoading`, `hasError`).

## Formatting & Linting

- **Prettier**: We use Prettier for code formatting. It runs automatically on pre-commit.
    - Run manually: `pnpm format`
- **ESLint**: We use ESLint for code quality rules.
    - Run manually: `pnpm lint`

## Project Rules

1.  **No Magic Numbers/Strings**: Extract invalid or recurring values to constants.
2.  **Comments**: Comment _why_, not _what_. Code should be self-documenting.
3.  **Imports**: Use absolute paths (aliases) where configured (e.g., inside `apps/mobile`).
