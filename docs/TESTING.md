# Testing Guide

We test to ensure code works correctly and stays working as changes are made.

## Testing Stack

| Tool                             | Used For                             |
| -------------------------------- | ------------------------------------ |
| **Vitest**                       | Testing everything (packages & apps) |
| **React Native Testing Library** | Component testing (via Vitest/React) |

## Running Tests

```sh
pnpm test                    # All tests (unit + integration)
pnpm test:integration        # Only integration tests (recursive)
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
import { render, fireEvent, screen } from '@test-utils/render'

// ✅ Good Example
it('submits form when save is pressed', () => {
    // Arrange
    const onSave = vi.fn()
    render(<UserForm onSave={onSave} />)

    // Act
    fireEvent.click(screen.getByText('Save'))

    // Assert
    expect(onSave).toHaveBeenCalled()
})
```

## Key Principle

**Test behavior, not implementation.**

Ask: "What should happen when the user does X?" rather than "Does internal method Y get called?"

## Integration Tests (User-Facing Flows)

Flow tests live in `apps/mobile/src/__integration__/<flow>.test.tsx` and exercise real React Query, real Zustand stores, and real domain hooks — only the network is mocked, via MSW.

### Writing a flow test

```typescript
import { mockListCurrencies } from '@perawallet/wallet-core-currencies/test-handlers'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { USD_EUR_GBP } from './__fixtures__/currencies'

describe('Flow: …', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('Given …, when …, then …', async () => {
        server.use(mockListCurrencies({ response: USD_EUR_GBP }))
        renderWithNavigation(SettingsCurrencyScreen, 'SettingsCurrency')
        await waitFor(() =>
            expect(
                screen.getByTestId('settings_currency_item_usd'),
            ).toBeTruthy(),
        )
    })
})
```

Files under `apps/mobile/src/__integration__/` are picked up by the **integration** Vitest project (configured in `apps/mobile/vitest.config.ts`). Its setup file (`vitest.integration-setup.ts`) inherits the unit setup and then `vi.unmock`s the heavy `@perawallet/wallet-core-*` package mocks so flow tests exercise real domain code. Files outside `__integration__/` belong to the **unit** project and keep the speed-oriented mocks intact.

If a flow test needs the real implementation of a package not yet in the unmock list, add a single line to `apps/mobile/vitest.integration-setup.ts` rather than putting `vi.unmock` in the test file. `@perawallet/wallet-extension-*` packages stay mocked — they hit MMKV / biometrics / secure storage that only work on a real device.

### Quirks to know

- **Assert with `getByTestId`**, not `getByText`. The global PW component mocks pass `title` etc. as DOM attributes, not text content.
- **For text inputs use `fireEvent.change(input, { target: { value: '…' } })`**. `fireEvent.changeText` is `@testing-library/react-native`-only and doesn't exist on the DOM testing library this project uses via react-native-web.
- **Don't unmock `@react-navigation/*`**. The real native-stack navigator hits native-only APIs (`view.measure`) under jsdom + react-native-web. The global mock renders the initial screen, which is enough for single-screen flows.

### MSW handler factories

Each domain package owns thin MSW handler factories co-located with its endpoint definitions:

```
packages/<domain>/
├── src/
│   ├── api/<resource>/
│   │   ├── endpoints.ts          # production REST client
│   │   └── handlers.ts           # MSW factories (test-only)
│   └── test-handlers.ts          # barrel — never imported by prod code
```

Factories take `{ response, status?, …path-params }` and return an `HttpHandler`. **No defaults** — callers (tests or `__fixtures__/`) supply the data:

```typescript
export const mockListCurrencies = ({ response, status = 200 }: …): HttpHandler =>
    http.get('*/v1/currencies/', () => HttpResponse.json(response, { status }))
```

Tests import via the test-only sub-export `@perawallet/wallet-core-<domain>/test-handlers`, wired through `apps/mobile/vitest.config.ts` aliases and `apps/mobile/tsconfig.json` paths. The sub-export does NOT exist in `package.json#exports` — that's intentional, so production code can't reach it.

### Adding a new handler factory

1. Write `packages/<domain>/src/api/<resource>/handlers.ts` next to `endpoints.ts`.
2. Re-export from `packages/<domain>/src/test-handlers.ts`.
3. If the package has no other handlers yet:
    - Add `"msw": "catalog:"` to its `devDependencies`.
    - Confirm its `vite.config.ts` dts plugin excludes `**/{handlers,*-handlers}.ts` (this is the standard pattern across the repo).
4. For mobile imports: add a deep alias `@perawallet/wallet-core-<domain>/test-handlers` in `apps/mobile/vitest.config.ts` **before** the package's main alias, plus a matching entry in `apps/mobile/tsconfig.json` `paths`.
5. Run `pnpm build && pnpm lint:bundle` — the leak guard greps every `dist/` for msw imports and fails CI if a handler accidentally enters the prod bundle.

### Fixtures

Fixture data (named scenarios like `USD_EUR_GBP`, `JPY_ONLY`) lives in `apps/mobile/src/__integration__/__fixtures__/<domain>.ts`. Name fixtures after the shape they describe, not the test that uses them — the same fixture should be reusable across tests.
