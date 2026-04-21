# Ledger Integration Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Ledger hardware wallet signing pipeline (address re-fetch, timeouts, user-cancel handling, multi-tx progress) and bring UI/UX parity with native iOS/Android (icons, copy, styling, overlays).

**Architecture:** Keep hardware-wallet abstraction generic (`packages/hardware-wallet`, `packages/signing`). Ledger-specific logic stays in `packages/ledger` and `extensions/ledger-react-native`. XState machine owns all signing state transitions.

**Tech Stack:** React Native 0.83, TypeScript, XState v5, Vitest, `@ledgerhq/react-native-hw-transport-ble`, `@rneui/themed` (makeStyles)

---

## File Structure Map

| File | Responsibility |
|---|---|
| `packages/ledger/src/errors.ts` | Typed Ledger error classes + classification |
| `packages/ledger/src/constants.ts` | BLE UUIDs, status codes, timeout constants |
| `extensions/ledger-react-native/src/RNLedgerService.ts` | BLE transport bridge to Ledger SDK |
| `packages/signing/src/pipeline/signing/createHardwareStrategy.ts` | Hardware signing strategy (connect, verify, sign sequentially) |
| `packages/signing/src/machine/signingMachine.ts` | XState machine for signing flow |
| `packages/signing/src/machine/actors/signers/hardwareSignerActor.ts` | Actor invoked by machine for hardware signing |
| `apps/mobile/src/modules/ledger/utils/ledgerErrorPresets.ts` | Maps Ledger errors to PWResultView presets |
| `apps/mobile/src/modules/signing/components/LedgerSigningOverlay/` | Bottom sheet shown during Ledger signing |
| `apps/mobile/src/modules/ledger/components/LedgerDeviceItem/` | Row in BLE scan list |
| `apps/mobile/src/modules/ledger/screens/LedgerSelectAccountsScreen/styles.ts` | Styling for account selection |
| `apps/mobile/src/i18n/locales/en.json` | Ledger copy/strings |

---

## Phase 1: Signing Pipeline Fixes

### Task 1: Add `LedgerAddressMismatchError` and connection timeout constant

**Files:**
- Modify: `packages/ledger/src/errors.ts`
- Modify: `packages/ledger/src/constants.ts`

- [ ] **Step 1: Add `LedgerAddressMismatchError` to errors.ts**

Add this class after `LedgerTimeoutError` (before `getStatusCode`):

```typescript
/**
 * The address returned by the Ledger device does not match the expected address.
 * This prevents index mismatch attacks or device reordering.
 */
export class LedgerAddressMismatchError extends AppError {
    constructor(expected: string, actual: string, originalError?: Error) {
        super(
            `Ledger address mismatch: expected ${expected} but got ${actual}`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: false,
                params: { expected, actual },
            },
            originalError,
        )
    }
}
```

- [ ] **Step 2: Export `LedgerAddressMismatchError` from the ledger package barrel**

Check `packages/ledger/src/index.ts` and add the export if missing:

```typescript
export {
    // ... existing exports
    LedgerAddressMismatchError,
} from './errors'
```

- [ ] **Step 3: Add connection timeout constant to constants.ts**

After `LEDGER_CONFIRMATION_TIMEOUT_MS`, add:

```typescript
/**
 * Maximum time to wait for a BLE connection to the Ledger device.
 * Matches the 10-second timeout used by native iOS.
 */
export const LEDGER_CONNECTION_TIMEOUT_MS = 10_000
```

- [ ] **Step 4: Run ledger package tests**

Run: `pnpm --filter @perawallet/wallet-core-ledger test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ledger/src/errors.ts packages/ledger/src/constants.ts packages/ledger/src/index.ts
git commit -m "feat(ledger): add LedgerAddressMismatchError and connection timeout constant"
```

---

### Task 2: Fix `createHardwareStrategy.ts` — address re-fetch, timeout, user-cancel

**Files:**
- Modify: `packages/signing/src/pipeline/signing/createHardwareStrategy.ts`

