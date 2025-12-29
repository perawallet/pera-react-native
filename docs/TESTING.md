# Testing Guide

We prioritize high test coverage for business logic and critical UI paths.

## Tools

- **[Vitest](https://vitest.dev/)**: Fast unit test runner (Jest-compatible). Used for all headless `packages/*`.
- **[Jest](https://jestjs.io/)**: Used for the UI layer and hooks in `apps/mobile` to better support React Native specific testing.
- **[React Native Testing Library (RNTL)](https://callstack.github.io/react-native-testing-library/)**: Used for testing React Components and Hooks in `apps/mobile`.

## Writing Tests

### Location

- Tests should be **colocated** with the source code.
- Create a `__tests__` directory inside the folder where the code lives.
- Test files should be named `*.test.ts` or `*.test.tsx`.

### What to Test

1.  **Packages (Logic)**:
    - Test **Stores** (Zustand) updates.
    - Test **Utils** and helper functions.
    - Mock external dependencies (Network, Storage).
    - _Goal: ~90% coverage or higher._

2.  **Apps (UI)**:
    - Test **Hooks** (`renderHook`).
    - Test **Screens/Components** for user interaction (presses, inputs).
    - Avoid testing implementation details; test **behavior**.

## running Tests

### Run All Tests

```sh
pnpm test
```

### Run Tests for a Specific Package

```sh
pnpm --filter mobile test      # Tests for mobile app
pnpm --filter accounts test    # Tests for accounts package
```

### Watching Tests (Dev Mode)

```sh
pnpm test --watch
```
