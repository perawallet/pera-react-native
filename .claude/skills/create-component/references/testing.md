# Component Testing Reference

## Component Test Template

```typescript
import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PWButton } from '../PWButton'

describe('PWButton', () => {
    it('calls onPress when pressed', () => {
        // Arrange
        const onPress = vi.fn()
        render(<PWButton title="Submit" onPress={onPress} variant="primary" />)

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
                title="Submit"
                onPress={onPress}
                variant="primary"
                isLoading={true}
            />
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

## Testing Principles

1. **Behavior Only**: Do not test static styles or text rendering unless conditional
2. **AAA Pattern**: Arrange, Act, Assert
3. **Atomic**: Keep tests focused on a single behavior
4. **Naming**: `it('does something when event happens')`
