# Testing Guide

We test to ensure code works correctly and stays working as changes are made.

## Testing Stack

| Tool                             | Used For                              |
| -------------------------------- | ------------------------------------- |
| **Vitest**                       | Testing `packages/*` (business logic) |
| **Jest**                         | Testing `apps/mobile` (React Native)  |
| **React Native Testing Library** | Component testing                     |

## Running Tests

```sh
pnpm test                    # Run all tests
pnpm --filter mobile test    # Mobile app tests only
pnpm --filter accounts test  # Specific package tests
```

## Where Tests Live

Tests are **colocated** with source code in `__tests__/` folders:

```
src/hooks/
├── useToast.ts
└── __tests__/
    └── useToast.test.ts
```

## What to Test

### In Packages (Business Logic)

Focus on:

- Zustand store updates
- Data transformation functions
- Hook behavior (with `renderHook`)
- Error handling

### In Mobile App (UI)

Focus on:

- User interactions (button presses, form inputs)
- Conditional rendering
- Critical user flows

Avoid:

- Snapshot tests for complex components
- Testing third-party library behavior

## Test File Naming

Both `.test.ts` and `.spec.ts` are accepted:

```
useToast.test.ts     ✅
useToast.spec.ts     ✅
PWButton.test.tsx    ✅
```

## Key Principle

**Test behavior, not implementation.**

Ask: "What should happen when the user does X?" rather than "Does internal method Y get called?"

## Learn More

For detailed test patterns and examples, see the development workflows.