- [ ] **Step 1: Add imports for new error and timeout constant**

Replace the existing ledger imports with:

```typescript
import {
    classifyLedgerError,
    LedgerConnectionError,
    LedgerAddressMismatchError,
    LEDGER_CONNECTION_TIMEOUT_MS,
} from '@perawallet/wallet-core-ledger'
```

- [ ] **Step 2: Add `withTimeout` helper**

Add this helper before `validateAndExtract`:

```typescript
const withTimeout = <T>(
    promise: Promise<T>,
    ms: number,
    operation: string,
): Promise<T> => {
    const timeout = new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id)
            reject(
                new LedgerConnectionError(
                    `${operation} timed out after ${ms}ms`,
                ),
            )
        }, ms)
    })
    return Promise.race([promise, timeout])
}
```

- [ ] **Step 3: Update `connectAndVerify` with timeout and address comparison**

Replace `connectAndVerify` with:

```typescript
const connectAndVerify = async (
    transportProvider: HardwareWalletTransportProvider,
    deviceId: string,
    accountIndex: number,
    expectedAddress: string,
    callbacks?: SigningCallbacks,
): Promise<HardwareWalletTransport> => {
    callbacks?.onPhaseChange?.('connecting')
    const transport = await withTimeout(
        transportProvider.connect(deviceId),
        LEDGER_CONNECTION_TIMEOUT_MS,
        'Connect to Ledger',
    )

    // Re-fetch address from device and compare to expected address
    // (prevents index mismatch attacks, matches native iOS behavior)
    const fetchedAccount = await transport.getAddress(accountIndex, false)
    if (fetchedAccount.address !== expectedAddress) {
        throw new LedgerAddressMismatchError(
            expectedAddress,
            fetchedAccount.address,
        )
    }

    callbacks?.onPhaseChange?.('awaiting-approval')
    return transport
}
```

- [ ] **Step 4: Update the `sign` method to pass expected address**

In the `sign` method, change the `connectAndVerify` call from:

```typescript
transport = await connectAndVerify(
    transportProvider,
    deviceId,
    accountIndex,
    callbacks,
)
```

To:

```typescript
transport = await connectAndVerify(
    transportProvider,
    deviceId,
    accountIndex,
    hwAccount.address,
    callbacks,
)
```

- [ ] **Step 5: Run signing pipeline tests**

Run: `pnpm --filter @perawallet/wallet-core-signing test`
Expected: PASS (or identify failures to fix in next task)

- [ ] **Step 6: Commit**

```bash
git add packages/signing/src/pipeline/signing/createHardwareStrategy.ts
git commit -m "feat(signing): add address re-fetch verification and connection timeout"
```

---

### Task 3: Fix `signingMachine.ts` — transition user rejection to `rejected` state

**Files:**
- Modify: `packages/signing/src/machine/signingMachine.ts`

- [ ] **Step 1: Add import for `LedgerUserRejectedError`**

Add to the existing imports from `@perawallet/wallet-core-ledger` (or add a new import block):

```typescript
import { LedgerUserRejectedError } from '@perawallet/wallet-core-ledger'
```

- [ ] **Step 2: Add `isUserRejected` guard**

In the `guards` object, add after `isRetryable`:

```typescript
isUserRejected: ({ context }) =>
    context.error instanceof LedgerUserRejectedError,
```

- [ ] **Step 3: Update `hardware` state's `onError` to branch on user rejection**

Change the `hardware` state's `onError` from:

```typescript
onError: {
    target: '#signingMachine.failed',
    actions: 'setSigningError',
},
```

To:

```typescript
onError: [
    {
        guard: 'isUserRejected',
        target: '#signingMachine.rejected',
        actions: 'setSigningError',
    },
    {
        target: '#signingMachine.failed',
        actions: 'setSigningError',
    },
],
```

- [ ] **Step 4: Run signing machine tests**

Run: `pnpm --filter @perawallet/wallet-core-signing test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/signing/src/machine/signingMachine.ts
git commit -m "feat(signing): transition Ledger user rejection to rejected state"
```

