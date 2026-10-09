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
    type AccountChains,
    type AccountCustody,
    type AccountsState,
    type AccountSortMode,
    type HardwareWalletDetails,
    type LaunchAccountMode,
    type RecordedAuthorities,
    type WalletAccount,
} from '../models'
import {
    generateOrderedUniqueId,
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
import {
    accountsChainAdapters,
    type DecodedAccountRecord,
} from '../chain-adapter'
import {
    buildAccount,
    canDerive,
    canImportRawKey,
    chainAccountOf,
    findAddressHolder,
    findPathHolder,
    isKeyReferenced,
    seedMintableScheme,
} from '../credentials'
import {
    DuplicateAccountError,
    RawKeyImportUnsupportedError,
    WalletCannotDeriveError,
} from '../errors'
import { useAccountChainStateStore } from './accountChainState'
import { liftLegacyAuthority } from './legacyAuthority'
import {
    isHardwareWalletAccount,
    isSameAddress,
    isWatchAccount,
} from '../utils'

const STORE_NAME = 'accounts-store'
// Bumping this, or changing `migrateAccountsState`, adds the payload the
// outgoing version wrote to conformance/src/suites/store-migration/fixtures.ts.
const STORE_VERSION = 5

type PersistedAccountsState = Pick<
    AccountsState,
    | 'accounts'
    | 'selectedAccountId'
    | 'sortMode'
    | 'manualAccountOrder'
    | 'launchAccountMode'
    | 'launchAccountId'
    | 'authorities'
    | 'unscopedAuthorities'
>

type PersistedRecord = Record<string, unknown> & {
    id?: unknown
    address?: string
}

/** State as v0-v4 persisted it: records carried the legacy fields, and selection was keyed by address. */
type LegacyPersistedState = Partial<
    Omit<PersistedAccountsState, 'accounts'>
> & {
    accounts?: PersistedRecord[]
    selectedAccountAddress?: Nullable<string>
    launchAccountAddress?: Nullable<string>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

/** A record already held only as custody and chain entries, as one for a chain with no accounts adapter can be. */
const currentShapeOf = (
    raw: PersistedRecord,
): DecodedAccountRecord | undefined =>
    isObject(raw.custody) &&
    typeof raw.custody.kind === 'string' &&
    isObject(raw.chains) &&
    Object.keys(raw.chains).length > 0
        ? {
              custody: raw.custody as AccountCustody,
              chains: raw.chains as AccountChains,
          }
        : undefined

type IdentifiedRecord = PersistedRecord & { id: string }

// No migration ever wrote ids, so a record persisted without one gets a fresh
// id rather than losing the account.
const withId = (raw: PersistedRecord): IdentifiedRecord =>
    typeof raw.id === 'string' && raw.id !== ''
        ? (raw as IdentifiedRecord)
        : { ...raw, id: generateOrderedUniqueId() }

const decodeRecord = (raw: IdentifiedRecord): WalletAccount | undefined => {
    const decoded =
        CHAIN_IDS.flatMap(chainId =>
            accountsChainAdapters.has(chainId)
                ? (accountsChainAdapters.get(chainId).decodeLegacyRecord(raw) ??
                  [])
                : [],
        )[0] ?? currentShapeOf(raw)
    if (!decoded) return undefined
    return {
        id: raw.id,
        ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
        ...decoded,
    }
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
    raws: readonly IdentifiedRecord[],
    accounts: readonly WalletAccount[],
): Nullable<string> => {
    if (!address) return null
    const id = raws.find(record => record.address === address)?.id
    return id && accounts.some(account => account.id === id) ? id : null
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

/**
 * Every record decodes through the registered chain adapters, so this runs
 * only after they register (`rehydrateAccountsStore`). The authority fields
 * records carried before v4 move into the authority maps first; then each
 * record keeps only its custody and chain entries, and a record no chain
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
    const lifted = liftLegacyAuthority(
        (state.accounts ?? []).map(raw =>
            version < 2 ? stripPreV2Custody(raw) : raw,
        ),
    )
    const raws = lifted.records.map(withId)
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
        authorities: mergeAuthorities(lifted.authorities, state.authorities),
        unscopedAuthorities: {
            ...lifted.unscopedAuthorities,
            ...state.unscopedAuthorities,
        },
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

/** The account rebound to the hardware wallet, keeping its id, name and chain entries. */
const rebindToHardware = (
    current: WalletAccount,
    details: HardwareWalletDetails,
): WalletAccount | undefined => {
    const chainId = CHAIN_IDS.find(id => chainAccountOf(current, id))
    if (!chainId) return undefined
    const { accountIndex, ...device } = details
    return buildAccount({
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
    })
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
            addChainAccount: async (walletId, chainId, index, name) => {
                const scheme = seedMintableScheme(chainId)
                if (
                    scheme === undefined ||
                    !canDerive(get().accounts, walletId, chainId)
                ) {
                    throw new WalletCannotDeriveError(walletId, chainId)
                }
                const networkId = selectChainNetworkId(
                    useNetworkStore.getState(),
                    chainId,
                )
                const { address, keyPairId } = await keyDerivations
                    .get(chainId)
                    .deriveAccount(
                        kmsCore,
                        walletId,
                        index.account,
                        index.keyIndex,
                        { scheme, networkId },
                    )

                // Read after the derivation: the store can change across the await.
                const { accounts } = get()
                const addressHolder = findAddressHolder(
                    accounts,
                    { chainId, networkId },
                    address,
                )
                if (addressHolder) {
                    throw new DuplicateAccountError(address, addressHolder)
                }

                const entry = { address, keyPairId }
                const holder = findPathHolder(accounts, walletId, index)
                if (!holder) {
                    const account = buildAccount({
                        name,
                        custody: {
                            kind: 'local',
                            seed: 'bip39',
                            hd: {
                                account: index.account,
                                keyIndex: index.keyIndex,
                            },
                        },
                        chainId,
                        chains: { [chainId]: entry },
                    })
                    get().addAccount(account)
                    return account
                }
                const existing = chainAccountOf(holder, chainId)
                if (existing) {
                    throw new DuplicateAccountError(existing.address, holder)
                }
                const updated = {
                    ...holder,
                    chains: { ...holder.chains, [chainId]: entry },
                }
                get().setAccounts(
                    accounts.map(a => (a.id === holder.id ? updated : a)),
                )
                return updated
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
            addRekeyedWatchAccounts: (
                sourceAddress: string,
                addresses: string[],
                network: Network,
            ) => {
                if (addresses.length === 0) return 0

                const current = get().accounts
                const scope = scopeForLegacyNetwork(network)
                const { chainId } = scope
                const newAddresses = addresses.filter(
                    address =>
                        indexOfAddressOnNetwork(current, address, network) ===
                        -1,
                )
                if (newAddresses.length === 0) return 0

                const watchAccounts = newAddresses.map(address =>
                    buildAccount({
                        custody: { kind: 'watch' },
                        chainId,
                        chains: { [chainId]: { address } },
                    }),
                )
                const adapter = accountsChainAdapters.get(chainId)
                const key = toScopeKey(scope)
                useAccountChainStateStore.getState().fillAccountChainStates({
                    [key]: Object.fromEntries(
                        newAddresses.map(address => [
                            address,
                            adapter.toChainState({
                                authorityAddress: sourceAddress,
                            }),
                        ]),
                    ),
                })

                get().setAccounts([...current, ...watchAccounts])
                get().recordAuthorities({
                    [key]: Object.fromEntries(
                        newAddresses.map(address => [address, sourceAddress]),
                    ),
                })
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
                authorities: state.authorities,
                unscopedAuthorities: state.unscopedAuthorities,
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
