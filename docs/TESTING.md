# Testing

Vitest everywhere, packages and apps alike. Components render through React Native Testing Library
on top of react-native-web.

```sh
pnpm test                    # All tests (unit + integration)
pnpm test:integration        # Only integration tests (recursive)
pnpm --filter mobile test    # Mobile app tests only
```

Tests are colocated with source in `__tests__/` folders. `.spec.tsx` for anything with JSX,
`.spec.ts` for pure logic and hooks.

## What to test

The pyramid for this repo, from most to least invested in:

1. **Integration tests** (`apps/mobile/src/__integration__/`) exercise full user flows against real
   domain code, with only the network (MSW) and platform natives swapped out. This is where screen
   and module-level behaviour gets tested.
2. **Hook and util unit tests** are pure logic, run fast, and are easy to make exhaustive. Every
   non-trivial hook, util, transformer and store action gets one.
3. **Core and shared component unit tests** cover the design system
   (`apps/mobile/src/components/core/PW*/`) and shared components
   (`apps/mobile/src/components/[Name]/`). Smoke tests are welcome here.
4. **Module-level component unit tests** are not written at all. Integration tests cover the screens
   that consume them; if a module component has non-trivial logic, extract it into a
   `use[Component]` hook and test the hook.

| Location                                                              | Unit tests?                                                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/*` stores, transformers, hooks, error paths                 | Required. This is where the behaviour lives.                                                            |
| `apps/mobile/src/hooks/`, `modules/[mod]/hooks/`                      | Required.                                                                                               |
| `apps/mobile/src/utils/`, module utils                                | Required for any non-trivial pure function.                                                             |
| `apps/mobile/src/components/core/PW*/`                                | Yes. Interactions, prop wiring, conditional rendering, formatting. One smoke test per file is fine too. |
| `apps/mobile/src/components/[Name]/`                                  | Yes, same rules as core.                                                                                |
| `apps/mobile/src/modules/[mod]/components/`, `modules/[mod]/screens/` | No. Covered by integration tests; test the extracted hook instead.                                      |

### Don't write tests that

- Have no real assertion, such as `render(...); expect(container).toBeTruthy()`. If the only outcome
  you assert is that `render()` didn't throw, you're testing that the import works, which typecheck
  already catches.
- Repeat the same render check with minor prop tweaks (`renders with variant=A`,
  `renders with variant=B`) when the variants don't change observable behaviour. Pick one.
- Assert style values (color, padding, fontWeight). Theme tokens are reviewed in PRs, not tests.
- Re-test React Native primitives on every wrapper (`renders children`, `forwards testID`).
- Use snapshots.

## Writing a component test

Test behaviour, not implementation. Ask what changes for the user when X happens; if the answer is
"nothing observable, just different internal styles", there is no test to write, and the integration
test will catch regressions on the surrounding flow.

Use AAA structure (the comments are optional, the structure isn't), name tests
`it('does X when Y happens')`, and give each test its own setup so none depends on another's side
effects.

```typescript
import { render, fireEvent, screen } from '@test-utils/render'

// Good — asserts a user-observable outcome
it('submits form when save is pressed', () => {
    const onSave = vi.fn()
    render(<UserForm onSave={onSave} />)

    fireEvent.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalled()
})

// Bad — render with no assertion
it('renders correctly', () => {
    const { container } = render(<UserForm onSave={vi.fn()} />)
    expect(container).toBeTruthy()
})

// Bad — variant checks with no observable difference between them
it('renders with primary variant', () => {
    render(<PWChip title='new' variant='primary' />)
    expect(screen.getByText('NEW')).toBeTruthy()
})
it('renders with secondary variant', () => {
    render(<PWChip title='new' variant='secondary' />)
    expect(screen.getByText('NEW')).toBeTruthy()
})
```

## Integration tests

Flow tests live in `apps/mobile/src/__integration__/<flow>.test.tsx` and run real React Query, real
Zustand stores, real domain hooks and the real KMS keystore. Only the network is mocked (MSW) and the
platform's native services are swapped for in-memory test implementations.

Three test-only aliases, wired in `vitest.config.ts`. Each stand-in explains itself at the top of
its own file, including what it deliberately does not reproduce; read those rather than trusting a
summary here.

| Real module                                         | Stand-in                                   |
| --------------------------------------------------- | ------------------------------------------ |
| `@perawallet/wallet-extension-platform-driver`      | `src/test-utils/platform-driver-test.ts`   |
| `@algorandfoundation/react-native-keystore`         | `src/test-utils/algorand-keystore-test.ts` |
| `@perawallet/wallet-extension-ledger-react-native*` | `src/test-utils/ledger-extension-stub.ts`  |
| `@react-navigation/native`, `native-stack`          | `src/test-utils/test-navigator.tsx`        |

The keystore double is the one to watch: it mirrors the real library's shape rather than an
approximation, because a drifting double leaves the whole flow suite green against an API the library
no longer has. The Ledger stub exists because the real packages pull in `react-native-ble-plx`, which
is Flow-typed and does not parse under jsdom; the platform-agnostic `/protocol` deep-import is
aliased separately to its real source so consumers still get types and constants.

### algod and indexer via algokit-utils

`algokit-utils` makes its REST calls through `fetch`, which MSW intercepts cleanly (verified in
`apps/mobile/src/__integration__/algokit-smoke.test.ts`). Handler factories for the common algod and
indexer endpoints live in `packages/blockchain/src/msw-handlers.ts` and are re-exported via
`@perawallet/wallet-core-blockchain/test-handlers`:

```typescript
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
    mockAlgodSendRawTransaction,
    mockIndexerAccountTransactions,
} from '@perawallet/wallet-core-blockchain/test-handlers'