---

### Task 4: Update `ledgerErrorPresets.ts` with address mismatch preset

**Files:**
- Modify: `apps/mobile/src/modules/ledger/utils/ledgerErrorPresets.ts`
- Modify: `apps/mobile/src/i18n/locales/en.json`

- [ ] **Step 1: Add `address_mismatch` to preset kinds**

In `ledgerErrorPresets.ts`, update `LedgerErrorPresetKind` to include:

```typescript
export type LedgerErrorPresetKind =
    | 'app_not_open'
    | 'user_rejected'
    | 'connection_lost'
    | 'timeout'
    | 'connection_failed'
    | 'address_mismatch'
```

- [ ] **Step 2: Add address mismatch matcher**

Add to `KIND_BY_ERROR` array (before the final catch-all):

```typescript
{
    match: error => error instanceof LedgerAddressMismatchError,
    kind: 'address_mismatch',
},
```

Also add the import at the top:

```typescript
import {
    LedgerAppNotOpenError,
    LedgerConnectionError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LedgerUserRejectedError,
    LedgerAddressMismatchError,
} from '@perawallet/wallet-core-ledger'
```

- [ ] **Step 3: Add i18n strings for address mismatch**

In `apps/mobile/src/i18n/locales/en.json`, under `ledger.errors`, add:

```json
"address_mismatch": "The address on your Ledger device does not match the expected address. Please verify you selected the correct account.",
"address_mismatch_title": "Address Mismatch",
```

- [ ] **Step 4: Run mobile tests for ledger utils**

