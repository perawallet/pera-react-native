### Task 13 Report: E2E — onboarding, lock, unlock

#### Specs and what they prove

**`apps/extension/e2e/onboarding.spec.ts`** (replaces `popup.spec.ts`):

1. **`onboards in the expanded tab: password → create wallet → home`** — Proves full first-run flow in `expanded.html`: vault password creation (`create-password-input/confirm/submit`) → `OnboardingScreen` renders → `onboarding_create_wallet_button` click → `NameAccountScreen` appears (`name_account_finish_button`) → `MainHomePlaceholder` shows `account-home-address`.

2. **`locked popup shows unlock; wrong password errors; right password unlocks`** — Proves force-lock via `chrome.storage.session.remove('vault:master-key')` shows `unlock-password-input` in `popup.html` → wrong password surfaces `unlock-error` → correct password shows `account-home-address`.

#### Runtime bug found and fixed

**Root cause**: `AppShell.web.tsx` was missing `BottomSheetManager` + `BottomSheetModalProvider`. The onboarding flow calls `ensureTermsAccepted()` → `requestBottomSheet()` before creating a wallet. Without a sheet host, the promise never resolved and `handleCreateAccount` was permanently blocked.

**Failed attempt**: Adding `BottomSheetManager` directly crashed the extension because `@gorhom/bottom-sheet`'s `BottomSheetModal.present()` triggers a reanimated path incompatible with the Chrome extension's web environment (pageerror: `Cannot read properties of undefined (reading 'ReactNative')`).

**Actual fix** (`apps/mobile/src/AppShell.web.tsx`): Added `TermsAutoAcceptor` component that calls `acceptCurrentTerms()` on mount when `needsAcceptance` is true. On web, T&C acceptance via gorhom sheet can't work; the install from Chrome Web Store is the implicit acceptance. Positioned inside `QueryProvider` (settings store needs provider context).

#### Selector adaptations

- `onboarding_create_wallet_button` — from `OnboardingScreen.tsx`, renders correctly as `data-testid` in RNW DOM.
- `name_account_finish_button` — from `NameAccountForm.tsx`, renders after BIP39/HD derivation completes. Required `toBeVisible({ timeout: 45_000 })` before click (navigation is async).
- `terms_agree_button` — initially added T&C handling; removed after `TermsAutoAcceptor` fix pre-accepts on mount.
- `account-home-address` — from `AppShell.web.tsx` `MainHomePlaceholder`, confirmed visible.
- `unlock-password-input` / `unlock-error` / `unlock-submit` — from `UnlockScreen.tsx`, all selectors match.

#### Selector adaptation: double-press guard

`PWTouchableOpacity` has a 500ms double-press guard. After a wrong password, the UI calls `setPassword('')`. The test must wait for the input to clear (`toHaveValue('')`) AND add a `waitForTimeout(600)` to clear the guard before filling and clicking the submit button again. Without this, the second `unlock-submit` click is silently discarded.

#### Verification output

```
pnpm --filter extension bundle && pnpm --filter extension test:e2e

Running 2 tests using 1 worker
  ✓  onboarding.spec.ts:51 › onboards in the expanded tab: password → create wallet → home (803ms)
  ✓  onboarding.spec.ts:86 › locked popup shows unlock; wrong password errors; right password unlocks (1.4s)
  2 passed (4.0s)

pnpm --filter mobile test: 512 passed (3589 tests) — untouched
```

#### Concerns

- `TermsAutoAcceptor` silently accepts T&C on the web extension without presenting UI. This is by design (gorhom bottom-sheet crashes on web), but means the extension currently has no T&C acceptance gate for web users.
- The 600ms guard wait is tied to `DOUBLE_PRESS_GUARD_MS = 500` in `PWTouchableOpacity`. If that constant changes, the test wait should be updated.
- Pre-existing lint failures in `mobile` (`web-shims/node-crypto.js:119` numeric separator, `useCreatePasswordScreen.spec.ts:13` unused import) are not from this task.

## Fix round 1 (terms deferral, human-decided)

### What was done

Human owner decision: defer the terms gate entirely for M2 without writing any acceptance record. `TermsAutoAcceptor` was silently fabricating consent, which is a correctness problem regardless of the bottom-sheet crash.

**Changes made** (commit `94d9f5320`):

1. **`apps/mobile/src/AppShell.web.tsx`** — Removed `TermsAutoAcceptor` component definition, its `useTermsAcceptance` import, and its `<TermsAutoAcceptor />` mount. The component wrote `acceptedTermsVersion` to the settings store on mount, which fabricated consent without user action.

2. **`apps/mobile/src/modules/onboarding/screens/OnboardingScreen/useOnboardingScreen.tsx`** — Added `Platform` import from `react-native` and an early-return guard at the top of `ensureTermsAccepted()`: `if (Platform.OS === 'web') return true`. This bypasses the blocking bottom-sheet gate on web WITHOUT persisting any acceptance record. The exact required comment is included. The `needsAcceptance` check follows immediately after, so native behaviour is unchanged.

3. **`apps/extension/e2e/onboarding.spec.ts`** — Replaced the hard `page.waitForTimeout(600)` sleep with a `await expect(async () => { ... }).toPass({ timeout: 15_000 })` retry pattern. The retry fills the input and clicks submit on each attempt until `account-home-address` becomes visible, draining both the React clear cycle and the 500ms double-press guard without a fixed sleep.

4. **`apps/mobile/web-shims/node-crypto.js` line 119** — Changed `65536` to `65_536` (numeric separator lint rule).

5. **`apps/mobile/src/modules/vault/screens/CreatePasswordScreen/__tests__/useCreatePasswordScreen.spec.ts` line 13** — Removed unused `waitFor` from the `@testing-library/react` import.

### Verification results

| Check | Result |
|---|---|
| `pnpm --filter mobile lint` | exit 0 (warnings only, no errors) |
| `pnpm --filter mobile build` | exit 0 |
| `pnpm --filter mobile test -t 'WebAppShell\|Terms'` | 18 passed, 6 test files |
| `pnpm --filter mobile test` | 512 files passed, 3589 tests |
| `pnpm --filter extension bundle` | built successfully |
| `pnpm --filter extension test:e2e` | 2 passed (4.9s) |

### Acceptance record state on web

`useTermsAcceptance` reads `preferences.acceptedTermsVersion` from the settings store. On web after this fix: nothing writes that key, so `needsAcceptance` would be `true` — but `ensureTermsAccepted()` returns `true` immediately via the `Platform.OS === 'web'` guard before ever reading it. The acceptance preference remains UNSET on web.
