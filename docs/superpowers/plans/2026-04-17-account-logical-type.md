# Account Logical Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a single `AccountLogicalType` derived on-the-fly from `(walletAccount, accountsList, chainAuthAddress)`, matching Android/webview naming, and migrate all UI call sites and the webview bridge to use it so watch-vs-rekeyed distinctions work correctly.

**Architecture:** Keep storage types untouched. Derive the logical type in a pure function (`deriveAccountLogicalType`) in `packages/accounts`, read the chain auth address from the SQLite `account_balances.auth_address` column (kept fresh by the sync service), and also propagate that chain auth back into `WalletAccount.rekeyAddress` in the Zustand store so every consumer sees a consistent state. Expose two React hooks — `useAccountLogicalType(address)` and `useAllAccountLogicalTypes()` — that compose the store list + DB state. Replace the existing `resolveAccountStatus`/`AccountStatus` (UI) and the webview `getAccountType` with a single source of truth.

**Tech Stack:** TypeScript, Zustand, TanStack Query, Drizzle ORM (SQLite), React Native, Vitest + React Native Testing Library.

**Native cross-check:**

- Android `GetAccountTypeUseCase` ([pera-android common-sdk/src/main/kotlin/com/algorand/wallet/account/detail/domain/usecase/GetAccountTypeUseCase.kt:26-69](../../../../pera-android/common-sdk/src/main/kotlin/com/algorand/wallet/account/detail/domain/usecase/GetAccountTypeUseCase.kt)) defines 7 types: `Algo25`, `HdKey`, `LedgerBle`, `Rekeyed`, `RekeyedAuth`, `NoAuth`, `Joint`. There is no `HardwareBle`.
- iOS has a simpler 5-case enum (`standard`, `watch`, `ledger`, `joint`, `rekeyed`) plus a richer `AccountAuthorization` layer ([pera-ios PeraWalletCore/Demo/AccountAuthorizationDeterminer.swift:25-70](../../../../pera-ios/PeraWalletCore/Demo/AccountAuthorizationDeterminer.swift)), but neither platform distinguishes non-Ledger hardware.
- Android's rekey chain walk is **single-hop**; this plan intentionally uses a **recursive** walk for correctness (so `A → B(rekeyed) → C` resolves to `RekeyedAuth` only when `C` can actually sign).
- This plan consolidates to **7 types** — `HardwareBle` is dropped, and `AccountTypes.hardware` always maps to `LedgerBle` regardless of `manufacturer`. Multisig keeps the name `Multisig` (RN internal name) in the webview payload.

---

## Context

Today the wallet classifies accounts via two parallel, inconsistent functions, each with bugs:

