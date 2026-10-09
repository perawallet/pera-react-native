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
    LaunchAccountModes,
    type AccountsState,
    type AccountSortMode,
    type HardwareWalletDetails,
    type LaunchAccountMode,
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
    scopeForLegacyNetwork,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { accountsChainAdapters } from '../chain-adapter'
import { buildAccount, chainAccountOf } from '../credentials'
import { DuplicateAccountError } from '../errors'
import {
    isHardwareWalletAccount,
    isSameAddress,
    isWatchAccount,
} from '../utils'

const STORE_NAME = 'accounts-store'
const STORE_VERSION = 4

type PersistedAccountsState = Pick<
    AccountsState,
    | 'accounts'
    | 'selectedAccountId'
    | 'sortMode'
    | 'manualAccountOrder'
    | 'launchAccountMode'
    | 'launchAccountId'
>

type PersistedRecord = Record<string, unknown> & { id?: unknown }

/** State as v0-v3 persisted it: records carried the legacy fields, and selection was keyed by address. */
type LegacyPersistedState = Partial<
    Omit<PersistedAccountsState, 'accounts'>
> & {
    accounts?: PersistedRecord[]
    selectedAccountAddress?: Nullable<string>
    launchAccountAddress?: Nullable<string>
}

const decodeRecord = (raw: PersistedRecord): WalletAccount | undefined => {
    if (typeof raw.id !== 'string') return undefined
    for (const chainId of CHAIN_IDS) {
        if (!accountsChainAdapters.has(chainId)) continue
        const decoded = accountsChainAdapters
            .get(chainId)
            .decodeLegacyRecord(raw)
        if (!decoded) continue
        return {
            id: raw.id,
            ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
            ...(typeof raw.rekeyAddress === 'string'
                ? { rekeyAddress: raw.rekeyAddress }
                : {}),
            ...(raw.rekeyAddressByNetwork !== undefined
                ? {
                      rekeyAddressByNetwork:
                          raw.rekeyAddressByNetwork as WalletAccount['rekeyAddressByNetwork'],
                  }
                : {}),
            ...decoded,
        }
    }
    return undefined
}

// Before v2 the legacy `type` and details were authoritative, and v1's
// `provenance`/`credentials` were derived from them, so all of it is dropped
// and the legacy fields decode again.
const stripPreV2Custody = (raw: PersistedRecord): PersistedRecord => {
    const rest = { ...raw }
    delete rest.provenance
    delete rest.credentials
    delete rest.custody
    delete rest.chains
    return rest
}

/** The id of the account that held `address` before the migration; `null` when none did. */
const idForLegacyAddress = (
    address: Nullable<string> | undefined,
    raws: readonly PersistedRecord[],
    accounts: readonly WalletAccount[],
): Nullable<string> => {
    if (!address) return null
    const raw = raws.find(record => record.address === address)
    const id = typeof raw?.id === 'string' ? raw.id : undefined
    return id && accounts.some(account => account.id === id) ? id : null
}

/**
 * Every record decodes through the registered chain adapters, so this runs
 * only after they register (`rehydrateAccountsStore`). A record no chain
 * decodes is dropped. Selection moves from addresses to account ids.
 */
export const migrateAccountsState = (
    persistedState: unknown,
    version: number,
): PersistedAccountsState => {
    if (version >= STORE_VERSION) {
        return persistedState as PersistedAccountsState
    }
    const state = (persistedState ?? {}) as LegacyPersistedState
    const raws = (state.accounts ?? []).map(raw =>
        version < 2 ? stripPreV2Custody(raw) : raw,
    )
    const accounts = raws.flatMap(raw => decodeRecord(raw) ?? [])
    const idOf = (address: Nullable<string> | undefined) =>
        idForLegacyAddress(address, raws, accounts)
    const launchAccountId = idOf(state.launchAccountAddress)
    return {
        accounts,
        selectedAccountId: idOf(state.selectedAccountAddress),
        sortMode: state.sortMode ?? 'manual',
        manualAccountOrder: (state.manualAccountOrder ?? []).flatMap(
            address => idOf(address) ?? [],
        ),
        launchAccountMode: launchAccountId
            ? (state.launchAccountMode ?? LaunchAccountModes.lastUsed)
            : LaunchAccountModes.lastUsed,
        launchAccountId,
    }
}

type ChainAddress = { chainId: ChainId; address: string }

const chainAddressesOf = (account: WalletAccount): ChainAddress[] =>
    CHAIN_IDS.flatMap(chainId => {
        const address = chainAccountOf(account, chainId)?.address
        return address === undefined ? [] : [{ chainId, address }]
    })

