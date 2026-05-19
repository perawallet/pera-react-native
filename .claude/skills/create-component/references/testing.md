# Component Testing Reference

## Where to test

| Location                                                              | Unit test                                                                                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/core/PW*/`                                | **Yes.** Behavioral tests + optional smoke test.                                                                                    |
| `apps/mobile/src/components/[Name]/`                                  | **Yes.** Same rules as core.                                                                                                        |
| `apps/mobile/src/modules/[mod]/components/`, `modules/[mod]/screens/` | **No.** Covered by integration tests in `apps/mobile/src/__integration__/`. Extract a `use[Name]` hook for logic and test the hook. |

## What to write

For behavioral tests, prefer:

1. **Press/tap handlers** — verify `onPress`/`onChange`/etc. are called with the right arguments.
2. **Conditional rendering** — different states (loading/error/empty/success) show different content.
3. **Prop wiring** — props are forwarded correctly to important children (e.g. an icon wrapper that maps `size` to a child component's `size`).
4. **Formatting / transformation** — uppercasing, truncation, number formatting, etc.

## What to skip

- "Renders correctly" tests whose only assertion is `expect(container).toBeTruthy()`.
- Variant render tests where each variant doesn't produce observably different output (e.g. all variants render the same text and only the style differs).
- Style assertions (color, padding, fontWeight). Reviewed in PRs, not asserted.
- "Renders children" / "passes testID through" on every wrapper — trust the platform.
- Snapshot tests.

## Component Test Template

```typescript
import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PWButton } from '../PWButton'

describe('PWButton', () => {
    it('calls onPress when pressed', () => {
        // Arrange
        const onPress = vi.fn()
        render(<PWButton title='Submit' onPress={onPress} variant='primary' />)

        // Act
        fireEvent.click(screen.getByText('Submit'))

        // Assert
        expect(onPress).toHaveBeenCalled()
    })

    it('shows loader and disables press when isLoading is true', () => {
        // Arrange
        const onPress = vi.fn()
        render(
            <PWButton
                title='Submit'
                onPress={onPress}
                variant='primary'
                isLoading={true}
            />,
        )

        // Act
        fireEvent.click(screen.getByRole('button'))

        // Assert
        expect(screen.getByTestId('activity-indicator')).toBeTruthy()
        expect(onPress).not.toHaveBeenCalled()
    })
})
```

## Hook Test Template

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

describe('useAllAccounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('returns all accounts from store', () => {
        const { result } = renderHook(() => useAllAccounts())
        expect(result.current).toEqual([])
    })
})
```

## Anti-patterns

```typescript
// ❌ No real assertion — testing that import worked, which CI already does
it('renders correctly', () => {
    const { container } = render(<MyComponent />)
    expect(container).toBeTruthy()
})

// ❌ Three tests for variants whose only difference is style
it('renders with secondary variant', () => {
    render(<PWChip title='hi' variant='secondary' />)
    expect(screen.getByText('HI')).toBeTruthy()
})
it('renders with helper variant', () => {
    render(<PWChip title='hi' variant='helper' />)
    expect(screen.getByText('HI')).toBeTruthy()
})

// ❌ Asserting React Native passes children through
it('renders children correctly', () => {
    render(
        <PWView>
            <Text>X</Text>
        </PWView>,
    )
    expect(screen.getByText('X')).toBeTruthy()
})

// ❌ Asserting style values
it('applies correct padding when variant is primary', () => {
    const { container } = render(<MyButton variant='primary' />)
    expect(container.firstChild).toHaveStyle({ padding: 16 })
})
```

## Principles

1. **Behavior only** — what a user observes, not how the code is structured.
2. **AAA Pattern** — Arrange, Act, Assert.
3. **Atomic** — one behavior per test; each test sets up its own state.
4. **Naming** — `it('does X when Y happens')`.
