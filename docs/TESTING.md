# Testing Guide

We prioritize high test coverage for business logic and critical UI paths.

## Testing Stack

| Tool                                                                                      | Usage                                  |
| ----------------------------------------------------------------------------------------- | -------------------------------------- |
| [Vitest](https://vitest.dev/)                                                             | Unit tests for headless `packages/*`   |
| [Jest](https://jestjs.io/)                                                                | Tests for `apps/mobile` (React Native) |
| [React Native Testing Library](https://callstack.github.io/react-native-testing-library/) | Component and hook testing             |
| [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/)   | Hook testing in packages               |

## Test File Conventions

### Location

Tests should be **colocated** with the source code in a `__tests__` directory:

```
src/hooks/
├── useToast.ts
├── __tests__/
│   └── useToast.test.ts

packages/accounts/src/hooks/
├── useAllAccounts.ts
├── __tests__/
│   └── useAllAccounts.test.ts
```

### Naming

| Pattern      | Example                   |
| ------------ | ------------------------- |
| `*.test.ts`  | `useAllAccounts.test.ts`  |
| `*.test.tsx` | `PWButton.test.tsx`       |
| `*.spec.ts`  | `AccountCard.spec.ts`     |
| `*.spec.tsx` | `SettingsScreen.spec.tsx` |

Both `.test` and `.spec` suffixes are accepted.

---

## Running Tests

### All Tests

```sh
pnpm test
```

### Specific Package

```sh
pnpm --filter mobile test      # Mobile app tests
pnpm --filter accounts test    # Accounts package tests
pnpm --filter shared test      # Shared package tests
```

### Watch Mode

```sh
pnpm --filter mobile test -- --watch
pnpm --filter accounts test -- --watch
```

### With Coverage

```sh
pnpm test                      # Coverage enabled by default
```

---

## What to Test

### Packages (Business Logic)

| What                  | Priority | Goal                     |
| --------------------- | -------- | ------------------------ |
| Zustand store updates | High     | ~90% coverage            |
| Custom hooks          | High     | All hooks tested         |
| Utility functions     | High     | ~100% coverage           |
| Query hooks           | Medium   | Happy path + error cases |
| Error handling        | High     | All error paths          |

### Apps (UI)

| What                | Priority | Goal                  |
| ------------------- | -------- | --------------------- |
| Hooks (renderHook)  | High     | All hooks tested      |
| Screen navigation   | Medium   | Critical flows        |
| User interactions   | Medium   | Button clicks, inputs |
| Component rendering | Low      | Avoid snapshot tests  |

**Key principle:** Test **behavior**, not implementation details.

---

## Test Patterns

### Testing Zustand Stores

```typescript
// packages/accounts/src/store/__tests__/store.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { createAccountsStore } from '../store'

describe('AccountsStore', () => {
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }

    let store: ReturnType<typeof createAccountsStore>

    beforeEach(() => {
        vi.clearAllMocks()
        store = createAccountsStore(mockStorage as any)
    })

    test('setAccounts updates accounts list', () => {
        const accounts = [{ id: '1', address: 'ABC', name: 'Account 1' }]

        store.getState().setAccounts(accounts)

        expect(store.getState().accounts).toEqual(accounts)
    })

    test('setSelectedAccountAddress updates selection', () => {
        store.getState().setSelectedAccountAddress('ABC')

        expect(store.getState().selectedAccountAddress).toBe('ABC')
    })
})
```

### Testing Hooks in Packages

```typescript
// packages/accounts/src/hooks/__tests__/useAllAccounts.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAllAccounts } from '../useAllAccounts'
import { useAccountsStore } from '../../store'

// Mock the store
vi.mock('../../store', async () => {
    const actual =
        await vi.importActual<typeof import('../../store')>('../../store')
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }
    return {
        ...actual,
        useAccountsStore: actual.createAccountsStore(mockStorage as any),
    }
})

describe('useAllAccounts', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('returns all accounts from store', () => {
        const accounts = [
            {
                id: '1',
                address: 'A',
                type: 'standard',
                canSign: true,
                name: 'A',
            },
        ]
        useAccountsStore.setState({ accounts })

        const { result } = renderHook(() => useAllAccounts())

        expect(result.current).toEqual(accounts)
    })

    test('returns empty array when no accounts', () => {
        const { result } = renderHook(() => useAllAccounts())

        expect(result.current).toEqual([])
    })
})
```

### Testing React Native Components

```typescript
// apps/mobile/src/components/button/__tests__/PWButton.test.tsx
import { render, fireEvent } from '@test-utils'
import PWButton from '../PWButton'

describe('PWButton', () => {
    test('renders title correctly', () => {
        const { getByText } = render(
            <PWButton variant="primary" title="Click me" />
        )

        expect(getByText('Click me')).toBeTruthy()
    })

    test('calls onPress when pressed', () => {
        const onPress = jest.fn()
        const { getByText } = render(
            <PWButton variant="primary" title="Click me" onPress={onPress} />
        )

        fireEvent.press(getByText('Click me'))

        expect(onPress).toHaveBeenCalledTimes(1)
    })

    test('shows loading indicator when loading', () => {
        const { getByTestId, queryByText } = render(
            <PWButton variant="primary" title="Click me" loading />
        )

        expect(getByTestId('loading-indicator')).toBeTruthy()
        expect(queryByText('Click me')).toBeNull()
    })

    test('does not call onPress when disabled', () => {
        const onPress = jest.fn()
        const { getByText } = render(
            <PWButton variant="primary" title="Click me" onPress={onPress} disabled />
        )

        fireEvent.press(getByText('Click me'))

        expect(onPress).not.toHaveBeenCalled()
    })
})
```

### Testing Screens with Providers

Use the custom `render` function from `@test-utils`:

```typescript
// apps/mobile/src/modules/settings/screens/__tests__/SettingsScreen.test.tsx
import { render } from '@test-utils'
import SettingsScreen from '../SettingsScreen'

describe('SettingsScreen', () => {
    test('renders settings sections', () => {
        const { getByText } = render(<SettingsScreen />)

        expect(getByText('General')).toBeTruthy()
        expect(getByText('Security')).toBeTruthy()
    })
})
```

### Testing React Query Hooks

```typescript
// packages/accounts/src/hooks/__tests__/useAccountBalancesQuery.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAccountBalancesQuery } from '../useAccountBalancesQuery'

// Mock the fetch function
vi.mock('../endpoints', () => ({
    fetchAccountBalances: vi.fn(),
}))

import { fetchAccountBalances } from '../endpoints'

describe('useAccountBalancesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })
        vi.clearAllMocks()
    })

    const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )

    test('fetches account balances successfully', async () => {
        const mockBalances = { algo: 1000, assets: [] }
        vi.mocked(fetchAccountBalances).mockResolvedValue(mockBalances)

        const { result } = renderHook(
            () => useAccountBalancesQuery('ABC123'),
            { wrapper }
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(mockBalances)
    })

    test('handles fetch error', async () => {
        vi.mocked(fetchAccountBalances).mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(
            () => useAccountBalancesQuery('ABC123'),
            { wrapper }
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error?.message).toBe('Network error')
    })

    test('is disabled when address is empty', () => {
        const { result } = renderHook(
            () => useAccountBalancesQuery(''),
            { wrapper }
        )

        expect(result.current.fetchStatus).toBe('idle')
    })
})
```

---

## Test Utilities

### Mobile App Test Utilities

The `@test-utils` module provides testing helpers:

```typescript
// apps/mobile/src/test-utils/render.tsx
import { render, RenderOptions } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NavigationContainer } from '@react-navigation/native'
import { ThemeProvider } from '@rneui/themed'
import { SafeAreaProvider } from 'react-native-safe-area-context'

// Custom render with all providers
export const customRender = (
    ui: ReactElement,
    { queryClient, theme, ...options }: CustomRenderOptions = {}
) => {
    const Wrapper = ({ children }) => (
        <SafeAreaProvider>
            <ThemeProvider theme={theme}>
                <QueryClientProvider client={queryClient || createTestQueryClient()}>
                    <NavigationContainer>
                        {children}
                    </NavigationContainer>
                </QueryClientProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    )

    return render(ui, { wrapper: Wrapper, ...options })
}

export { customRender as render }
```

Usage:

```typescript
import { render, fireEvent } from '@test-utils'
import MyComponent from './MyComponent'

test('renders correctly', () => {
    const { getByText } = render(<MyComponent />)
    expect(getByText('Hello')).toBeTruthy()
})
```

---

## Coverage Requirements

### Current Thresholds

```javascript
// jest.config.js (mobile)
coverageThreshold: {
    global: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
    },
}
```

### Excluded from Coverage

- Style files (`*.styles.ts`)
- Index/barrel files (`index.ts`)
- Test utilities (`test-utils/`)
- Bootstrap code
- Generated code

---

## Best Practices

### ✅ DO

- Test behavior, not implementation
- Use descriptive test names
- Mock external dependencies
- Test error cases
- Keep tests focused and small
- Use `beforeEach` for common setup

### ❌ DON'T

- Test internal implementation details
- Use snapshot tests for complex components
- Leave console.log in tests
- Skip tests instead of fixing them
- Test third-party library behavior

---

## Debugging Tests

### Vitest (packages)

```sh
# Run specific test file
pnpm --filter accounts test -- useAllAccounts

# Run with verbose output
pnpm --filter accounts test -- --reporter=verbose

# Debug with console output
pnpm --filter accounts test -- --no-coverage
```

### Jest (mobile)

```sh
# Run specific test
pnpm --filter mobile test -- PWButton

# Update snapshots
pnpm --filter mobile test -- -u

# Debug mode
pnpm --filter mobile test -- --detectOpenHandles
```