/** The first of `candidate`'s addresses that `existing` also holds on the same chain. */
const sharedChainAddress = (
    candidate: readonly ChainAddress[],
    existing: readonly ChainAddress[],
): ChainAddress | undefined => {
    const existingByChain = new Map(
        existing.map(({ chainId, address }) => [chainId, address]),
    )
    return candidate.find(({ chainId, address }) => {
        const theirs = existingByChain.get(chainId)
        return theirs !== undefined && isSameAddress(chainId, address, theirs)
    })
}

const duplicateRankOn = (chainId: ChainId, account: WalletAccount): number =>
    accountsChainAdapters.has(chainId)
        ? accountsChainAdapters.get(chainId).duplicateRank(account)
        : 0

/**
 * Collapse accounts that hold the same address on the same chain, the
 * account that chain ranks higher winning (`duplicateRank`) and equal ranks
 * keeping the first occurrence. One account holding one address on two
 * chains is not a duplicate. The survivor sits at the index where it *first*
 * collided:
 * `manualAccountOrder`, `selectedAccountId` and the rendered list all read
 * this array, so a dedupe that reorders accounts would be a worse bug than the
 * one it fixes.
 *
 * The winner is kept wholesale — fields are deliberately NOT merged between
 * the two entries. Merging watch state into a signing account is a specific,
 * intentional operation (`upgradeWatchAccountToHardware` below); doing it
 * implicitly here would be far too subtle to reason about at a call site that
 * just wanted to write a list of accounts.
 *
 * What that surrenders: when a watch entry loses, its `rekeyAddress` and
 * `rekeyAddressByNetwork` are discarded with it. That is safe — both are
 * mirrors re-derived from the next sync tick and network switch — and the one
 * flow that must preserve them (watch → hardware on Ledger verify) routes
 * around this function through `upgradeWatchAccountToHardware`, which merges
 * them onto the upgraded account explicitly.
 */
const resolveDuplicateAccounts = (
    accounts: WalletAccount[],
): WalletAccount[] => {
    const resolved: WalletAccount[] = []
    const resolvedAddresses: ChainAddress[][] = []

    for (const account of accounts) {
        const addresses = chainAddressesOf(account)
        let position = -1
        let shared: ChainAddress | undefined
        for (const [index, existing] of resolvedAddresses.entries()) {
            shared = sharedChainAddress(addresses, existing)
            if (shared) {
                position = index
                break
            }
        }
        if (position === -1 || !shared) {
            resolved.push(account)
            resolvedAddresses.push(addresses)
            continue
        }
        if (
            duplicateRankOn(shared.chainId, account) >
            duplicateRankOn(shared.chainId, resolved[position])
        ) {
            resolved[position] = account
            resolvedAddresses[position] = addresses
        }
    }

    return resolved
}

/** The account rebound to the hardware wallet, keeping its id, name, chain entries and rekey state. */
const rebindToHardware = (
    current: WalletAccount,
    details: HardwareWalletDetails,
): WalletAccount | undefined => {
    const chainId = CHAIN_IDS.find(id => chainAccountOf(current, id))
    if (!chainId) return undefined
    const { accountIndex, ...device } = details
    return {
        ...buildAccount({
            id: current.id,
            name: current.name,
            custody: { kind: 'hardware', device, accountIndex },
            chainId,
            chains: Object.fromEntries(
                Object.entries(current.chains).map(([id, entry]) => [
                    id,
                    entry ? { address: entry.address } : entry,
                ]),
            ),
        }),
        ...(current.rekeyAddress !== undefined
            ? { rekeyAddress: current.rekeyAddress }
            : {}),
        ...(current.rekeyAddressByNetwork !== undefined
            ? { rekeyAddressByNetwork: current.rekeyAddressByNetwork }
            : {}),
    }
}

// Structural over the union of keys (all scalar) so a future device field
// can't silently skip a re-bind by being left out of a hand-listed check.
const sameDevice = (
    a: Record<string, unknown>,
    b: Record<string, unknown>,
): boolean =>
    [...new Set([...Object.keys(a), ...Object.keys(b)])].every(
        key => a[key] === b[key],
    )

/** The account holding `address` on the chain `network` belongs to. */
const indexOfAddressOnNetwork = (
    accounts: readonly WalletAccount[],
    address: string,
    network: Network,
): number => {
    const { chainId } = scopeForLegacyNetwork(network)
    return accounts.findIndex(account => {
        const held = chainAccountOf(account, chainId)?.address
        return held !== undefined && isSameAddress(chainId, held, address)
    })
}