- `resolveAccountStatus()` at [packages/accounts/src/utils.ts:105](packages/accounts/src/utils.ts#L105) returns `standard | hardware | watch | noAuth | rekeyedStandard | rekeyedHardware | hdWallet | multisig`. Bug: for a rekeyed account it only checks `authAccount` **exists** in the wallet — not that it can actually sign. A rekeyed account whose auth is itself a watch account would be classified `rekeyedStandard`.
- `getAccountType()` at [apps/mobile/src/modules/webview/hooks/utils.ts:25](apps/mobile/src/modules/webview/hooks/utils.ts#L25) returns Android-style names (`Algo25 | HdKey | LedgerBle | HardwareBle | Multisig | NoAuth | Rekeyed | RekeyedAuth`). Bug: `hasSigningKeys(account)` checks only the account itself, not `canSignWithAccount(account, accounts)` — so a watch account rekeyed to one of our signing accounts is classified `Rekeyed` instead of `RekeyedAuth`.

The ticket reported by the team: when a watch account that has been rekeyed on chain gets imported, and we already hold the signing keys for its auth address, the app should classify it as a **rekeyed** account (signing-capable), not as a **no-auth** account. Both the UI (icons, menu options, button enablement) and the webview bridge (dApp capability advertisement) depend on this classification.

On top of the classification bug, `WalletAccount.rekeyAddress` in the Zustand store is only populated at account-creation time (onboarding discovery). The sync service fetches the current chain `authAddr` and writes it to `account_balances.auth_address` but never back-fills it into the store — so a rekey that happens on chain after import is invisible to the UI until the app is reinstalled.

This plan unifies the two classifications under the Android-aligned names (cross-platform parity), reads the chain auth address as the source of truth for the rekey state, propagates that into the store so selectors are consistent, and migrates every UI branching on account type to the new helper.

## File Structure

**Create**

- `packages/accounts/src/logical-type.ts` — `AccountLogicalType`, `AccountLogicalTypes`, `deriveAccountLogicalType`, legacy-status adapter.
- `packages/accounts/src/__tests__/logical-type.spec.ts` — unit tests for every branch of the derivation.
- `packages/accounts/src/hooks/useAccountLogicalType.ts` — hook: address → `AccountLogicalType`.
- `packages/accounts/src/hooks/useAllAccountLogicalTypes.ts` — hook: `Map<address, AccountLogicalType>` for all accounts, memoized.
- `packages/accounts/src/hooks/useChainAuthAddressesQuery.ts` — TanStack Query reading `account_balances.auth_address` for the current network.

**Modify**

- `packages/accounts/src/store/store.ts` — add `updateAccountRekeyAddress(address, rekeyAddress)` action.
- `packages/accounts/src/sync/account-syncer.ts` — after DB upsert, propagate chain `authAddr` into Zustand.
- `packages/accounts/src/utils.ts` — delete `resolveAccountStatus` and `AccountStatus`, update `isSigningAccount` to use `deriveAccountLogicalType`.
- `packages/accounts/src/index.ts` — export new type, function, hooks.
- `apps/mobile/src/modules/accounts/components/AccountIcon/AccountIcon.tsx` — map from `AccountLogicalType` → icon asset.
- `apps/mobile/src/modules/accounts/components/AccountInfoCard/AccountTypeInfoContent/useAccountTypeInfo.ts` — map from `AccountLogicalType` → i18n keys; actions.
- `apps/mobile/src/modules/accounts/components/AccountInfoCard/useAccountInfoCard.ts` — use logical type for label and signing decision.
- `apps/mobile/src/modules/accounts/components/AccountOptionsBottomSheet/useAccountOptions.ts` — use logical type to gate passphrase / undo-rekey / rekey / auth-address menu entries.
- `apps/mobile/src/modules/accounts/components/AccountAssetList/useAccountAssetList.ts`, `AccountAssetList.tsx` — derive `isWatch` from logical type.
- `apps/mobile/src/modules/accounts/components/ManageAssetsBottomSheet/ManageAssetsBottomSheet.tsx` — prop rename/no-op; uses `isWatchAccount` from caller.
- `apps/mobile/src/modules/accounts/components/AccountOverview/useAccountOverviewHeader.ts` — `canSign` from logical type.
- `apps/mobile/src/modules/accounts/components/AccountNfts/useAccountNfts.ts` — `canOptIn` from logical type.
- `apps/mobile/src/modules/assets/components/holdings/AssetActionButtons/AssetActionButtons.tsx` — `isWatch` from logical type.
- `apps/mobile/src/modules/assets/screens/CollectibleDetailScreen/useCollectibleDetail.ts` — `isWatch` from logical type.
- `apps/mobile/src/modules/transactions/screens/send-funds/SelectDestinationScreen/useSelectDestinationScreen.ts` — classify destination via logical type (keeps `canSignWithAccount` as thin wrapper).
- `apps/mobile/src/modules/webview/hooks/utils.ts` — delete `getAccountType`, replace with re-export of `deriveAccountLogicalType`.
- `apps/mobile/src/modules/webview/hooks/usePeraWebviewInterface.ts:245` — call `deriveAccountLogicalType` directly.
- `apps/mobile/src/modules/webview/hooks/__tests__/utils.test.ts` — delete (covered by logical-type spec).

---

## Phase 1 — Domain: `AccountLogicalType` + pure derivation

### Task 1: Create the `AccountLogicalType` model

**Files:**

- Create: `packages/accounts/src/logical-type.ts`
- Test: `packages/accounts/src/__tests__/logical-type.spec.ts`

- [ ] **Step 1: Write the failing test file**

Path: `packages/accounts/src/__tests__/logical-type.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import { AccountLogicalTypes, deriveAccountLogicalType } from '../logical-type'
import {
    AccountTypes,
    type Algo25Account,
    type HDWalletAccount,
    type HardwareWalletAccount,
    type MultiSigAccount,
    type WalletAccount,
    type WatchAccount,
} from '../models'

const algo25 = (address: string, keyPairId = 'kp'): Algo25Account => ({
    type: AccountTypes.algo25,
    address,
    keyPairId,
})

const hdWallet = (address: string): HDWalletAccount => ({
    type: AccountTypes.hdWallet,
    address,
    keyPairId: 'kp',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 32,
    },
})

const ledger = (address: string): HardwareWalletAccount => ({
    type: AccountTypes.hardware,
    address,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'd',
        deviceName: 'Ledger',
        accountIndex: 0,
    },
})

const multisig = (address: string): MultiSigAccount => ({
    type: AccountTypes.multisig,
    address,
    multisigDetails: { threshold: 1, addresses: [] },
})

const watch = (address: string, rekeyAddress?: string): WatchAccount => ({
    type: AccountTypes.watch,
    address,
    rekeyAddress,
})

describe('deriveAccountLogicalType', () => {
    it('returns Algo25 for a standard account with no rekey', () => {
        const a = algo25('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.Algo25,
        )
    })

    it('returns HdKey for an HD wallet account', () => {
        const a = hdWallet('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(AccountLogicalTypes.HdKey)
    })

    it('returns LedgerBle for any hardware account', () => {
        const a = ledger('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.LedgerBle,
        )
    })

    it('returns Multisig for multisig accounts', () => {
        const a = multisig('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.Multisig,
        )
    })

    it('returns NoAuth for a watch account with no rekey', () => {
        const a = watch('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.NoAuth,
        )
    })

    it('returns RekeyedAuth when rekey target exists and can sign', () => {
        const signer = algo25('S')
        const rekeyed = watch('A', 'S')
        expect(deriveAccountLogicalType(rekeyed, [rekeyed, signer])).toBe(
            AccountLogicalTypes.RekeyedAuth,
        )
    })

    it('returns RekeyedAuth for an Algo25 account rekeyed to a signer we hold', () => {
        const signer = algo25('S')
        const original = { ...algo25('A'), rekeyAddress: 'S' }
        expect(deriveAccountLogicalType(original, [original, signer])).toBe(
            AccountLogicalTypes.RekeyedAuth,
        )
    })

    it('returns Rekeyed when original was signable but auth is not in the wallet', () => {
        const original = { ...algo25('A'), rekeyAddress: 'S' }
        expect(deriveAccountLogicalType(original, [original])).toBe(
            AccountLogicalTypes.Rekeyed,
        )
    })

    it('returns NoAuth when original was a watch account and auth is not in the wallet', () => {
        const a = watch('A', 'S')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.NoAuth,
        )
    })

    it('returns NoAuth when auth account is in the wallet but cannot sign (watch → watch)', () => {
        const authWatch = watch('S')
        const rekeyed = watch('A', 'S')
        expect(deriveAccountLogicalType(rekeyed, [rekeyed, authWatch])).toBe(
            AccountLogicalTypes.NoAuth,
        )
    })

    it('prefers the chain-provided authAddress over the stored rekeyAddress', () => {
        const signer = algo25('S')
        const stored: WalletAccount = {
            ...algo25('A'),
            rekeyAddress: undefined,
        }
        expect(deriveAccountLogicalType(stored, [stored, signer], 'S')).toBe(
            AccountLogicalTypes.RekeyedAuth,
        )
    })

    it('treats an empty chain authAddress as "not rekeyed" regardless of stored rekeyAddress', () => {
        const stored = { ...algo25('A'), rekeyAddress: 'S' }
        expect(deriveAccountLogicalType(stored, [stored], null)).toBe(
            AccountLogicalTypes.Algo25,
        )
    })
})
```

- [ ] **Step 2: Verify test fails**

Run: `pnpm --filter @perawallet/wallet-core-accounts test -t deriveAccountLogicalType`
Expected: FAIL — module `../logical-type` not found.

- [ ] **Step 3: Implement `logical-type.ts`**

Path: `packages/accounts/src/logical-type.ts`

```typescript
/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 ...
 */

import { AccountTypes, type WalletAccount } from './models'

export const AccountLogicalTypes = {
    Algo25: 'Algo25',
    HdKey: 'HdKey',
    LedgerBle: 'LedgerBle',
    Multisig: 'Multisig',
    Rekeyed: 'Rekeyed',
    RekeyedAuth: 'RekeyedAuth',
    NoAuth: 'NoAuth',
} as const

export type AccountLogicalType =
    (typeof AccountLogicalTypes)[keyof typeof AccountLogicalTypes]

const canSignDirectly = (account: WalletAccount): boolean => !!account.keyPairId

const baseTypeFor = (account: WalletAccount): AccountLogicalType => {
    switch (account.type) {
        case AccountTypes.hdWallet:
            return AccountLogicalTypes.HdKey
        case AccountTypes.hardware:
            return AccountLogicalTypes.LedgerBle
        case AccountTypes.multisig:
            return AccountLogicalTypes.Multisig
        case AccountTypes.algo25:
            return AccountLogicalTypes.Algo25
        case AccountTypes.watch:
            return AccountLogicalTypes.NoAuth
    }
}

/**
 * Derives the logical type of `account` given the full wallet list and,
 * optionally, the current on-chain auth address for the account. When a chain
 * auth address is provided it takes precedence over `account.rekeyAddress`,
 * so a freshly-synced rekey on chain is reflected even if the stored wallet
 * record hasn't been refreshed yet.
 *
 * Classification follows the Android `GetAccountTypeUseCase` rules:
 *   1. If rekeyed and the auth account is held locally AND signable → RekeyedAuth.
 *   2. If rekeyed and the auth account is NOT signable:
 *        - original was watch → NoAuth
 *        - otherwise        → Rekeyed
 *   3. Otherwise → map from stored account type.
 */
export const deriveAccountLogicalType = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainAuthAddress?: string | null,
): AccountLogicalType => {
    const effectiveAuth =
        chainAuthAddress === undefined
            ? (account.rekeyAddress ?? null)
            : chainAuthAddress

    if (!effectiveAuth) {
        return baseTypeFor(account)
    }

    const authAccount = accounts.find(a => a.address === effectiveAuth)
    const authCanSign = authAccount
        ? canSignAccount(authAccount, accounts)
        : false

    if (authCanSign) {
        return AccountLogicalTypes.RekeyedAuth
    }

    if (account.type === AccountTypes.watch) {
        return AccountLogicalTypes.NoAuth
    }

    return AccountLogicalTypes.Rekeyed
}

const canSignAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): boolean => {
    if (canSignDirectly(account)) return true
    if (!account.rekeyAddress) return false
    const next = accounts.find(a => a.address === account.rekeyAddress)
    return next ? canSignAccount(next, accounts) : false
}

/**
 * Convenience: true when the account can sign transactions in this wallet.
 * Matches `isSigningAccount` semantics — returns false for NoAuth and
 * Rekeyed (rekeyed but we don't hold the auth keys).
 */
export const isSigningLogicalType = (type: AccountLogicalType): boolean =>
    type !== AccountLogicalTypes.NoAuth && type !== AccountLogicalTypes.Rekeyed
```

- [ ] **Step 4: Run test and verify it passes**

Run: `pnpm --filter @perawallet/wallet-core-accounts test -t deriveAccountLogicalType`
Expected: 11 tests passing.

- [ ] **Step 5: Export from the package barrel**

Edit: `packages/accounts/src/index.ts` — add the re-export after the existing `./utils` line:

```typescript
export * from './utils'
export * from './logical-type'
```

- [ ] **Step 6: Commit**

```bash
git add packages/accounts/src/logical-type.ts packages/accounts/src/__tests__/logical-type.spec.ts packages/accounts/src/index.ts
git commit -m "feat(accounts): add AccountLogicalType and pure derivation helper"
```

---

## Phase 2 — Store support: `updateAccountRekeyAddress`

### Task 2: Add store action to patch a single account's rekey address

**Files:**

- Modify: `packages/accounts/src/models/index.ts` (lines 19-29) — extend the `AccountsState` type.
- Modify: `packages/accounts/src/store/store.ts`
- Test: `packages/accounts/src/store/__tests__/store.spec.ts` (create if missing).

- [ ] **Step 1: Write a failing store test**

Path: `packages/accounts/src/store/__tests__/store.spec.ts`

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { useAccountsStore } from '../store'
import { AccountTypes } from '../../models'

describe('useAccountsStore.updateAccountRekeyAddress', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('sets rekeyAddress on the matching account', () => {
        useAccountsStore.getState().setAccounts([
            { type: AccountTypes.watch, address: 'A' },
            { type: AccountTypes.algo25, address: 'B', keyPairId: 'k' },
        ])

        useAccountsStore.getState().updateAccountRekeyAddress('A', 'B')

        const accounts = useAccountsStore.getState().accounts
        const a = accounts.find(x => x.address === 'A')!
        expect(a.rekeyAddress).toBe('B')
        expect(
            accounts.find(x => x.address === 'B')?.rekeyAddress,
        ).toBeUndefined()
    })

    it('clears rekeyAddress when passed null', () => {
        useAccountsStore.getState().setAccounts([
            {
                type: AccountTypes.algo25,
                address: 'A',
                keyPairId: 'k',
                rekeyAddress: 'B',
            },
        ])

        useAccountsStore.getState().updateAccountRekeyAddress('A', null)
        expect(
            useAccountsStore.getState().accounts[0].rekeyAddress,
        ).toBeUndefined()
    })

    it('is a no-op when the address is not in the store', () => {
        useAccountsStore
            .getState()
            .setAccounts([
                { type: AccountTypes.algo25, address: 'A', keyPairId: 'k' },
            ])
        const before = useAccountsStore.getState().accounts
        useAccountsStore.getState().updateAccountRekeyAddress('Z', 'Y')
        expect(useAccountsStore.getState().accounts).toEqual(before)
    })

    it('does not write when rekeyAddress is unchanged', () => {
        useAccountsStore.getState().setAccounts([
            {
                type: AccountTypes.algo25,
                address: 'A',
                keyPairId: 'k',
                rekeyAddress: 'B',
            },
        ])
        const before = useAccountsStore.getState().accounts
        useAccountsStore.getState().updateAccountRekeyAddress('A', 'B')
        expect(useAccountsStore.getState().accounts).toBe(before)
    })
})
```

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @perawallet/wallet-core-accounts test -t updateAccountRekeyAddress`
Expected: FAIL — `updateAccountRekeyAddress is not a function`.

- [ ] **Step 3: Extend `AccountsState`**

Edit `packages/accounts/src/models/index.ts` (lines 19-29, confirmed location). Add:

```typescript
export type AccountsState = BaseStoreState & {
    // ...existing
    updateAccountRekeyAddress: (
        address: string,
        rekeyAddress: string | null,
    ) => void
}
```

- [ ] **Step 4: Implement the action in the store**

Edit `packages/accounts/src/store/store.ts` — add inside the `create<AccountsState>` callback, next to other setters:

```typescript
updateAccountRekeyAddress: (address, rekeyAddress) => {
    const accounts = get().accounts
    const idx = accounts.findIndex(a => a.address === address)
    if (idx === -1) return

    const current = accounts[idx]
    const nextValue = rekeyAddress ?? undefined
    if (current.rekeyAddress === nextValue) return

    const next = [...accounts]
    next[idx] = { ...current, rekeyAddress: nextValue }
    set({ accounts: next })
},
```

- [ ] **Step 5: Run tests, verify pass**

Run: `pnpm --filter @perawallet/wallet-core-accounts test -t updateAccountRekeyAddress`
Expected: 4 tests passing.

- [ ] **Step 6: Bump the persist version**

Because the store shape isn't changing (we're adding an action, not new state), no migration is needed. Leave `version: 2` alone.

