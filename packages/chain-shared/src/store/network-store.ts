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
    isNetworkId,
    type ChainId,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { config, Networks, type Network } from '@perawallet/wallet-core-config'
import {
    registerStore,
    type BaseStoreState,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'network-store'
const STORE_VERSION = 2

// Read once by the v1 migration and never written. Kept on disk so a crash
// mid-migration or a downgraded build still finds the config.
const LEGACY_CUSTOM_NETWORK_KEY = 'custom-network-store'

const CUSTOM_NETWORK_ID: NetworkId = Networks.custom

const SUPPORTED_NETWORKS = new Set<string>(Object.values(Networks))

/**
 * Saved as a single unit, never merged: a half-updated chain config (new host,
 * stale genesis hash) would fail every signing attempt with a confusing
 * cross-network mismatch rather than anything pointing at the real cause.
 */
// ponytail: Algorand-shaped; widen customNetworksByChain's value to a per-chain union when a second chain adds custom networks.
export type CustomNetworkConfig = {
    algodUrl: string
    algodToken?: string
    indexerUrl: string
    indexerToken?: string
    genesisHash: string
    genesisId: string
}

export type CustomNetwork = CustomNetworkConfig & { id: NetworkId }

type PersistedNetworkState = {
    selectedNetworkByChain: Record<ChainId, NetworkId>
    customNetworksByChain: Record<ChainId, CustomNetwork[]>
}

type NetworkState = BaseStoreState &
    PersistedNetworkState & {
        /** The Algorand selection in the legacy shape; derived, never persisted. */
        network: Network
        selectNetwork: (chainId: ChainId, networkId: NetworkId) => void
        setNetwork: (network: Network) => void
        setCustomNetwork: (config: CustomNetworkConfig) => void
        clearCustomNetwork: () => void
    }

const withNetworkShim = (
    selectedNetworkByChain: Record<ChainId, NetworkId>,
): Pick<NetworkState, 'selectedNetworkByChain' | 'network'> => ({
    selectedNetworkByChain,
    network: selectedNetworkByChain.algorand as Network,
})

const initialState = (): PersistedNetworkState & { network: Network } => ({
    ...withNetworkShim({ algorand: config.defaultNetwork }),
    customNetworksByChain: { algorand: [] },
})

const isCustomNetwork = (value: unknown): value is CustomNetwork => {
    if (typeof value !== 'object' || value === null) return false
    const entry = value as Record<string, unknown>
    return (
        isNetworkId(entry.id) &&
        typeof entry.algodUrl === 'string' &&
        typeof entry.indexerUrl === 'string' &&
        typeof entry.genesisHash === 'string' &&
        typeof entry.genesisId === 'string'
    )
}

const findCustomNetwork = (
    customNetworks: CustomNetwork[],
): CustomNetwork | undefined =>
    customNetworks.find(entry => entry.id === CUSTOM_NETWORK_ID)

/**
 * Validates a persisted v2 state on every hydrate.
 *
 * An unknown selection (a device that picked 'fnet' before the custom slot
 * replaced it) would reach `getNetworkConfig`, miss, and throw far away at
 * client construction. A `'custom'` selection with no record has no baked
 * fallback, so every endpoint resolves to `''` and `useAlgorandClient` throws
 * during render. Both fall back to `config.defaultNetwork`.
 */
export const mergePersistedNetwork = (
    persisted: unknown,
): PersistedNetworkState & { network: Network } => {
    const state = (persisted ?? {}) as Partial<
        Record<keyof PersistedNetworkState, Record<string, unknown>>
    >

    const rawCustom = state.customNetworksByChain?.algorand
    const algorandCustom = Array.isArray(rawCustom)
        ? rawCustom.filter(isCustomNetwork)
        : []

    const selected = state.selectedNetworkByChain?.algorand
    const isUsable =
        typeof selected === 'string' &&
        SUPPORTED_NETWORKS.has(selected) &&
        (selected !== CUSTOM_NETWORK_ID ||
            findCustomNetwork(algorandCustom) !== undefined)

    return {
        ...withNetworkShim({
            algorand: isUsable ? selected : config.defaultNetwork,
        }),
        customNetworksByChain: { algorand: algorandCustom },
    }
}

const readLegacyCustomNetwork = (): unknown => {
    const raw = getProvider().keyValueStorage.getItem(LEGACY_CUSTOM_NETWORK_KEY)
    if (raw === null) return undefined
    try {
        return (
            JSON.parse(raw) as { state?: { customNetwork?: unknown } } | null
        )?.state?.customNetwork
    } catch {
        return undefined
    }
}

/**
 * v1 kept one `network` for the whole wallet and the custom config in its own
 * store. The output is left raw; `mergePersistedNetwork` validates it next.
 */
export const migrateNetworkState = (
    persisted: unknown,
    version: number,
): unknown => {
    if (version >= STORE_VERSION) return persisted

    const legacy = readLegacyCustomNetwork()
    const legacyEntry =
        typeof legacy === 'object' && legacy !== null
            ? [{ ...legacy, id: CUSTOM_NETWORK_ID }]
            : []

    return {
        selectedNetworkByChain: {
            algorand: (persisted as { network?: unknown } | null)?.network,
        },
        customNetworksByChain: { algorand: legacyEntry },
    }
}

export const useNetworkStore: UseBoundStore<
    WithPersist<StoreApi<NetworkState>, unknown>
> = create<NetworkState>()(
    persist(
        set => ({
            ...initialState(),
            selectNetwork: (chainId, networkId) =>
                set(state =>
                    withNetworkShim({
                        ...state.selectedNetworkByChain,
                        [chainId]: networkId,
                    }),
                ),
            setNetwork: network =>
                set(state =>
                    withNetworkShim({
                        ...state.selectedNetworkByChain,
                        algorand: network,
                    }),
                ),
            // Replace, never merge: see CustomNetworkConfig.
            setCustomNetwork: customConfig =>
                set(state => ({
                    customNetworksByChain: {
                        ...state.customNetworksByChain,
                        algorand: [
                            ...state.customNetworksByChain.algorand.filter(
                                entry => entry.id !== CUSTOM_NETWORK_ID,
                            ),
                            { ...customConfig, id: CUSTOM_NETWORK_ID },
                        ],
                    },
                })),
            clearCustomNetwork: () =>
                set(state => ({
                    customNetworksByChain: {
                        ...state.customNetworksByChain,
                        algorand: state.customNetworksByChain.algorand.filter(
                            entry => entry.id !== CUSTOM_NETWORK_ID,
                        ),
                    },
                })),
            resetState: () => set(initialState()),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: STORE_VERSION,
            partialize: state => ({
                selectedNetworkByChain: state.selectedNetworkByChain,
                customNetworksByChain: state.customNetworksByChain,
            }),
            migrate: migrateNetworkState,
            merge: (persisted, current) => {
                // zustand calls `merge` even when storage held nothing and
                // applies the result with replace:true, so an empty read must
                // leave the current state alone.
                if (persisted === undefined || persisted === null) {
                    return current
                }

                // Spread over `current`: the validator returns data only, and
                // replace:true would otherwise drop the actions.
                return { ...current, ...mergePersistedNetwork(persisted) }
            },
        },
    ),
)

export const selectAlgorandCustomNetwork = (
    state: PersistedNetworkState,
): CustomNetwork | undefined =>
    findCustomNetwork(state.customNetworksByChain.algorand)

/** Non-hook read, for the client factories and resolvers that run outside React. */
export const getCustomNetworkConfig = (): CustomNetworkConfig | undefined =>
    selectAlgorandCustomNetwork(useNetworkStore.getState())

/**
 * The Custom radio is always tappable (it is the only route into the config
 * sheet), but `custom` must never become the active network until this is true.
 */
export const isCustomNetworkConfigured = (): boolean =>
    getCustomNetworkConfig() !== undefined

export const setCustomNetwork = (customConfig: CustomNetworkConfig): void =>
    useNetworkStore.getState().setCustomNetwork(customConfig)

export const clearCustomNetwork = (): void =>
    useNetworkStore.getState().clearCustomNetwork()

registerStore({
    name: STORE_NAME,
    clearStorage: () => {
        useNetworkStore.persist.clearStorage()
        // The legacy record holds a node URL and token; a wipe must scrub it too.
        getProvider().keyValueStorage.removeItem(LEGACY_CUSTOM_NETWORK_KEY)
    },
    resetState: () => useNetworkStore.getState().resetState(),
})
