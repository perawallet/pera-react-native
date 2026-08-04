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

The test pyramid for this repo, from most to least invested in:

1. **Integration tests** (`apps/mobile/src/__integration__/`) — exercise full user flows against real domain code with only the network (MSW) and platform natives swapped out. **This is where screen and module-level behavior gets tested.** See [Integration Tests](#integration-tests-user-facing-flows) below.
2. **Hook & util unit tests** — pure logic, run fast, easy to make exhaustive. Every non-trivial hook, util, transformer, and store action gets one.
3. **Core / shared component unit tests** — behavioral tests for the design system (`apps/mobile/src/components/core/PW*/`) and shared components (`apps/mobile/src/components/[Name]/`). Smoke tests are welcome here too.
4. **Module-level component unit tests** — **don't write these.** Integration tests cover the screens that consume them. If a module component has non-trivial logic, extract it into a `use[Component]` hook and test the hook.

### In Packages (Business Logic)

Required:

- Zustand store updates and selectors
- Data transformation functions
- Hook behavior (with `renderHook`)
- Error handling and edge cases

### In the Mobile App

| Location                                                              | Write unit tests?                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/hooks/`, `modules/[mod]/hooks/`                      | **Yes — required.** Tests the actual behavior.                                                                                  |
| `apps/mobile/src/utils/`, module utils                                | **Yes — required** for any non-trivial pure function.                                                                           |
| `apps/mobile/src/components/core/PW*/`                                | **Yes.** Behavioral tests (interactions, prop wiring, conditional rendering, formatting). One smoke test per file is also fine. |
| `apps/mobile/src/components/[Name]/`                                  | **Yes** — same rules as core.                                                                                                   |
| `apps/mobile/src/modules/[mod]/components/`, `modules/[mod]/screens/` | **No.** Covered by integration tests. Extract logic into `use[Component]` / `use[Screen]` and test that instead.                |

### Don't write tests that

- Have no real assertion — e.g. `render(...); expect(container).toBeTruthy()`. If the only outcome you assert is that `render()` didn't throw, you're testing that the import works, which CI already catches at typecheck.
- Repeat the same render check several times with minor prop tweaks (`renders with variant=A`, `renders with variant=B`, …) when the variants don't change observable behavior. Pick one.
- Assert style values (color, padding, fontWeight). Theme tokens are reviewed in PRs, not tests.
- Re-test React Native primitives on every wrapper (`renders children`, `forwards testID`). Trust the platform.
- Use snapshot testing.

## Component Testing Standards

1. **File naming**: `.spec.tsx` for components (and `.spec.ts` for pure logic/hooks without JSX).
2. **Behavior only**: Test interactions (presses, inputs), conditional rendering, prop wiring, and formatting/text-transformation logic. Static text rendering is not behavior.
3. **AAA pattern**: Arrange, Act, Assert (comments are optional but the structure isn't).
4. **Naming**: `it('does X when Y happens')`.
5. **Atomicity**: Each test sets up its own state — use `beforeEach` for shared setup; never let one test depend on another's side effects.

```typescript
import { render, fireEvent, screen } from '@test-utils/render'

// ✅ Behavior — tests a user-observable outcome
it('submits form when save is pressed', () => {
    const onSave = vi.fn()
    render(<UserForm onSave={onSave} />)

    fireEvent.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalled()
})

// ❌ Not behavior — render-with-no-assertion
it('renders correctly', () => {
    const { container } = render(<UserForm onSave={vi.fn()} />)
    expect(container).toBeTruthy()
})

// ❌ Not behavior — variant render checks with no observable difference
it('renders with primary variant', () => {
    render(<PWChip title='new' variant='primary' />)
    expect(screen.getByText('NEW')).toBeTruthy()
})
it('renders with secondary variant', () => {
    render(<PWChip title='new' variant='secondary' />)
    expect(screen.getByText('NEW')).toBeTruthy()
})
```

## Key Principle

**Test behavior, not implementation.**

Ask: "What changes for the user when X happens?" If the answer is "nothing observable, just different internal styles," there's no test to write — let the integration test catch regressions on the surrounding flow.

## Integration Tests (User-Facing Flows)

Flow tests live in `apps/mobile/src/__integration__/<flow>.test.tsx` and exercise real React Query, real Zustand stores, real domain hooks, and the real KMS keystore — only the network is mocked (via MSW) and the platform's native services are swapped for in-memory test implementations.

The integration harness wires three test-only swaps via `vitest.config.ts` aliases:

- **`@perawallet/wallet-extension-platform-driver`** → `apps/mobile/src/test-utils/platform-driver-test.ts` — real-ish in-memory implementations of `keyValueStorage` (Map-backed), `biometrics` (always succeeds), `database` (no-op stub), `deviceInfo` (fixed test values), `analytics`/`crashReporting`/`pushNotification`/`remoteConfig` (no-ops with the right shapes).
- **`@algorandfoundation/react-native-keystore`** → `apps/mobile/src/test-utils/algorand-keystore-test.ts` — in-memory key store. `commit`/`removeKey`/`clear` mutate a Map AND the reactive TanStack store; `WithKeyStore` provides a `key.store.export(id)` surface so `useKMS()` can read private-key bytes.
- **`@perawallet/wallet-extension-ledger-react-native(-usb)`** → `apps/mobile/src/test-utils/ledger-extension-stub.ts` — empty extension stub. The real Ledger packages drag in `react-native-ble-plx` (Flow-typed) which doesn't parse under jsdom. The platform-agnostic `/protocol` deep-import is aliased separately to its real source so consumers (`packages/ledger`) still get types and constants.

Plus a stack-based **test navigator** (`apps/mobile/src/test-utils/test-navigator.tsx`) wired into the integration project via `vi.mock` calls in `vitest.integration-setup.ts`. It re-implements the `@react-navigation/native` + `native-stack` surface in pure React state — `navigate` / `push` / `replace` / `goBack` / `pop` / `popToTop` actually mutate a stack and re-render, so flow tests can traverse screens and assert on what's rendered after each transition. `useRoute().params` returns the params passed to the most recent navigation. Unit tests keep the simpler global stub from `vitest.setup.ts` that just renders the initial screen.

**algod / indexer via algokit-utils**: `algokit-utils` makes its REST calls through `fetch`, which MSW intercepts cleanly (verified in `apps/mobile/src/__integration__/algokit-smoke.test.ts`). Handler factories for the common algod and indexer endpoints live in `packages/blockchain/src/handlers.ts` and are re-exported via `@perawallet/wallet-core-blockchain/test-handlers`:

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

Defaults cover the boring fields (empty account, `fee: 0`, `min-fee: 1000`, `last-round: 1`) so most tests only override the value they're asserting on. Path globs match both algonode hosts.

The integration setup file (`apps/mobile/vitest.integration-setup.ts`) then `vi.unmock`s `@perawallet/wallet-extension-provider`, `@perawallet/wallet-core-kms`, `@perawallet/wallet-core-accounts`, and `@perawallet/wallet-core-blockchain` on top of the unit setup, so account creation, key management, provider-singleton code, and algokit clients all run end-to-end against the in-memory implementations and MSW.

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
- **`@react-navigation/*` is auto-replaced** for integration tests with the in-memory test navigator. `navigation.navigate(name, params)` and `navigation.goBack()` actually work — register additional screens via `renderWithNavigation(Screen, 'Name', { additionalScreens: [{ name: 'B', component: ScreenB }, ...] })` and assert on the screen that renders after a transition.

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

## Locale Tour (i18n screenshot QA)

A dev-build-only tool for visually checking translated/pseudolocalized text
across the app's screens, sheets, and dialogs — not a Vitest suite, and not
run in CI. It walks the gallery catalogs (`apps/mobile/src/modules/settings/screens/developer/gallery-catalog/`)
in a chosen locale and screenshots each surface. There is no dev-menu button
for it anymore; this section is the only place it's documented.

```sh
pnpm --filter mobile locale-tour --locale en-XA --out ./locale-shots
```

**The tour only exists in a dev bundle, and nothing about that is a runtime
check.** `apps/mobile/metro.config.js` resolves the tour's modules — driver,
deeplink parser, deeplink dispatcher, PWText overflow probe, pseudolocale
bundle — to no-op stubs unless `NODE_ENV === 'development'`, which Expo CLI
sets for `expo start` and only for `expo start`. So a normal `pnpm --filter
mobile start` gives you a working tour with no extra flag, and there is no way
to get one out of a release build: the code has no importer there and is never
bundled. Metro prints which way it went at startup
(`[metro] locale tour: enabled|stubbed`). If the driver reports the deeplink
was unrecognized, that line is the first thing to check — a `--no-dev` or
otherwise non-dev bundle stubs the parser, and the tour URL then resolves to a
harmless HOME.

**Hard precondition:** a booted iOS Simulator, Metro reachable, and the dev
client already **connected to Metro and past the splash screen**. This is an
Expo dev client — a cold launch lands on the dev-client launcher, which eats
the tour's deeplink instead of forwarding it to the app. The script checks
this precondition and fails with a remediation command rather than hanging;
it does not launch or connect the app for you.

**One OS prompt per run, not per step:** `xcrun simctl openurl` raises an
"Open in Pera?" confirmation dialog on iOS every time it's called, so the
driver fires a single `run=all` deeplink and lets the app self-advance
through every surface, rather than one deeplink per surface. The script
tries to auto-dismiss that one dialog via `osascript` keystrokes, which
requires a **macOS Accessibility grant** for the terminal running it (System
Settings > Privacy & Security > Accessibility). Without that grant, tap
"Open" on the Simulator by hand when prompted — the capture loop keeps
waiting for it.

**What the output does and does not prove:** `report.md` (written to
`--out`) reconciles BEGIN against captured/errored/missing steps and lists
any overflow findings, and that reconciliation is trustworthy — it's
computed from markers the app itself emits. What it does **not** prove is
that every PNG shows the surface it's filed under: there is no return
channel from the driver back to the app confirming a screenshot landed
before the app moved on, only a fixed on-screen hold (`CAPTURE_HOLD_MS` in
`runTour.ts`) sized to outlast the simulator's own screenshot latency.
Spot-check a sample of the PNGs by hand. The overflow JSON is not subject to
this risk — the app writes it in-process, before the screenshot is taken.

**The first 2-3 captures of every run are worse than a spot-check risk —
they are reliably wrong.** Step markers arrive from Metro in a burst right
after the "Open in Pera?" dialog is dismissed, and the driver's screenshot
loop (170-340ms per shot) can't keep up with the app's fastest early steps,
so `scr-tab-home.png`, `scr-tab-discover.png`, and similar early captures
typically show Swap-tab content instead — a driver-side backlog, not an app
bug, that reproduces on every run. Disregard the first 2-3 captures, or
re-check one surface on its own with the per-step deeplink form
(`perawallet://app/dev/locale-tour?locale=<tag>&step=<id>`), which isn't
subject to the backlog. This is a known limitation, not something planned to
be fixed: the real fix would need an inbound ack channel from driver back to
app, which was rejected on security grounds (no inbound listeners in the
app).