- [ ] **Step 7: Commit**

```bash
git add packages/accounts/src/store/ packages/accounts/src/models/
git commit -m "feat(accounts): add updateAccountRekeyAddress store action"
```

---

## Phase 3 — Sync: propagate chain authAddr into the store

### Task 3: `fetchAndPersistAccount` updates the Zustand rekeyAddress

**Files:**

- Modify: `packages/accounts/src/sync/account-syncer.ts`
- Test: `packages/accounts/src/sync/__tests__/account-syncer.spec.ts` (create if missing; otherwise extend).

- [ ] **Step 1: Write a failing test**

Path: `packages/accounts/src/sync/__tests__/account-syncer.spec.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAndPersistAccount } from '../account-syncer'
import { useAccountsStore } from '../../store'
import { AccountTypes } from '../../models'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    getAlgorandClient: () => ({
        account: {
            getInformation: vi.fn().mockResolvedValue({
                balance: { microAlgos: 0n },
                minBalance: { microAlgos: 0n },
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                status: 'Offline',
                authAddr: { toString: () => 'S' },
                assets: [],
            }),
        },
    }),
}))

vi.mock('../../db', () => ({
    upsertAccountBalance: vi.fn(),
    refreshAccountHoldings: vi.fn(),
}))

describe('fetchAndPersistAccount', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        useAccountsStore
            .getState()
            .setAccounts([{ type: AccountTypes.watch, address: 'A' }])
    })

    it('mirrors the chain authAddr into the Zustand account', async () => {
        await fetchAndPersistAccount('A', 'mainnet' as any)
        expect(
            useAccountsStore.getState().accounts.find(a => a.address === 'A')
                ?.rekeyAddress,
        ).toBe('S')
    })
})
```

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @perawallet/wallet-core-accounts test -t fetchAndPersistAccount`
Expected: FAIL — `rekeyAddress` still undefined (line not added yet).

- [ ] **Step 3: Update the syncer**

Edit `packages/accounts/src/sync/account-syncer.ts`:

```typescript
import { Decimal } from 'decimal.js'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { upsertAccountBalance, refreshAccountHoldings } from '../db'
import { useAccountsStore } from '../store'
import type { Network } from '@perawallet/wallet-core-shared'

