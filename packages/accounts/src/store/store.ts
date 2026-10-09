/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
    ACCOUNT_TYPE_RANK,
    LaunchAccountModes,
    type AccountsState,
    type AccountSortMode,
    type HardwareWalletDetails,
    type LaunchAccountMode,
    type RecordedAuthorities,
    type WalletAccount,
} from '../models'
import {
    logger,
    registerStore,
    type Network,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    CHAIN_IDS,
    keyDerivations,
    scopeForLegacyNetwork,
    toScopeKey,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { kmsCore, zeroBytes } from '@perawallet/wallet-core-kms'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { accountsAdapterFor } from '../chain-adapter'
import {
    buildAccount,
    canImportRawKey,
    chainAccountOf,
    findAddressHolder,
    isKeyReferenced,
} from '../credentials'
import {
    toCurrentAccount,
    type PersistedAccountRecord,
} from '../credentials/backfill'
import { DuplicateAccountError, RawKeyImportUnsupportedError } from '../errors'
import { useAccountChainStateStore } from './accountChainState'
import { liftLegacyAuthority } from './legacyAuthority'
import {
    accountType,
    isHardwareWalletAccount,
    isSameAddress,
    isWatchAccount,
} from '../utils'

const STORE_NAME = 'accounts-store'
const STORE_VERSION = 4

type PersistedAccountsState = Pick<
    AccountsState,
    | 'accounts'
    | 'selectedAccountAddress'
    | 'sortMode'
    | 'manualAccountOrder'
    | 'launchAccountMode'
    | 'launchAccountAddress'
    | 'authorities'
    | 'unscopedAuthorities'
>

type PersistedAccountsRecordState = Omit<PersistedAccountsState, 'accounts'> & {
    accounts?: PersistedAccountRecord[]
}

// v1 persisted `provenance`/`credentials`, which `custody`/`chains` replace.
// Both are dropped, with the `custody`/`chains` they were derived into, so the
// legacy `type` decodes again.
const stripPreV2Custody = (
    account: PersistedAccountRecord,
): PersistedAccountRecord => {
    const rest: Record<string, unknown> = { ...account }
    delete rest.provenance
    delete rest.credentials
    delete rest.custody
    delete rest.chains
    return rest as PersistedAccountRecord
}

// v4 replaced the Algorand-named seed scheme with a seedless custody.
const withStandaloneCustody = (account: WalletAccount): WalletAccount => {
    const { custody } = account as { custody: { kind: string; seed?: string } }
    return custody.kind === 'local' && custody.seed === 'algo25'
        ? ({
              ...account,
              custody: { kind: 'local', seed: null },
          } as WalletAccount)
        : account
}

/**
 * Before v2 the legacy `type` and details were authoritative, so those
 * versions derive custody from them again. v3 stops persisting `type`, which
 * re-running this over migrated state leaves alone. v4 rewrites the stored
 * Algorand-named seed scheme to a seedless standalone custody.
 */
export const migrateAccountsState = (
    persistedState: unknown,
    version: number,
): PersistedAccountsState => {
    if (version >= 4) return persistedState as PersistedAccountsState
    const state = persistedState as PersistedAccountsRecordState
    const lifted = liftLegacyAuthority(state.accounts ?? [])
    return {
        ...state,
        accounts: lifted.records.map(account =>
            withStandaloneCustody(
                version < 3
                    ? toCurrentAccount(
                          version < 2 ? stripPreV2Custody(account) : account,
                      )
                    : (account as unknown as WalletAccount),
            ),
        ),
        authorities: mergeAuthorities(lifted.authorities, state.authorities),
        unscopedAuthorities: {
            ...lifted.unscopedAuthorities,
            ...state.unscopedAuthorities,
        },
    }
}

// Entries in `held` win: they were persisted alongside the records the legacy
// fields came from, so they are at least as recent.
const mergeAuthorities = (
    lifted: RecordedAuthorities,
    held: RecordedAuthorities | undefined,
): RecordedAuthorities => {
    const merged: RecordedAuthorities = { ...lifted }
    for (const [key, entries] of Object.entries(held ?? {}) as [
        keyof RecordedAuthorities,
        Record<string, string>,
    ][]) {
        merged[key] = { ...merged[key], ...entries }
    }
    return merged
}

const withoutAddress = <V>(
    entries: Record<string, V>,
    address: string,
): Record<string, V> => {
    if (!(address in entries)) return entries
    const { [address]: _removed, ...rest } = entries
    return rest
}

type ChainAddresses = Partial<Record<ChainId, string>>

const chainAddressesOf = (account: WalletAccount): ChainAddresses => {
    const addresses: ChainAddresses = {}
    for (const chainId of CHAIN_IDS) {
        const address = chainAccountOf(account, chainId)?.address
        if (address !== undefined) addresses[chainId] = address
    }
    return addresses
}

/** The first of `candidate`'s addresses that `existing` also holds on the same chain. */
const sharedChainAddress = (
    candidate: ChainAddresses,
    existing: ChainAddresses,
): string | undefined => {
    for (const chainId of CHAIN_IDS) {
        const ours = candidate[chainId]
        const theirs = existing[chainId]
        if (
            ours !== undefined &&
            theirs !== undefined &&
            isSameAddress(chainId, ours, theirs)
        ) {
            return ours
        }
    }
    return undefined
}

/**
 * Collapse accounts that hold the same address on the same chain, the
 * higher-precedence account type winning (see `ACCOUNT_TYPE_RANK`) and equal
 * ranks keeping the first occurrence. One account holding one address on two
 * chains is not a duplicate. The survivor sits at the index where it *first*
 * collided:
 * `manualAccountOrder`, `selectedAccountAddress` and the rendered list all read
 * this array, so a dedupe that reorders accounts would be a worse bug than the
 * one it fixes.
 *
 * The winner is kept wholesale — fields are deliberately NOT merged between
 * the two entries. Merging watch state into a signing account is a specific,
 * intentional operation (`upgradeWatchAccountToHardware` below); doing it
 * implicitly here would be far too subtle to reason about at a call site that
 * just wanted to write a list of accounts.
 */
const resolveDuplicateAccounts = (
    accounts: WalletAccount[],
): WalletAccount[] => {
    const resolved: WalletAccount[] = []
    const resolvedAddresses: ChainAddresses[] = []

    for (const account of accounts) {
        const addresses = chainAddressesOf(account)
        const position = resolvedAddresses.findIndex(
            existing => sharedChainAddress(addresses, existing) !== undefined,
        )
        if (position === -1) {
            resolved.push(account)
            resolvedAddresses.push(addresses)
            continue
        }
        if (
            ACCOUNT_TYPE_RANK[accountType(account)] >
            ACCOUNT_TYPE_RANK[accountType(resolved[position])]
        ) {
            resolved[position] = account
            resolvedAddresses[position] = addresses
        }
    }

    return resolved
}

/** Removes a KMS entry no account references; a failure is logged so the caller's own error is the one thrown. */
const removeUnreferencedKey = async (
    accounts: readonly WalletAccount[],
    keyPairId: string,
): Promise<void> => {
    if (isKeyReferenced(accounts, keyPairId)) return
    try {
        await getProvider().key.store.remove(keyPairId)
    } catch (error) {
        logger.warn(
            `Could not remove an unreferenced imported key: ${error instanceof Error ? error.message : 'unknown error'}`,
        )
    }
}

/** The account held by the hardware wallet, on the chain whose entry holds `address`; `undefined` when none does. */
const rebindToHardware = (
    current: WalletAccount,
    address: string,
    details: HardwareWalletDetails,
): WalletAccount | undefined => {
    for (const chainId of CHAIN_IDS) {
        const entry = chainAccountOf(current, chainId)
        if (!entry || !isSameAddress(chainId, entry.address, address)) continue
        const { accountIndex, ...device } = details
        return buildAccount({
            id: current.id,
            name: current.name,
            custody: { kind: 'hardware', device, accountIndex },
            chainId,
            chains: {
                ...current.chains,
                [chainId]: { address: entry.address },
            },
        })
    }
    return undefined
}

const initialState = {
    accounts: [] as WalletAccount[],
    selectedAccountAddress: null as Nullable<string>,
    sortMode: 'manual' as AccountSortMode,
    manualAccountOrder: [] as string[],
    launchAccountMode: LaunchAccountModes.lastUsed as LaunchAccountMode,
    launchAccountAddress: null as Nullable<string>,
    authorities: {} as RecordedAuthorities,
    unscopedAuthorities: {} as Record<string, string>,
}

export const useAccountsStore: UseBoundStore<
    WithPersist<StoreApi<AccountsState>, unknown>
> = create<AccountsState>()(
    persist(
        (set, get) => ({
            ...initialState,
            getSelectedAccount: () => {
                const { accounts, selectedAccountAddress } = get()

                if (!selectedAccountAddress) {
                    return null
                }
                return (
                    accounts.find(a => a.address === selectedAccountAddress) ??
                    null
                )
            },
            setAccounts: (accounts: WalletAccount[]) => {
                // Single chokepoint for every account write — dedupe by
                // chain address so no caller can ever persist the same account
                // twice, keeping the higher-precedence type (see
                // ACCOUNT_TYPE_RANK) rather than whichever happened to come
                // first. Callers that need to surface duplicates to the user
                // use addAccount or throw DuplicateAccountError before
                // reaching here; this is the structural safety net.
                accounts = resolveDuplicateAccounts(accounts)

                const currentSelected = get().selectedAccountAddress
                const currentManualOrder = get().manualAccountOrder
                set({ accounts })

                if (currentSelected == null && accounts.length) {
                    set({ selectedAccountAddress: accounts.at(0)?.address })
                } else if (!accounts.find(a => a.address === currentSelected)) {
                    set({
                        selectedAccountAddress: accounts.at(0)?.address ?? null,
                    })
                }

                const accountAddresses = new Set(accounts.map(a => a.address))
                const prunedOrder = currentManualOrder.filter(addr =>
                    accountAddresses.has(addr),
                )
                const newAddresses = accounts
                    .map(a => a.address)
                    .filter(addr => !prunedOrder.includes(addr))
                set({ manualAccountOrder: [...prunedOrder, ...newAddresses] })

                // A launch pin whose account is gone would leave the Launch
                // Settings screen pointing at nothing, so revert it here rather
                // than tolerating a dangling address until the next cold start.
                const { launchAccountMode, launchAccountAddress } = get()
                if (
                    launchAccountMode === LaunchAccountModes.specific &&
                    !accountAddresses.has(launchAccountAddress ?? '')
                ) {
                    set({
                        launchAccountMode: LaunchAccountModes.lastUsed,
                        launchAccountAddress: null,
                    })
                }
            },
            addAccount: (account: WalletAccount) => {
                const { accounts } = get()
                const candidate = chainAddressesOf(account)
                for (const existing of accounts) {
                    const shared = sharedChainAddress(
                        candidate,
                        chainAddressesOf(existing),
                    )
                    if (shared !== undefined) {
                        throw new DuplicateAccountError(shared, existing)
                    }
                }
                get().setAccounts([...accounts, account])
            },
            importAccountFromPrivateKey: async (
                chainId: ChainId,
                privateKey: Uint8Array,
                name?: string,
            ) => {
                try {
                    const scheme = canImportRawKey(chainId)
                        ? getProvider().chains.get(chainId).descriptor.signing
                              .rawKeySchemes[0]
                        : undefined
                    if (!scheme) throw new RawKeyImportUnsupportedError(chainId)
                    const networkId = selectChainNetworkId(
                        useNetworkStore.getState(),
                        chainId,
                    )
                    const { keyPairId, address } = await keyDerivations
                        .get(chainId)
                        .importRawKey(kmsCore, privateKey, {
                            scheme,
                            networkId,
                        })
                    try {
                        const holder = findAddressHolder(
                            get().accounts,
                            { chainId, networkId },
                            address,
                        )
                        if (holder)
                            throw new DuplicateAccountError(address, holder)
                        const account = buildAccount({
                            name,
                            custody: { kind: 'local', seed: null },
                            chainId,
                            chains: { [chainId]: { address, keyPairId } },
                        })
                        get().addAccount(account)
                        return account
                    } catch (error) {
                        await removeUnreferencedKey(get().accounts, keyPairId)
                        throw error
                    }
                } finally {
                    zeroBytes(privateKey)
                }
            },
            setSelectedAccountAddress: (address: Nullable<string>) => {
                const accounts = get().accounts
                if (address && !accounts.find(a => a.address === address)) {
                    logger.warn(
                        `Attempted to set selected account address to ${address}, but it does not exist in accounts list.`,
                    )
                    return
                }
                set({ selectedAccountAddress: address })
            },
            setSortMode: (mode: AccountSortMode) => {
                set({ sortMode: mode })
            },
            setLaunchAccountPreference: (
                mode: LaunchAccountMode,
                address?: Nullable<string>,
            ) => {
                if (mode === LaunchAccountModes.lastUsed) {
                    set({
                        launchAccountMode: mode,
                        launchAccountAddress: null,
                    })
                    return
                }

                const accounts = get().accounts
                if (!address || !accounts.find(a => a.address === address)) {
                    logger.warn(
                        `Attempted to pin launch account ${address}, but it does not exist in accounts list.`,
                    )
                    return
                }
                set({ launchAccountMode: mode, launchAccountAddress: address })
            },
            applyLaunchAccountPreference: () => {
                const { launchAccountMode, launchAccountAddress, accounts } =
                    get()
                if (launchAccountMode !== LaunchAccountModes.specific) return
                if (!accounts.find(a => a.address === launchAccountAddress))
                    return
                set({ selectedAccountAddress: launchAccountAddress })
            },
            setManualAccountOrder: (order: string[]) => {
                set({ manualAccountOrder: order })
            },
            addRekeyedWatchAccounts: (
                sourceAddress: string,
                addresses: string[],
                network: Network,
            ) => {
                if (addresses.length === 0) return 0

                const current = get().accounts
                const currentAddresses = new Set(current.map(a => a.address))
                const adapter = accountsAdapterFor(network)
                const { chainId } = adapter
                const watchAccounts = addresses
                    .filter(addr => !currentAddresses.has(addr))
                    .map(address =>
                        buildAccount({
                            custody: { kind: 'watch' },
                            chainId,
                            chains: { [chainId]: { address } },
                        }),
                    )

                if (watchAccounts.length === 0) return 0

                const scope = scopeForLegacyNetwork(network)
                const recorded = Object.fromEntries(
                    watchAccounts.map(({ address }) => [
                        address,
                        sourceAddress,
                    ]),
                )
                useAccountChainStateStore.getState().fillAccountChainStates({
                    [toScopeKey(scope)]: Object.fromEntries(
                        watchAccounts.map(({ address }) => [
                            address,
                            adapter.toChainState({
                                authorityAddress: sourceAddress,
                            }),
                        ]),
                    ),
                })

                get().setAccounts([...current, ...watchAccounts])
                get().recordAuthorities({ [toScopeKey(scope)]: recorded })
                return watchAccounts.length
            },
            recordAuthorities: (incoming: RecordedAuthorities) => {
                set({
                    authorities: mergeAuthorities(get().authorities, incoming),
                })
            },
            settleAuthorities: (authorities: RecordedAuthorities) => {
                set({ authorities, unscopedAuthorities: {} })
            },
            forgetAuthorities: (address: string) => {
                const { authorities, unscopedAuthorities } = get()
                const next: RecordedAuthorities = {}
                for (const [key, entries] of Object.entries(authorities) as [
                    keyof RecordedAuthorities,
                    Record<string, string>,
                ][]) {
                    const kept = withoutAddress(entries, address)
                    if (Object.keys(kept).length > 0) next[key] = kept
                }
                set({
                    authorities: next,
                    unscopedAuthorities: withoutAddress(
                        unscopedAuthorities,
                        address,
                    ),
                })
            },
            upgradeWatchAccountToHardware: (
                address: string,
                hardwareDetails: HardwareWalletDetails,
            ) => {
                const accounts = get().accounts
                const idx = accounts.findIndex(a => a.address === address)
                if (idx === -1) return false
                const current = accounts[idx]
                if (!isWatchAccount(current)) return false

                const upgraded = rebindToHardware(
                    current,
                    address,
                    hardwareDetails,
                )
                if (!upgraded) return false
                const next = [...accounts]
                next[idx] = upgraded
                set({ accounts: next })
                return true
            },
            updateHardwareDetails: (
                address: string,
                hardwareDetails: HardwareWalletDetails,
            ) => {
                const accounts = get().accounts
                const idx = accounts.findIndex(a => a.address === address)
                if (idx === -1) return false
                const current = accounts[idx]
                if (!isHardwareWalletAccount(current)) return false

                // Structural compare over the union of keys (all scalar) so a
                // future HardwareWalletDetails field can't silently skip a
                // re-bind by being omitted from a hand-listed equality check.
                const currentDetails = current.hardwareDetails
                const keys = new Set<keyof HardwareWalletDetails>([
                    ...(Object.keys(
                        currentDetails,
                    ) as (keyof HardwareWalletDetails)[]),
                    ...(Object.keys(
                        hardwareDetails,
                    ) as (keyof HardwareWalletDetails)[]),
                ])
                const unchanged = [...keys].every(
                    key => currentDetails[key] === hardwareDetails[key],
                )
                if (unchanged) return false

                const rebound = rebindToHardware(
                    current,
                    address,
                    hardwareDetails,
                )
                if (!rebound) return false
                const next = [...accounts]
                next[idx] = rebound
                set({ accounts: next })
                return true
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: STORE_VERSION,
            migrate: migrateAccountsState,
            // The persisted accounts of a v3 payload may still carry the
            // authority fields, which migrate never sees.
            merge: (persisted, current) => {
                if (!persisted) return current
                const state = persisted as Partial<PersistedAccountsState>
                const lifted = liftLegacyAuthority(
                    state.accounts ?? current.accounts,
                )
                return {
                    ...current,
                    ...state,
                    accounts: lifted.records,
                    authorities: mergeAuthorities(
                        lifted.authorities,
                        state.authorities,
                    ),
                    unscopedAuthorities: {
                        ...lifted.unscopedAuthorities,
                        ...state.unscopedAuthorities,
                    },
                }
            },
            partialize: (state): PersistedAccountsState => ({
                accounts: state.accounts,
                selectedAccountAddress: state.selectedAccountAddress,
                sortMode: state.sortMode,
                manualAccountOrder: state.manualAccountOrder,
                launchAccountMode: state.launchAccountMode,
                launchAccountAddress: state.launchAccountAddress,
                authorities: state.authorities,
                unscopedAuthorities: state.unscopedAuthorities,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useAccountsStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useAccountsStore.getState().resetState(),
})
