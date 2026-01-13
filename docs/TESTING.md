# Testing Guide

We test to ensure code works correctly and stays working as changes are made.

## Testing Stack

| Tool                             | Used For                              |
| -------------------------------- | ------------------------------------- |
| **Vitest**                       | Testing `packages/*` (business logic) |
| **Jest**                         | Testing `apps/mobile` (React Native)  |
| **React Native Testing Library** | Component testing (via Jest)          |

## Running Tests

```sh
pnpm test                    # Run all tests
pnpm --filter mobile test    # Mobile app tests only
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

## Component Testing Standards

1. **File Naming**: Use `.spec.tsx` extension.
2. **Behavior Only**: Test interactions (presses, inputs) and conditionals. Do not test static text rendering.
3. **AAA Pattern**: Structure tests with Arrange, Act, Assert comments.
4. **Naming**: Use `it('does something when event happens')`.
5. **Atomicity**: Tests must be independent and self-contained. Setup dependencies inside the test or `beforeEach`.

```typescript
// ✅ Good Example
it('submits form when save is pressed', () => {
    // Arrange
    const onSave = jest.fn()
    render(<UserForm onSave={onSave} />)
    
    // Act
    fireEvent.press(screen.getByText('Save'))
    
    // Assert
    expect(onSave).toHaveBeenCalled()
})
```

## Key Principle

**Test behavior, not implementation.**

Ask: "What should happen when the user does X?" rather than "Does internal method Y get called?"

## Learn More

For detailed test patterns and examples, see the development workflows.