export async function fetchAndPersistAccount(
    address: string,
    network: Network,
): Promise<void> {
    const algokit = getAlgorandClient(network)
    const info = await algokit.account.getInformation(address)

    const authAddress = info.authAddr?.toString() ?? null

    await upsertAccountBalance({
        accountAddress: address,
        network,
        algoBalance: new Decimal(info.balance.microAlgos.toString()).div(
            1_000_000,
        ),
        totalAssetsOptedIn: info.totalAssetsOptedIn ?? 0,
        totalCreatedAssets: info.totalCreatedAssets ?? 0,
        totalAppsOptedIn: info.totalAppsOptedIn ?? 0,
        minBalance: new Decimal(info.minBalance.microAlgos.toString()).div(
            1_000_000,
        ),
        status: info.status ?? 'Offline',
        authAddress,
    })

    useAccountsStore.getState().updateAccountRekeyAddress(address, authAddress)

    const holdings = (info.assets ?? []).map(a => ({
        assetId: `${a.assetId}`,
        amount: new Decimal((a.amount ?? 0n).toString()),
    }))

    await refreshAccountHoldings({
        accountAddress: address,
        holdings,
        network,
    })
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @perawallet/wallet-core-accounts test -t fetchAndPersistAccount`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/accounts/src/sync/
git commit -m "feat(accounts): propagate chain authAddr into account store on sync"
```

---

## Phase 4 — React hooks

### Task 4: `useChainAuthAddressesQuery`

**Files:**

- Create: `packages/accounts/src/hooks/useChainAuthAddressesQuery.ts`
- Test: `packages/accounts/src/hooks/__tests__/useChainAuthAddressesQuery.spec.ts`

Reuses `getAllAccountBalances` in [packages/accounts/src/db/repository.ts:326](packages/accounts/src/db/repository.ts#L326).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useChainAuthAddressesQuery } from '../useChainAuthAddressesQuery'

vi.mock('../../db', () => ({
    getAllAccountBalances: vi.fn().mockResolvedValue([
        { accountAddress: 'A', authAddress: 'S' },
        { accountAddress: 'B', authAddress: null },
    ]),
}))

describe('useChainAuthAddressesQuery', () => {
    it('returns a Map<address, authAddress | null>', async () => {
        const qc = new QueryClient()
        const { result } = renderHook(
            () =>
                useChainAuthAddressesQuery({
                    addresses: ['A', 'B'],
                    network: 'mainnet' as any,
                }),
            {
                wrapper: ({ children }) => (
                    <QueryClientProvider client={qc}>
                        {children}
                    </QueryClientProvider>
                ),
            },
        )

        await waitFor(() =>
            expect(result.current.chainAuthAddresses.get('A')).toBe('S'),
        )
        expect(result.current.chainAuthAddresses.get('B')).toBeNull()
    })
})
```

- [ ] **Step 2: Run, verify fail, then implement**

Path: `packages/accounts/src/hooks/useChainAuthAddressesQuery.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import { getAllAccountBalances } from '../db'

export const chainAuthAddressesQueryKey = (
    network: Network,
    addresses: string[],
) => ['account-chain-auth', network, [...addresses].sort()] as const

type UseChainAuthAddressesQueryParams = {
    addresses: string[]
    network: Network
    enabled?: boolean
}

type UseChainAuthAddressesQueryResult = {
    chainAuthAddresses: Map<string, string | null>
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

export const useChainAuthAddressesQuery = ({
    addresses,
    network,
    enabled = true,
}: UseChainAuthAddressesQueryParams): UseChainAuthAddressesQueryResult => {
    const query = useQuery({
        queryKey: chainAuthAddressesQueryKey(network, addresses),
        queryFn: async () => {
            const rows = await getAllAccountBalances({
                accountAddresses: addresses,
                network,
            })
            return new Map(
                rows.map(r => [r.accountAddress, r.authAddress ?? null]),
            )
        },
        enabled: enabled && addresses.length > 0,
    })

    return {
        chainAuthAddresses: query.data ?? new Map(),
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    }
}
```

- [ ] **Step 3: Verify tests pass**

Run: `pnpm --filter @perawallet/wallet-core-accounts test -t useChainAuthAddressesQuery`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/accounts/src/hooks/useChainAuthAddressesQuery.ts packages/accounts/src/hooks/__tests__/useChainAuthAddressesQuery.spec.ts
git commit -m "feat(accounts): add useChainAuthAddressesQuery hook"
```

### Task 5: `useAllAccountLogicalTypes` and `useAccountLogicalType`

**Files:**

- Create: `packages/accounts/src/hooks/useAllAccountLogicalTypes.ts`
- Create: `packages/accounts/src/hooks/useAccountLogicalType.ts`
- Test: `packages/accounts/src/hooks/__tests__/useAccountLogicalType.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAccountLogicalType } from '../useAccountLogicalType'
import { useAllAccountLogicalTypes } from '../useAllAccountLogicalTypes'
import { AccountLogicalTypes } from '../../logical-type'
import { useAccountsStore } from '../../store'
import { AccountTypes } from '../../models'

vi.mock('../useChainAuthAddressesQuery', () => ({
    useChainAuthAddressesQuery: () => ({
        chainAuthAddresses: new Map([
            ['A', 'S'],
            ['S', null],
        ]),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => 'mainnet',
}))

describe('useAccountLogicalType', () => {
    it('returns RekeyedAuth when chain auth maps to a signer in the store', () => {
        useAccountsStore.getState().setAccounts([
            { type: AccountTypes.watch, address: 'A' },
            { type: AccountTypes.algo25, address: 'S', keyPairId: 'k' },
        ])

        const { result } = renderHook(() => useAccountLogicalType('A'))
        expect(result.current).toBe(AccountLogicalTypes.RekeyedAuth)
    })

    it('returns Algo25 for a plain signer with no rekey', () => {
        useAccountsStore
            .getState()
            .setAccounts([
                { type: AccountTypes.algo25, address: 'S', keyPairId: 'k' },
            ])
        const { result } = renderHook(() => useAccountLogicalType('S'))
        expect(result.current).toBe(AccountLogicalTypes.Algo25)
    })

    it('returns null for an unknown address', () => {
        useAccountsStore.getState().setAccounts([])
        const { result } = renderHook(() => useAccountLogicalType('Z'))
        expect(result.current).toBeNull()
    })
})

describe('useAllAccountLogicalTypes', () => {
    it('returns a Map keyed by address', () => {
        useAccountsStore.getState().setAccounts([
            { type: AccountTypes.watch, address: 'A' },
            { type: AccountTypes.algo25, address: 'S', keyPairId: 'k' },
        ])
        const { result } = renderHook(() => useAllAccountLogicalTypes())
        expect(result.current.get('A')).toBe(AccountLogicalTypes.RekeyedAuth)
        expect(result.current.get('S')).toBe(AccountLogicalTypes.Algo25)
    })
})
```

- [ ] **Step 2: Implement the hooks**

Path: `packages/accounts/src/hooks/useAllAccountLogicalTypes.ts`

```typescript
import { useMemo } from 'react'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    deriveAccountLogicalType,
    type AccountLogicalType,
} from '../logical-type'
import { useAccountsStore } from '../store'
import { useChainAuthAddressesQuery } from './useChainAuthAddressesQuery'

export const useAllAccountLogicalTypes = (): Map<
    string,
    AccountLogicalType
> => {
    const accounts = useAccountsStore(state => state.accounts)
    const network = useNetwork()
    const addresses = useMemo(() => accounts.map(a => a.address), [accounts])
    const { chainAuthAddresses } = useChainAuthAddressesQuery({
        addresses,
        network,
    })

    return useMemo(() => {
        const map = new Map<string, AccountLogicalType>()
        for (const account of accounts) {
            const chainAuth = chainAuthAddresses.has(account.address)
                ? (chainAuthAddresses.get(account.address) ?? null)
                : undefined
            map.set(
                account.address,
                deriveAccountLogicalType(account, accounts, chainAuth),
            )
        }
        return map
    }, [accounts, chainAuthAddresses])
}
```

Path: `packages/accounts/src/hooks/useAccountLogicalType.ts`

```typescript
import { useAllAccountLogicalTypes } from './useAllAccountLogicalTypes'
import type { AccountLogicalType } from '../logical-type'

export const useAccountLogicalType = (
    address: string | undefined | null,
): AccountLogicalType | null => {
    const map = useAllAccountLogicalTypes()
    return address ? (map.get(address) ?? null) : null
}
```

- [ ] **Step 3: Export from the hooks barrel**

Edit `packages/accounts/src/hooks/index.ts` (or the barrel pattern used in the repo):

```typescript
export * from './useAccountLogicalType'
export * from './useAllAccountLogicalTypes'
export * from './useChainAuthAddressesQuery'
```

- [ ] **Step 4: Network hook — pre-verified**

`useNetwork` is exported from `@perawallet/wallet-core-blockchain` ([packages/blockchain/src/hooks/useNetwork.ts:21-30](packages/blockchain/src/hooks/useNetwork.ts#L21)) and is already used by `usePeraWebviewInterface.ts`. No separate `@perawallet/wallet-core-network` package exists.

- [ ] **Step 5: Run tests, commit**

```bash
pnpm --filter @perawallet/wallet-core-accounts test -t useAccountLogicalType
pnpm --filter @perawallet/wallet-core-accounts test -t useAllAccountLogicalTypes
```

Expected: PASS.

```bash
git add packages/accounts/src/hooks/
git commit -m "feat(accounts): add useAccountLogicalType + useAllAccountLogicalTypes hooks"
```

---

## Phase 5 — UI migration

**Convention for this phase:** each task updates one consumer or tightly-coupled cluster, adjusts its tests, verifies typecheck + unit tests, and commits. Because the existing `resolveAccountStatus` callers use the snake-cased names (`standard`, `rekeyedStandard`, ...), each task will translate those to the Android names. The old `resolveAccountStatus` remains exported until Phase 6 so intermediate commits compile.

### Task 6: Migrate `AccountIcon`

**Files:**

- Modify: `apps/mobile/src/modules/accounts/components/AccountIcon/AccountIcon.tsx`

- [ ] **Step 1: Rewrite the icon map keyed on `AccountLogicalType`**

Edit `apps/mobile/src/modules/accounts/components/AccountIcon/AccountIcon.tsx`:

```typescript
import { IconName, PWIcon } from '@components/core'

import { useMemo } from 'react'
import {
    AccountLogicalType,
    AccountLogicalTypes,
    useAccountLogicalType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { SvgProps } from 'react-native-svg'

const THEME_TOKEN = '__theme__'
const FALLBACK_ASSET = `accounts/${THEME_TOKEN}/unknown-account`

export type AccountIconProps = {
    account?: WalletAccount
    size?: 'sm' | 'md' | 'lg' | 'xl'
} & SvgProps

const iconNames: Record<AccountLogicalType, string> = {
    [AccountLogicalTypes.Algo25]: `accounts/${THEME_TOKEN}/algo25-account`,
    [AccountLogicalTypes.HdKey]: `accounts/${THEME_TOKEN}/hdwallet-account`,
    [AccountLogicalTypes.LedgerBle]: `accounts/${THEME_TOKEN}/ledger-account`,
    [AccountLogicalTypes.Multisig]: `accounts/${THEME_TOKEN}/multisig-account`,
    [AccountLogicalTypes.Rekeyed]: `accounts/${THEME_TOKEN}/rekeyed-standard`,
    [AccountLogicalTypes.RekeyedAuth]: `accounts/${THEME_TOKEN}/rekeyed-standard`,
    [AccountLogicalTypes.NoAuth]: `accounts/${THEME_TOKEN}/noauth-account`,
}

export const AccountIcon = (props: AccountIconProps) => {
    const { account, size = 'md', ...rest } = props
    const darkmode = useIsDarkMode()
    const logicalType = useAccountLogicalType(account?.address)

    const icon = useMemo(() => {
        if (!account || !logicalType) return <></>

        const theme = darkmode ? 'dark' : 'light'
        const icon = iconNames[logicalType] ?? FALLBACK_ASSET
        const iconName: IconName = icon.replaceAll(
            THEME_TOKEN,
            theme,
        ) as IconName
        return <PWIcon {...rest} name={iconName} size={size} />
    }, [account, logicalType, darkmode, rest, size])

    return icon
}
```

Note: the previous `rekeyed-ledger` icon variant mapped to `rekeyedHardware` is dropped — `RekeyedAuth` maps to `rekeyed-standard`. If design wants the `rekeyed-ledger` icon preserved, follow up by resolving the auth account's own logical type inside the hook to pick the variant.

- [ ] **Step 2: Update / add a component test**

Check: `apps/mobile/src/modules/accounts/components/AccountIcon/__tests__/AccountIcon.spec.tsx`. If it asserts on the old name, update expectations. Otherwise add a test that renders a `watch` account rekeyed to an in-wallet signer and asserts the rendered `IconName` is the rekeyed-standard asset.

- [ ] **Step 3: Run and commit**

```bash
pnpm --filter mobile test -t AccountIcon
git add apps/mobile/src/modules/accounts/components/AccountIcon/
git commit -m "refactor(mobile): AccountIcon uses AccountLogicalType"
```

### Task 7: Migrate `useAccountTypeInfo`

**Files:**

- Modify: `apps/mobile/src/modules/accounts/components/AccountInfoCard/AccountTypeInfoContent/useAccountTypeInfo.ts`

- [ ] **Step 1: Replace the `AccountStatus` map with a `AccountLogicalType` map**

Edit `apps/mobile/src/modules/accounts/components/AccountInfoCard/AccountTypeInfoContent/useAccountTypeInfo.ts`:

```typescript
import { useCallback, useMemo } from 'react'
import {
    AccountLogicalType,
    AccountLogicalTypes,
    isSigningLogicalType,
    useAccountLogicalType,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { IconName } from '@components/core'

export type AccountTypeAction = {
    id: string
    title: string
    icon: IconName
    onPress: () => void
}

type UseAccountTypeInfoParams = {
    account: WalletAccount
    onClose: () => void
}

type UseAccountTypeInfoResult = {
    title: string
    description: string
    actions: AccountTypeAction[]
    handleLearnMore: () => void
}

const I18N_MAP: Record<
    AccountLogicalType,
    { title: string; description: string }
> = {
    [AccountLogicalTypes.Algo25]: {
        title: 'account_type_info.standard_title',
        description: 'account_type_info.standard_description',
    },
    [AccountLogicalTypes.HdKey]: {
        title: 'account_type_info.hd_wallet_title',
        description: 'account_type_info.hd_wallet_description',
    },
    [AccountLogicalTypes.LedgerBle]: {
        title: 'account_type_info.ledger_title',
        description: 'account_type_info.ledger_description',
    },
    [AccountLogicalTypes.Multisig]: {
        title: 'account_type_info.multisig_title',
        description: 'account_type_info.multisig_description',
    },
    [AccountLogicalTypes.Rekeyed]: {
        title: 'account_type_info.rekeyed_standard_title',
        description: 'account_type_info.rekeyed_standard_description',
    },
    [AccountLogicalTypes.RekeyedAuth]: {
        title: 'account_type_info.rekeyed_standard_title',
        description: 'account_type_info.rekeyed_standard_description',
    },
    [AccountLogicalTypes.NoAuth]: {
        title: 'account_type_info.no_auth_title',
        description: 'account_type_info.no_auth_description',
    },
}

export const useAccountTypeInfo = ({
    account,
    onClose,
}: UseAccountTypeInfoParams): UseAccountTypeInfoResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { pushWebView } = useWebView()
    const accounts = useAllAccounts()
    const logicalType =
        useAccountLogicalType(account.address) ?? AccountLogicalTypes.NoAuth

    const title = t(I18N_MAP[logicalType].title)
    const description = t(I18N_MAP[logicalType].description)

    const notImplemented = useCallback(() => {
        showToast({
            title: t('common.not_implemented.title'),
            body: t('common.not_implemented.body'),
            type: 'error',
        })
        onClose()
    }, [showToast, t, onClose])

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.accountTypeSupportUrl })
    }, [pushWebView])

    const actions = useMemo(() => {
        const items: AccountTypeAction[] = []

        if (isSigningLogicalType(logicalType)) {
            items.push({
                id: 'rekey-to-ledger',
                title: t('account_type_info.rekey_to_ledger'),
                icon: 'rekey',
                onPress: notImplemented,
            })
            items.push({
                id: 'rekey-to-standard',
                title: t('account_type_info.rekey_to_standard'),
                icon: 'rekey',
                onPress: notImplemented,
            })
        }

        if (logicalType === AccountLogicalTypes.RekeyedAuth) {
            items.push({
                id: 'undo-rekey',
                title: t('account_type_info.undo_rekey'),
                icon: 'undo',
                onPress: notImplemented,
            })
        }

        if (
            logicalType === AccountLogicalTypes.Rekeyed ||
            logicalType === AccountLogicalTypes.RekeyedAuth
        ) {
            items.push({
                id: 'rescan-rekeyed',
                title: t('account_type_info.rescan_rekeyed'),
                icon: 'reload',
                onPress: notImplemented,
            })
        }

        return items
    }, [logicalType, t, notImplemented])

    return { title, description, actions, handleLearnMore }
}
```

- [ ] **Step 2: Update / add the test**

If `useAccountTypeInfo.spec.ts` exists, update its expectations to the new keys. Add tests for the two pivotal transitions: (a) watch rekeyed to an in-wallet signer yields `RekeyedAuth` → shows `undo-rekey` and `rescan-rekeyed`, (b) watch rekeyed but auth missing yields `NoAuth` → no rekey actions.

- [ ] **Step 3: Run and commit**

```bash
pnpm --filter mobile test -t useAccountTypeInfo
git add apps/mobile/src/modules/accounts/components/AccountInfoCard/AccountTypeInfoContent/
git commit -m "refactor(mobile): useAccountTypeInfo uses AccountLogicalType"
```

### Task 8: Migrate `useAccountInfoCard`

**Files:**

- Modify: `apps/mobile/src/modules/accounts/components/AccountInfoCard/useAccountInfoCard.ts`

- [ ] **Step 1: Replace the `switch (account.type)` with a logical-type switch**

Read the current file first (exploration report pointed at lines 60 and 66-81). Replace the switch:

```typescript
import {
    AccountLogicalTypes,
    isSigningLogicalType,
    useAccountLogicalType,
} from '@perawallet/wallet-core-accounts'

// inside the hook:
const logicalType =
    useAccountLogicalType(account.address) ?? AccountLogicalTypes.NoAuth
const canSign = isSigningLogicalType(logicalType)

const typeLabelKey = useMemo(() => {
    switch (logicalType) {
        case AccountLogicalTypes.HdKey:
            return 'account_info.type_universal_wallet'
        case AccountLogicalTypes.Algo25:
            return 'account_info.type_algo25'
        case AccountLogicalTypes.LedgerBle:
            return 'account_info.type_ledger'
        case AccountLogicalTypes.Multisig:
            return 'account_info.type_multisig'
        case AccountLogicalTypes.NoAuth:
            return 'account_info.type_watch'
        case AccountLogicalTypes.Rekeyed:
        case AccountLogicalTypes.RekeyedAuth:
            return 'account_info.type_rekeyed'
        default:
            return 'account_info.type_unknown'
    }
}, [logicalType])
```

The `canSign` previously derived from `isSigningAccount(account, allAccounts)` becomes `isSigningLogicalType(logicalType)`. Replace both call sites in the file.

- [ ] **Step 2: Test + commit**

```bash
pnpm --filter mobile test -t useAccountInfoCard
git add apps/mobile/src/modules/accounts/components/AccountInfoCard/useAccountInfoCard.ts
git commit -m "refactor(mobile): useAccountInfoCard uses AccountLogicalType"
```

### Task 9: Migrate `useAccountOptions`

**Files:**

- Modify: `apps/mobile/src/modules/accounts/components/AccountOptionsBottomSheet/useAccountOptions.ts`

Exploration report identified these branches:

- L247-254: `isAlgo25Account(account) || isHDWalletAccount(account)` → "View Passphrase"
- L256-263: `isRekeyedAccount(account)` → "Auth Address"
- L265-272: `isRekeyedAccount(account) && hasSigningKeys(account)` → "Undo Rekey"
- L274-288: `canSignWithAccount(account, accounts)` → "Rekey to …"

- [ ] **Step 1: Replace with logical-type checks**

```typescript
import {
    AccountLogicalTypes,
    isSigningLogicalType,
    useAccountLogicalType,
} from '@perawallet/wallet-core-accounts'

// inside the hook
const logicalType =
    useAccountLogicalType(account.address) ?? AccountLogicalTypes.NoAuth

const showPassphrase =
    logicalType === AccountLogicalTypes.Algo25 ||
    logicalType === AccountLogicalTypes.HdKey

const isRekeyed =
    logicalType === AccountLogicalTypes.Rekeyed ||
    logicalType === AccountLogicalTypes.RekeyedAuth

const showUndoRekey = logicalType === AccountLogicalTypes.RekeyedAuth

const canSign = isSigningLogicalType(logicalType)

// …then gate the options using these booleans rather than the legacy predicates
if (showPassphrase) {
    /* View Passphrase */
}
if (isRekeyed) {
    /* Auth Address */
}
if (showUndoRekey) {
    /* Undo Rekey */
}
if (canSign) {
    /* Rekey to … */
}
```

- [ ] **Step 2: Test + commit**

```bash
pnpm --filter mobile test -t useAccountOptions
git add apps/mobile/src/modules/accounts/components/AccountOptionsBottomSheet/useAccountOptions.ts
git commit -m "refactor(mobile): useAccountOptions uses AccountLogicalType"
```

### Task 10: Migrate asset/NFT action enablement

**Files:**

- Modify: `apps/mobile/src/modules/accounts/components/AccountAssetList/useAccountAssetList.ts`
- Modify: `apps/mobile/src/modules/accounts/components/AccountAssetList/AccountAssetList.tsx`
- Modify: `apps/mobile/src/modules/accounts/components/AccountOverview/useAccountOverviewHeader.ts`
- Modify: `apps/mobile/src/modules/accounts/components/AccountNfts/useAccountNfts.ts`
- Modify: `apps/mobile/src/modules/assets/components/holdings/AssetActionButtons/AssetActionButtons.tsx`
- Modify: `apps/mobile/src/modules/assets/screens/CollectibleDetailScreen/useCollectibleDetail.ts`

All of these currently derive `isWatch`/`canSign` via `isSigningAccount(account, allAccounts)` or `!isSigningAccount(...)`. Replace each with `isSigningLogicalType(logicalType)` using `useAccountLogicalType(account.address)`.

- [ ] **Step 1: For each file above, apply this rename**

Before:

```typescript
const isWatch = account ? !isSigningAccount(account, allAccounts) : true
```

After:

```typescript
const logicalType = useAccountLogicalType(account?.address)
const isWatch = !logicalType || !isSigningLogicalType(logicalType)
```

Before:

```typescript
const canOptIn = account !== null && isSigningAccount(account, allAccounts)
```

After:

```typescript
const logicalType = useAccountLogicalType(account?.address)
const canOptIn = !!logicalType && isSigningLogicalType(logicalType)
```

Leave `ManageAssetsBottomSheet`'s `isWatchAccount` prop signature unchanged — only the caller's derivation changes.

- [ ] **Step 2: Run mobile tests for each touched module**

```bash
pnpm --filter mobile test -t AccountAssetList
pnpm --filter mobile test -t AccountNfts
pnpm --filter mobile test -t AssetActionButtons
pnpm --filter mobile test -t CollectibleDetail
pnpm --filter mobile test -t useAccountOverviewHeader
```

Expected: PASS (fix assertions that referenced old predicates).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/modules/accounts/components/ apps/mobile/src/modules/assets/
git commit -m "refactor(mobile): derive isWatch/canSign from AccountLogicalType"
```

### Task 11: Migrate send-funds destination classification

**Files:**

- Modify: `apps/mobile/src/modules/transactions/screens/send-funds/SelectDestinationScreen/useSelectDestinationScreen.ts`

- [ ] **Step 1: Replace `canSignWithAccount` call**

Exploration identified the decision at lines 72-85. Replace:

```typescript
const canDestinationSign =
    localAccount && canSignWithAccount(localAccount, accounts)
```

With:

```typescript
const destinationType = useAccountLogicalType(localAccount?.address)
const canDestinationSign =
    !!destinationType && isSigningLogicalType(destinationType)
```

- [ ] **Step 2: Tests + commit**

```bash
pnpm --filter mobile test -t useSelectDestinationScreen
git add apps/mobile/src/modules/transactions/screens/send-funds/
git commit -m "refactor(mobile): send-funds destination uses AccountLogicalType"
```

### Task 12: Migrate the webview bridge

**Files:**

- Modify: `apps/mobile/src/modules/webview/hooks/utils.ts` — remove `getAccountType`.
- Modify: `apps/mobile/src/modules/webview/hooks/usePeraWebviewInterface.ts:245` — call `deriveAccountLogicalType` with the chain auth map.
- Delete: `apps/mobile/src/modules/webview/hooks/__tests__/utils.test.ts` (covered by `logical-type.spec.ts`).

- [ ] **Step 1: Rewrite `usePeraWebviewInterface` payload mapping**

Around [apps/mobile/src/modules/webview/hooks/usePeraWebviewInterface.ts:245](apps/mobile/src/modules/webview/hooks/usePeraWebviewInterface.ts#L245):

```typescript
import {
    deriveAccountLogicalType,
    useAllAccountLogicalTypes,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { getAccountDisplayName } from '@perawallet/wallet-core-accounts'

// Inside the component/hook:
const accounts = useAllAccounts()
const logicalTypes = useAllAccountLogicalTypes()

const payload = accounts.map(a => ({
    name: getAccountDisplayName(a),
    address: a.address,
    type: logicalTypes.get(a.address) ?? 'NoAuth',
}))
```

This keeps the webview payload string values identical to the old `getAccountType` output (`Algo25`, `HdKey`, …), so dApps continue working.

- [ ] **Step 2: Delete `apps/mobile/src/modules/webview/hooks/utils.ts` export `getAccountType`**

Remove the function and its imports from that file. If `utils.ts` still has other exports, keep them; otherwise delete the file and its test.

- [ ] **Step 3: Run**

```bash
pnpm --filter mobile test -t usePeraWebviewInterface
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/modules/webview/hooks/
git commit -m "refactor(mobile): webview bridge uses AccountLogicalType"
```

---

## Phase 6 — Cleanup: retire `resolveAccountStatus` and `AccountStatus`

### Task 13: Delete legacy helpers, update `isSigningAccount`

**Files:**

- Modify: `packages/accounts/src/utils.ts`
- Modify: `packages/accounts/src/index.ts` — ensure no re-export of the removed symbols.
- Search repo for any remaining imports of `AccountStatus` / `resolveAccountStatus` and fix.

- [ ] **Step 1: Grep for residual callers**

```bash
grep -rn "resolveAccountStatus\|AccountStatus[^L]" apps packages --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Rewrite `isSigningAccount`**

Edit `packages/accounts/src/utils.ts`:

```typescript
import { deriveAccountLogicalType, isSigningLogicalType } from './logical-type'

export const isSigningAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainAuthAddress?: string | null,
): boolean =>
    isSigningLogicalType(
        deriveAccountLogicalType(account, accounts, chainAuthAddress),
    )
```

Delete `resolveAccountStatus` and the `AccountStatus` export.

- [ ] **Step 3: Verify**

```bash
pnpm --filter @perawallet/wallet-core-accounts test
pnpm --filter mobile typecheck || pnpm build
```

Expected: PASS / no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/accounts/src/
git commit -m "refactor(accounts): remove legacy resolveAccountStatus + AccountStatus"
```

---

## Phase 7 — Verification

- [ ] **Type + compile**: `pnpm build` — must succeed.
- [ ] **Pre-push**: `pnpm pre-push --no-fail-on-error` — must report no new failures.
- [ ] **Unit tests**: `pnpm test` — all packages green.
- [ ] **Targeted suite**:
    - `pnpm --filter @perawallet/wallet-core-accounts test`
    - `pnpm --filter mobile test -t "Account"`
- [ ] **Manual scenarios (simulator, both light & dark)**:
    1. Import a watch address whose chain `authAddr` points to an existing **algo25 signer** in the wallet. Confirm:
        - AccountIcon shows the `rekeyed-standard` variant.
        - AccountInfoCard shows the "Rekeyed to Standard" label.
        - Account Options bottom sheet shows **Undo Rekey**, **Auth Address**, **Rekey to Ledger/Standard**.
        - Send/swap/opt-in buttons are enabled.
    2. Import a watch address whose chain `authAddr` points to an address NOT in the wallet. Confirm:
        - Icon is `noauth-account`.
        - Send/swap/opt-in buttons are disabled.
        - No Undo Rekey action.
    3. Import a watch address with no `authAddr`. Confirm: classic watch behavior (no sign, no rekey actions, `noauth-account` icon).
    4. With a rekeyed signing account already imported, trigger a rekey on chain **from a different wallet** back to the account's own address. Pull to refresh. After `fetchAndPersistAccount` runs, the AccountIcon should update from `rekeyed-standard` to `algo25-account` without restarting the app (because `updateAccountRekeyAddress` fires from the syncer).
    5. Open a dApp in the in-app webview. Trigger `getAccounts`. Inspect the payload from `usePeraWebviewInterface` — the `type` field should be `RekeyedAuth` for a rekeyed-to-local account, `Rekeyed` for rekeyed-to-unknown, etc.
- [ ] **Rollback plan**: every phase is a separate commit, so `git revert` can peel back UI migrations without touching the derivation core.
