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
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import {
    ACCOUNT_TYPE_RANK,
    AccountTypes,
    LaunchAccountModes,
    type AccountsState,
    type AccountSortMode,
    type HardwareWalletDetails,
    type LaunchAccountMode,
    type WalletAccount,
    type WatchAccount,
} from '../models'
import {
    logger,
    registerStore,
    type Network,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'accounts-store'

/**
 * Collapse repeated addresses, the higher-precedence account type winning (see
 * `ACCOUNT_TYPE_RANK`) and equal ranks keeping the first occurrence. The
 * survivor sits at the index where its address *first* appeared:
 * `manualAccountOrder`, `selectedAccountAddress` and the rendered list all read
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
    const positionByAddress = new Map<string, number>()
    const resolved: WalletAccount[] = []

    for (const account of accounts) {
        const position = positionByAddress.get(account.address)
        if (position === undefined) {
            positionByAddress.set(account.address, resolved.length)
            resolved.push(account)
            continue
        }
        if (
            ACCOUNT_TYPE_RANK[account.type] >
            ACCOUNT_TYPE_RANK[resolved[position].type]
        ) {
            resolved[position] = account
        }
    }

    return resolved
}

const initialState = {
    accounts: [] as WalletAccount[],
    selectedAccountAddress: null as Nullable<string>,
    sortMode: 'manual' as AccountSortMode,
    manualAccountOrder: [] as string[],
    launchAccountMode: LaunchAccountModes.lastUsed as LaunchAccountMode,
    launchAccountAddress: null as Nullable<string>,
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
                // address so no caller can ever persist the same account
                // twice, keeping the higher-precedence type (see
                // ACCOUNT_TYPE_RANK) rather than whichever happened to come
                // first. Callers that need to surface duplicates to the user
                // (batch import) still throw DuplicateAccountError before
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
            updateAccountRekeyAddress: (
                address: string,
                rekeyAddress: string | null,
                network: Network,
            ) => {
                const accounts = get().accounts
                const idx = accounts.findIndex(a => a.address === address)
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
                const currentAddresses = new Set(current.map(a => a.address))
                const activeNetwork = get().activeRekeyNetwork
                const isActiveNetwork =
                    activeNetwork === null || activeNetwork === network
                const watchAccounts: WatchAccount[] = addresses
                    .filter(addr => !currentAddresses.has(addr))
                    .map(address => ({
                        id: generateOrderedUniqueId(),
                        address,
                        type: AccountTypes.watch,
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
                address: string,
                hardwareDetails: HardwareWalletDetails,
            ) => {
                const accounts = get().accounts
                const idx = accounts.findIndex(a => a.address === address)
                if (idx === -1) return false
                const current = accounts[idx]
                if (current.type !== AccountTypes.watch) return false

                const next = [...accounts]
                next[idx] = {
                    ...current,
                    type: AccountTypes.hardware,
                    hardwareDetails,
                }
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
                if (current.type !== AccountTypes.hardware) return false

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

                const next = [...accounts]
                next[idx] = { ...current, hardwareDetails }
                set({ accounts: next })
                return true
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            partialize: state => ({
                accounts: state.accounts,
                selectedAccountAddress: state.selectedAccountAddress,
                sortMode: state.sortMode,
                manualAccountOrder: state.manualAccountOrder,
                launchAccountMode: state.launchAccountMode,
                launchAccountAddress: state.launchAccountAddress,
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