server.use(
    mockAlgodAccountInformation({
        address: TEST_ADDR,
        response: { amount: 5_000_000 },
    }),
    mockAlgodTransactionParams(),
)
```

Defaults cover the boring fields (empty account, `fee: 0`, `min-fee: 1000`, `last-round: 1`) so most
tests only override the value they're asserting on. Path globs match both algonode hosts.

`apps/mobile/vitest.integration-setup.ts` then `vi.unmock`s
`@perawallet/wallet-extension-provider`, `@perawallet/wallet-core-kms`,
`@perawallet/wallet-core-accounts` and `@perawallet/wallet-core-blockchain` on top of the unit setup,
so account creation, key management, provider-singleton code and algokit clients all run end-to-end
against the in-memory implementations and MSW.

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

Files under `apps/mobile/src/__integration__/` are picked up by the integration Vitest project
(configured in `apps/mobile/vitest.config.ts`). Files outside it belong to the unit project and keep
the speed-oriented mocks intact.

If a flow test needs the real implementation of a package not yet in the unmock list, add a single
line to `apps/mobile/vitest.integration-setup.ts` rather than putting `vi.unmock` in the test file.
`@perawallet/wallet-extension-*` packages stay mocked: they hit MMKV, biometrics and secure storage,
which only work on a real device.

### Quirks to know

- Assert with `getByTestId`, not `getByText`. The global PW component mocks pass `title` and friends
  as DOM attributes, not text content.
- For text inputs use `fireEvent.change(input, { target: { value: '…' } })`. `fireEvent.changeText`
  is `@testing-library/react-native`-only and doesn't exist on the DOM testing library this project
  uses via react-native-web.
- `@react-navigation/*` is auto-replaced for integration tests with the in-memory test navigator, so
  `navigation.navigate(name, params)` and `navigation.goBack()` actually work. Register additional
  screens via
  `renderWithNavigation(Screen, 'Name', { additionalScreens: [{ name: 'B', component: ScreenB }] })`
  and assert on the screen that renders after a transition.

### MSW handler factories

Each domain package owns thin MSW handler factories colocated with its endpoint definitions:

```
packages/<domain>/
├── src/
│   ├── api/<resource>/
│   │   ├── endpoints.ts          # production REST client
│   │   └── msw-handlers.ts       # MSW factories (test-only)
│   └── test-handlers.ts          # barrel, never imported by prod code
```

Factories take `{ response, status?, …path-params }` and return an `HttpHandler`. They carry no
defaults; callers (tests or `__fixtures__/`) supply the data:

```typescript
export const mockListCurrencies = ({ response, status = 200 }: …): HttpHandler =>
    http.get('*/v1/currencies/', () => HttpResponse.json(response, { status }))
```

Tests import via the test-only sub-export `@perawallet/wallet-core-<domain>/test-handlers`, wired
through `apps/mobile/vitest.config.ts` aliases and `apps/mobile/tsconfig.json` paths. That sub-export
deliberately does not exist in `package.json#exports`, so production code can't reach it.

To add a factory:

1. Write `msw-handlers.ts` next to the `endpoints.ts` it mocks. That is usually
   `src/api/<resource>/`, but follow whatever layout the package already has.
2. Re-export from `packages/<domain>/src/test-handlers.ts`.
3. If the package has no other handlers yet, add `"msw": "catalog:"` to its `devDependencies` and
   confirm its `vite.config.ts` dts plugin excludes `**/{handlers,*-handlers}.ts`, which every
   package in the repo carries.
4. For mobile imports, add a deep alias `@perawallet/wallet-core-<domain>/test-handlers` in
   `apps/mobile/vitest.config.ts` _before_ the package's main alias, plus a matching entry in
   `apps/mobile/tsconfig.json` `paths`.
5. Run `pnpm build && pnpm lint:bundle`. The leak guard greps every `dist/` for msw imports and fails
   CI if a handler enters the prod bundle.

### Fixtures

Fixture data (named scenarios like `USD_EUR_GBP`, `JPY_ONLY`) lives in
`apps/mobile/src/__integration__/__fixtures__/<domain>.ts`. Name a fixture after the shape it
describes, not the test that uses it, so it stays reusable.

## Locale tour (i18n screenshot QA)

A dev-build-only tool for visually checking translated and pseudolocalized text across the app's
screens, sheets and dialogs. Not a Vitest suite, and it does not run in CI. It walks the gallery
catalogs in a chosen locale and screenshots each surface.

```sh
pnpm --filter mobile locale-tour --locale en-XA --out ./locale-shots
```

**Preconditions:** a booted iOS Simulator, Metro reachable, and the dev client already connected to
Metro and past the splash screen. A cold launch lands on the dev-client launcher, which eats the
tour's deeplink. The script checks this and fails with a remediation command rather than hanging.

The tour only exists in a dev bundle, and that is a bundling fact rather than a runtime check:
`metro.config.js` resolves its modules to no-op stubs unless `NODE_ENV === 'development'`, which Expo
CLI sets for `expo start` and only for `expo start`. Metro prints which way it went at startup
(`[metro] locale tour: enabled|stubbed`), and that line is the first thing to check if the driver
reports the deeplink as unrecognized.

**Reading the output:** `report.md` reconciles BEGIN against captured, errored and missing steps, and
that reconciliation is trustworthy because it is computed from markers the app emits. The PNGs are
best-effort: there is no return channel confirming a screenshot landed before the app advanced, so
spot-check them, and disregard the first few captures of a run, which are reliably wrong. The
overflow JSON is written in-process and is reliable.

`runTour.ts` and `apps/mobile/scripts/locale-tour.mjs` document the capture race, the single-deeplink
design and the cascade detection at the point they happen.