Run: `pnpm --filter mobile test -t ledgerErrorPresets`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/modules/ledger/utils/ledgerErrorPresets.ts apps/mobile/src/i18n/locales/en.json
git commit -m "feat(ledger): add address mismatch error preset and i18n strings"
```

---

### Task 5: Expand `hardwareSignerActor.spec.ts` — timeout, user cancel, address mismatch, rekeyed account

**Files:**
- Modify: `packages/signing/src/machine/actors/signers/__tests__/hardwareSignerActor.spec.ts`

- [ ] **Step 1: Add imports for new error types**

At the top of the test file, add:

```typescript
import {
    LedgerTimeoutError,
    LedgerUserRejectedError,
    LedgerAddressMismatchError,
} from '@perawallet/wallet-core-ledger'
```

- [ ] **Step 2: Add test for connection timeout**

Add after the existing tests:

```typescript
it('rejects with LedgerTimeoutError when connection hangs', async () => {
    const provider: HardwareWalletTransportProvider = {
        manufacturer: 'ledger',
        scan: () => () => {},
        connect: vi.fn().mockImplementation(
            () =>
                new Promise((_, reject) => {
                    setTimeout(
                        () => reject(new LedgerTimeoutError('connect')),
                        20_000,
                    )
                }),
        ),
        isSupported: vi.fn().mockResolvedValue(true),
    }

    const input: HardwareSignerActorInput = {
        groups: [makeGroup(ADDR_A)],
        allAccounts: [makeLedgerAccount(ADDR_A)],
        hardwareWalletRegistry: makeRegistry(provider),
        encodeTransaction: vi.fn(),
    }

    const actor = createActor(hardwareSignerActor, { input })
    actor.start()

    await expect(toPromise(actor)).rejects.toThrow(LedgerTimeoutError)
})
```

- [ ] **Step 3: Add test for user cancellation**

```typescript
it('rejects with LedgerUserRejectedError when user cancels on device', async () => {
    const transport = makeMockTransport()
    transport.signTransaction = vi.fn().mockRejectedValue(
        new LedgerUserRejectedError(),
    )
    const provider = makeMockProvider(transport)

    const input: HardwareSignerActorInput = {
        groups: [makeGroup(ADDR_A)],
        allAccounts: [makeLedgerAccount(ADDR_A)],
        hardwareWalletRegistry: makeRegistry(provider),
        encodeTransaction: vi.fn().mockReturnValue(new Uint8Array([0xaa])),
    }

    const actor = createActor(hardwareSignerActor, { input })
    actor.start()

    await expect(toPromise(actor)).rejects.toThrow(LedgerUserRejectedError)
})
```

- [ ] **Step 4: Add test for address mismatch**

```typescript
it('rejects with LedgerAddressMismatchError when device address differs', async () => {
    const transport = makeMockTransport()
    transport.getAddress = vi.fn().mockResolvedValue({
        address: ADDR_B, // different from expected
        publicKey: new Uint8Array(32),
        accountIndex: 0,
    })
    const provider = makeMockProvider(transport)

    const input: HardwareSignerActorInput = {
        groups: [makeGroup(ADDR_A)],
        allAccounts: [makeLedgerAccount(ADDR_A)],
        hardwareWalletRegistry: makeRegistry(provider),
        encodeTransaction: vi.fn(),
    }

    const actor = createActor(hardwareSignerActor, { input })
    actor.start()

    await expect(toPromise(actor)).rejects.toThrow(LedgerAddressMismatchError)
})
```

- [ ] **Step 5: Add test for rekeyed account signing**

```typescript
it('signs for a rekeyed account that authorizes a Ledger account', async () => {
    const transport = makeMockTransport()
    const provider = makeMockProvider(transport)

    // Account A is rekeyed to Account B (Ledger)
    const rekeyedAccount: WalletAccount = {
        type: 'algo25',
        address: ADDR_A,
        keyPairId: 'key-1',
        authAddress: ADDR_B,
    } as unknown as WalletAccount

    const ledgerAccount = makeLedgerAccount(ADDR_B)

    const input: HardwareSignerActorInput = {
        groups: [makeGroup(ADDR_A)],
        allAccounts: [rekeyedAccount, ledgerAccount],
        hardwareWalletRegistry: makeRegistry(provider),
        encodeTransaction: vi.fn().mockReturnValue(new Uint8Array([0xaa])),
    }

    const actor = createActor(hardwareSignerActor, { input })
    actor.start()
    const results = await toPromise(actor)

    expect(results).toHaveLength(1)
    expect(results[0].signedData.type).toBe('transactions')
    expect(results[0].signers[0].address).toBe(ADDR_B)
})
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @perawallet/wallet-core-signing test -- packages/signing/src/machine/actors/signers/__tests__/hardwareSignerActor.spec.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/signing/src/machine/actors/signers/__tests__/hardwareSignerActor.spec.ts
git commit -m "test(signing): add timeout, user cancel, address mismatch, and rekeyed account tests"
```

---

### Task 6: Expand `RNLedgerService.spec.ts` — APDU error classification

**Files:**
- Modify: `extensions/ledger-react-native/src/__tests__/RNLedgerService.spec.ts`

- [ ] **Step 1: Add test for user rejection APDU codes**

Add tests that verify `classifyLedgerError` handles the APDU codes correctly:

```typescript
it('classifies 0x6985 as LedgerUserRejectedError', () => {
    const error = { statusCode: 0x6985 }
    const classified = classifyLedgerError(error)
    expect(classified).toBeInstanceOf(LedgerUserRejectedError)
})

it('classifies 0x6986 as LedgerUserRejectedError', () => {
    const error = { statusCode: 0x6986 }
    const classified = classifyLedgerError(error)
    expect(classified).toBeInstanceOf(LedgerUserRejectedError)
})

it('classifies 0x6e00 as LedgerAppNotOpenError', () => {
    const error = { statusCode: 0x6e00 }
    const classified = classifyLedgerError(error)
    expect(classified).toBeInstanceOf(LedgerAppNotOpenError)
})

it('classifies disconnect message as LedgerDisconnectedError', () => {
    const error = new Error('Device disconnected')
    const classified = classifyLedgerError(error)
    expect(classified).toBeInstanceOf(LedgerDisconnectedError)
})