const initialState = {
    accounts: [] as WalletAccount[],
    selectedAccountId: null as Nullable<string>,
    sortMode: 'manual' as AccountSortMode,
    manualAccountOrder: [] as string[],
    launchAccountMode: LaunchAccountModes.lastUsed as LaunchAccountMode,
    launchAccountId: null as Nullable<string>,
    // Session-only (not persisted): null until the first network switch is
    // applied; while null, rekey writes treat their own network as active —
    // syncs only ever run on the active network, so this matches reality.
    activeRekeyNetwork: null as Nullable<Network>,
}

export const useAccountsStore: UseBoundStore<
    WithPersist<StoreApi<AccountsState>, unknown>
> = create<AccountsState>()(
    persist(
        (set, get) => ({
            ...initialState,
            getSelectedAccount: () => {
                const { accounts, selectedAccountId } = get()

                if (!selectedAccountId) {
                    return null
                }
                return accounts.find(a => a.id === selectedAccountId) ?? null
            },
            setAccounts: (accounts: WalletAccount[]) => {
                // Single chokepoint for every account write — dedupe by
                // chain address so no caller can ever persist the same account
                // twice, keeping the account its chain ranks higher
                // (`duplicateRank`) rather than whichever happened to come
                // first. Callers that need to surface duplicates to the user
                // use addAccount or throw DuplicateAccountError before
                // reaching here; this is the structural safety net.
                accounts = resolveDuplicateAccounts(accounts)

                const currentSelected = get().selectedAccountId
                const currentManualOrder = get().manualAccountOrder
                set({ accounts })

                const accountIds = new Set(accounts.map(a => a.id))
                if (currentSelected == null && accounts.length) {
                    set({ selectedAccountId: accounts.at(0)?.id })
                } else if (!accountIds.has(currentSelected ?? '')) {
                    set({ selectedAccountId: accounts.at(0)?.id ?? null })
                }

                const prunedOrder = currentManualOrder.filter(id =>
                    accountIds.has(id),
                )
                const newIds = accounts
                    .map(a => a.id)
                    .filter(id => !prunedOrder.includes(id))
                set({ manualAccountOrder: [...prunedOrder, ...newIds] })

                // A launch pin whose account is gone would leave the Launch
                // Settings screen pointing at nothing, so revert it here rather
                // than tolerating a dangling id until the next cold start.
                const { launchAccountMode, launchAccountId } = get()
                if (
                    launchAccountMode === LaunchAccountModes.specific &&
                    !accountIds.has(launchAccountId ?? '')
                ) {
                    set({
                        launchAccountMode: LaunchAccountModes.lastUsed,
                        launchAccountId: null,
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
                        throw new DuplicateAccountError(
                            shared.address,
                            existing,
                        )
                    }
                }
                get().setAccounts([...accounts, account])
            },
            setSelectedAccountId: (id: Nullable<string>) => {
                const accounts = get().accounts
                if (id && !accounts.some(a => a.id === id)) {
                    logger.warn(
                        `Attempted to select account ${id}, but it does not exist in accounts list.`,
                    )
                    return
                }
                set({ selectedAccountId: id })
            },
            setSortMode: (mode: AccountSortMode) => {
                set({ sortMode: mode })
            },
            setLaunchAccountPreference: (
                mode: LaunchAccountMode,
                id?: Nullable<string>,
            ) => {
                if (mode === LaunchAccountModes.lastUsed) {
                    set({
                        launchAccountMode: mode,
                        launchAccountId: null,
                    })
                    return
                }

                const accounts = get().accounts
                if (!id || !accounts.some(a => a.id === id)) {
                    logger.warn(
                        `Attempted to pin launch account ${id}, but it does not exist in accounts list.`,
                    )
                    return
                }
                set({ launchAccountMode: mode, launchAccountId: id })
            },
            applyLaunchAccountPreference: () => {
                const { launchAccountMode, launchAccountId, accounts } = get()
                if (launchAccountMode !== LaunchAccountModes.specific) return
                if (!accounts.some(a => a.id === launchAccountId)) return
                set({ selectedAccountId: launchAccountId })
            },
            setManualAccountOrder: (order: string[]) => {
                set({ manualAccountOrder: order })
            },
            updateAccountRekeyAddress: (
                address: string,
                rekeyAddress: string | null,
                network: Network,
            ) => {
                const accounts = get().accounts
                const idx = indexOfAddressOnNetwork(accounts, address, network)
                if (idx === -1) return

                const current = accounts[idx]
                const nextValue = rekeyAddress ?? undefined
                const activeNetwork = get().activeRekeyNetwork
                const isActiveNetwork =
                    activeNetwork === null || activeNetwork === network
                const mapUnchanged =
                    current.rekeyAddressByNetwork !== undefined &&
                    current.rekeyAddressByNetwork[network] === nextValue
                const mirrorUnchanged =
                    !isActiveNetwork || current.rekeyAddress === nextValue
                if (mapUnchanged && mirrorUnchanged) return

                const nextMap = { ...current.rekeyAddressByNetwork }
                if (nextValue === undefined) {
                    // Key removed but the map kept: an (even empty) map
                    // records "per-network state is known", which gates the
                    // legacy-scalar fallback in applyNetworkRekeyState.
                    delete nextMap[network]
                } else {
                    nextMap[network] = nextValue
                }

                const next = [...accounts]
                next[idx] = {
                    ...current,
                    rekeyAddressByNetwork: nextMap,
                    ...(isActiveNetwork ? { rekeyAddress: nextValue } : {}),
                }
                set({ accounts: next })
            },
            applyNetworkRekeyState: (network: Network) => {
                const accounts = get().accounts
                let changed = false
                const next = accounts.map(account => {
                    // Legacy account (persisted before per-network state):
                    // keep the mirror until a sync tick writes the map.
                    if (account.rekeyAddressByNetwork === undefined) {
                        return account
                    }
                    const target = account.rekeyAddressByNetwork[network]
                    if (account.rekeyAddress === target) return account
                    changed = true
                    return { ...account, rekeyAddress: target }
                })
                set({
                    activeRekeyNetwork: network,
                    ...(changed ? { accounts: next } : {}),
                })
            },
            addRekeyedWatchAccounts: (
                sourceAddress: string,
                addresses: string[],
                network: Network,
            ) => {
                if (addresses.length === 0) return 0

                const current = get().accounts
                const activeNetwork = get().activeRekeyNetwork
                const isActiveNetwork =
                    activeNetwork === null || activeNetwork === network
                const { chainId } = scopeForLegacyNetwork(network)
                const watchAccounts = addresses
                    .filter(
                        address =>
                            indexOfAddressOnNetwork(
                                current,
                                address,
                                network,
                            ) === -1,
                    )
                    .map((address): WalletAccount => ({
                        ...buildAccount({
                            custody: { kind: 'watch' },
                            chainId,
                            chains: { [chainId]: { address } },
                        }),
                        ...(isActiveNetwork
                            ? { rekeyAddress: sourceAddress }
                            : {}),
                        rekeyAddressByNetwork: { [network]: sourceAddress },
                    }))

                if (watchAccounts.length === 0) return 0

                get().setAccounts([...current, ...watchAccounts])
                return watchAccounts.length
            },
            upgradeWatchAccountToHardware: (
                id: string,
                hardwareDetails: HardwareWalletDetails,
            ) => {
                const accounts = get().accounts
                const idx = accounts.findIndex(a => a.id === id)
                if (idx === -1) return false
                const current = accounts[idx]
                if (!isWatchAccount(current)) return false

                const upgraded = rebindToHardware(current, hardwareDetails)
                if (!upgraded) return false
                const next = [...accounts]
                next[idx] = upgraded
                set({ accounts: next })
                return true
            },
            updateHardwareDetails: (
                id: string,
                hardwareDetails: HardwareWalletDetails,
            ) => {
                const accounts = get().accounts
                const idx = accounts.findIndex(a => a.id === id)
                if (idx === -1) return false
                const current = accounts[idx]
                if (!isHardwareWalletAccount(current)) return false

                const { accountIndex, ...device } = hardwareDetails
                const unchanged =
                    current.custody.accountIndex === accountIndex &&
                    sameDevice(current.custody.device, device)
                if (unchanged) return false

                const rebound = rebindToHardware(current, hardwareDetails)
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
            // `migrate` decodes records through the chain adapters, which
            // register after every module has evaluated: hydrating at import
            // would run it against an empty registry.
            skipHydration: true,
            migrate: migrateAccountsState,
            partialize: (state): PersistedAccountsState => ({
                accounts: state.accounts,
                selectedAccountId: state.selectedAccountId,
                sortMode: state.sortMode,
                manualAccountOrder: state.manualAccountOrder,
                launchAccountMode: state.launchAccountMode,
                launchAccountId: state.launchAccountId,
            }),
        },
    ),
)

/** Called once the chain adapters are registered; until then the store holds its defaults. */
export const rehydrateAccountsStore = async (): Promise<void> => {
    await useAccountsStore.persist.rehydrate()
}

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