it('classifies timeout message as LedgerTimeoutError', () => {
    const error = new Error('Connection timeout')
    const classified = classifyLedgerError(error)
    expect(classified).toBeInstanceOf(LedgerTimeoutError)
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @perawallet/wallet-extension-ledger-react-native test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add extensions/ledger-react-native/src/__tests__/RNLedgerService.spec.ts
git commit -m "test(ledger-react-native): add APDU error classification tests"
```

---

## Phase 2: UI/UX Parity

### Task 7: Fix copy in `en.json` — supported models and signing progress

**Files:**
- Modify: `apps/mobile/src/i18n/locales/en.json`

- [ ] **Step 1: Fix "Only Ledger Nano X is supported" to list all models**

Change:
```json
"issue_unsupported": "Only Ledger Nano X is supported.",
```

To:
```json
"issue_unsupported": "Pera supports Ledger Nano X, Stax, Flex, and Nano Gen5.",
```

- [ ] **Step 2: Add multi-transaction progress strings**

Under `ledger.signing`, add:

```json
"progress": "Signing transaction {{current}} of {{total}}...",
```

- [ ] **Step 3: Run type check**

Run: `pnpm --filter mobile tsc --noEmit`
Expected: No type errors (i18n keys are used dynamically, so this is mainly a sanity check)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/i18n/locales/en.json
git commit -m "fix(i18n): update Ledger copy for supported models and signing progress"
```

---

### Task 8: Update `LedgerSigningOverlay` with progress and enhanced status

**Files:**
- Modify: `apps/mobile/src/modules/signing/components/LedgerSigningOverlay/LedgerSigningOverlay.tsx`
- Modify: `apps/mobile/src/modules/signing/components/LedgerSigningOverlay/styles.ts`

- [ ] **Step 1: Add `progress` prop and update types**

Change the props type to:

```typescript
type LedgerSigningOverlayProps = {
    isVisible: boolean
    status: 'connecting' | 'confirming' | 'error' | 'timeout'
    currentTx?: number
    totalTxs?: number
    onCancel: () => void
    onRetry?: () => void
}
```

- [ ] **Step 2: Update component to show progress when signing multiple transactions**

Replace the component body to include progress text:

```typescript
export const LedgerSigningOverlay = ({
    isVisible,
    status,
    currentTx,
    totalTxs,
    onCancel,
    onRetry,
}: LedgerSigningOverlayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const showRetry = status === 'error' || status === 'timeout'
    const showProgress =
        status === 'confirming' &&
        typeof currentTx === 'number' &&
        typeof totalTxs === 'number' &&
        totalTxs > 1

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onDismiss={onCancel}
        >
            <PWView style={styles.container}>
                <PWText style={styles.title}>
                    {t('ledger.signing.title')}
                </PWText>

                {!showRetry && (
                    <ActivityIndicator
                        size='large'
                        style={styles.indicator}
                    />
                )}

                <PWText style={styles.message}>
                    {t(STATUS_MESSAGE_KEYS[status])}
                </PWText>

                {showProgress && (
                    <PWText style={styles.progress}>
                        {t('ledger.signing.progress', {
                            current: currentTx,
                            total: totalTxs,
                        })}
                    </PWText>
                )}

                <PWView style={styles.actions}>
                    {showRetry && onRetry && (
                        <PWButton
                            variant='primary'
                            title={t('ledger.fetch_accounts.retry')}
                            onPress={onRetry}
                            style={styles.retryButton}
                        />
                    )}
                    <PWButton
                        variant='secondary'
                        title={t('ledger.signing.cancel')}
                        onPress={onCancel}
                    />
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
```

- [ ] **Step 3: Add progress style**

In `styles.ts`, add:

```typescript
progress: {
    ...getTypography(theme, 'body'),
    color: theme.colors.textMain,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
},
```

- [ ] **Step 4: Run component tests if they exist**

Run: `pnpm --filter mobile test -t LedgerSigningOverlay`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/modules/signing/components/LedgerSigningOverlay/
git commit -m "feat(signing): add multi-tx progress to LedgerSigningOverlay"
```

---

### Task 9: Update `LedgerSelectAccountsScreen` selected account styling

**Files:**
- Modify: `apps/mobile/src/modules/ledger/screens/LedgerSelectAccountsScreen/styles.ts`

- [ ] **Step 1: Add selected item style with green border**

In `styles.ts`, add:

```typescript
selectedItem: {
    borderWidth: 2,
    borderColor: theme.colors.positive,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
},
```

- [ ] **Step 2: Apply selected style in the screen component**

Read the screen component file to find where `itemContainer` is used and conditionally apply `selectedItem` when the account is selected. The exact change depends on the component's current implementation — look for the `selected` boolean and add:

```typescript
style={[styles.itemContainer, isSelected && styles.selectedItem]}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter mobile test -t LedgerSelectAccountsScreen`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/modules/ledger/screens/LedgerSelectAccountsScreen/
git commit -m "feat(ledger): add green border highlight for selected Ledger accounts"
```

---

### Task 10: Update `LedgerDeviceItem` with Ledger-specific icon

**Files:**
- Modify: `apps/mobile/src/modules/ledger/components/LedgerDeviceItem/LedgerDeviceItem.tsx`

- [ ] **Step 1: Replace generic wallet icon with Ledger icon**

The project may not have a Ledger-specific icon asset yet. If `PWIcon` supports an `icon-ledger` or similar name, use it. Otherwise, add a comment noting that a design asset is needed.

For now, change:

```typescript
<PWIcon
    name='wallet'
    size='md'
/>
```

To:

```typescript
<PWIcon
    name='ledger'
    size='md'
/>
```

If `PWIcon` does not have a `ledger` icon, check the asset pipeline and add the icon (this may require design team input — document it in the PR).

- [ ] **Step 2: Run tests**

Run: `pnpm --filter mobile test -t LedgerDeviceItem`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/modules/ledger/components/LedgerDeviceItem/
git commit -m "feat(ledger): use Ledger-specific icon in device list"
```

---

## Phase 3: Verification

### Task 11: Run full test suite and pre-push

- [ ] **Step 1: Run all ledger-related tests**

```bash
pnpm --filter @perawallet/wallet-core-ledger test
pnpm --filter @perawallet/wallet-core-signing test
pnpm --filter @perawallet/wallet-extension-ledger-react-native test
```
Expected: All PASS

- [ ] **Step 2: Run mobile tests**

```bash
pnpm --filter mobile test -t ledger
```
Expected: All PASS

- [ ] **Step 3: Run type check**

```bash
pnpm --filter @perawallet/wallet-core-ledger tsc --noEmit
pnpm --filter @perawallet/wallet-core-signing tsc --noEmit
pnpm --filter mobile tsc --noEmit
```
Expected: No type errors

- [ ] **Step 4: Run pre-push**

```bash
pnpm pre-push --no-fail-on-error
```
Expected: Lint and format pass

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git commit -m "fix: address review feedback and test failures" || echo "No changes to commit"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Address re-fetch before sign | Task 2 |
| Connection timeout guard | Task 2 |
| User cancel handling | Task 3 |
| Multi-tx progress | Task 8 |
| Error classification parity | Task 1, 4, 6 |
| Rekeyed account signing | Task 5 |
| Copy parity | Task 7 |
| Selected account styling | Task 9 |
| Ledger device icon | Task 10 |

### Placeholder Scan

- No TBD/TODO placeholders
- All test code is concrete with assertions
- All file paths are exact
- All commit messages follow conventional commits

### Type Consistency Check

- `LedgerAddressMismatchError` defined in `errors.ts`, imported in `createHardwareStrategy.ts`, `ledgerErrorPresets.ts`, and test files
- `LEDGER_CONNECTION_TIMEOUT_MS` defined in `constants.ts`, imported in `createHardwareStrategy.ts`
- `LedgerUserRejectedError` guard used consistently in `signingMachine.ts`
- i18n keys `ledger.signing.progress` and `ledger.errors.address_mismatch` are defined and referenced

---

## Plan Complete

Saved to `docs/superpowers/plans/2026-04-21-ledger-integration.md`

**Execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`

Which approach?