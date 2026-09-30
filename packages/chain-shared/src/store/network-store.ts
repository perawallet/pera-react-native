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
    CUSTOM_NETWORK_ID,
    isGlobalNetwork,
    isNetworkId,
    networkIdForGlobal,
    scopeForLegacyNetwork,
    type ChainId,
    type GlobalNetwork,
    type NetworkId,
    type NetworkTier,
} from '@perawallet/wallet-core-chain-contract'
import {
    config,
    Networks,
    registerCustomNetworkSource,
    type Network,
} from '@perawallet/wallet-core-config'
import {
    registerStore,
    type BaseStoreState,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'network-store'
const STORE_VERSION = 2

// Folded in on hydrate, never written. Kept on disk so a crash mid-migration
// or a downgraded build still finds the config.
const LEGACY_CUSTOM_NETWORK_KEY = 'custom-network-store'

// ponytail: Algorand-shaped; widen customNetworksByChain's value to a per-chain union when a second chain adds custom networks.
/**
 * Saved as a single unit, never merged: a half-updated chain config (new host,
 * stale genesis hash) would fail every signing attempt with a confusing
 * cross-network mismatch rather than anything pointing at the real cause.
 */
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
    globalNetwork: GlobalNetwork
    /**
     * Algorand's entry is always written, for the legacy `network` shim. Any
     * other chain's entry is a per-chain override of `globalNetwork`.
     */
    selectedNetworkByChain: Record<ChainId, NetworkId>
    customNetworksByChain: Record<ChainId, CustomNetwork[]>
}

type NetworkState = BaseStoreState &
    PersistedNetworkState & {
        /** The Algorand selection in the legacy shape; derived, never persisted. */
        network: Network
        selectNetwork: (chainId: ChainId, networkId: NetworkId) => void
        /**
         * Clears every per-chain override, so each chain follows the new
         * selection. Custom commits only through `setNetwork`, once its record is saved.
         */
        setGlobalNetwork: (tier: NetworkTier) => void
        /** Pins Algorand to `network` (BetaNet has no global option) and sets the global selection from it. */
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

// Algorand's network ids are the global names, plus BetaNet on the testnet tier.
const globalNetworkForAlgorand = (networkId: NetworkId): GlobalNetwork => {
    if (networkId === 'mainnet') return 'mainnet'
    return networkId === CUSTOM_NETWORK_ID ? 'custom' : 'testnet'
}

const initialState = (): PersistedNetworkState & { network: Network } => ({
    globalNetwork: globalNetworkForAlgorand(config.defaultNetwork),
    ...withNetworkShim({ algorand: config.defaultNetwork }),
    customNetworksByChain: { algorand: [] },
})

const networkIdForChain = (
    chainId: ChainId,
    globalNetwork: GlobalNetwork,
): NetworkId => {
    const { chains } = getProvider()
    // Before bootstrap registers the chains, the global name stands in: it is
    // Algorand's own id for every global option.
    if (!chains.has(chainId)) {
        return globalNetwork
    }
    return networkIdForGlobal(
        chains.get(chainId).descriptor,
        globalNetwork,
        chains.capabilities(chainId).customNetworks,
    )
}

// Hydrate keeps another chain's entry on shape alone, since the registry may
// be empty then; a network its descriptor no longer lists would make every
// read of that chain's config throw, so it falls back to the global selection.
// Algorand's entry is validated at hydrate instead.
const isUsableOverride = (chainId: ChainId, networkId: NetworkId): boolean => {
    if (chainId === 'algorand') return true
    const { chains } = getProvider()
    return (
        !chains.has(chainId) ||
        chains
            .get(chainId)
            .descriptor.networks.some(network => network.id === networkId)
    )
}

/** A stored override if the chain has a usable one, else the global selection mapped onto the chain. */
export const selectChainNetworkId = (
    state: Pick<
        PersistedNetworkState,
        'globalNetwork' | 'selectedNetworkByChain'
    >,
    chainId: ChainId,
): NetworkId => {
    const override = state.selectedNetworkByChain[chainId]
    return override !== undefined && isUsableOverride(chainId, override)
        ? override
        : networkIdForChain(chainId, state.globalNetwork)
}

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
 * replaced it) would reach `getNetworkConfig`, which throws
 * `UnconfiguredScopeError` in every render that reads it, far from the cause. A `'custom'` selection with no record has no baked
 * fallback, so every endpoint resolves to `''` and `useAlgorandClient` throws
 * during render. Both fall back to `config.defaultNetwork`.
 */
export const mergePersistedNetwork = (
    persisted: unknown,
): PersistedNetworkState & { network: Network } => {
    const state = (persisted ?? {}) as Partial<
        Record<
            Exclude<keyof PersistedNetworkState, 'globalNetwork'>,
            Record<string, unknown>
        >
    > & { globalNetwork?: unknown }

    const rawCustom = state.customNetworksByChain?.algorand
    const algorandCustom = Array.isArray(rawCustom)
        ? rawCustom.filter(isCustomNetwork)
        : []

    const selected = state.selectedNetworkByChain?.algorand
    const isUsable =
        typeof selected === 'string' &&
        (Object.values(Networks) as string[]).includes(selected) &&
        (selected !== CUSTOM_NETWORK_ID ||
            findCustomNetwork(algorandCustom) !== undefined)

    // Kept on shape alone: see isUsableOverride.
    const otherChains = Object.entries(
        state.selectedNetworkByChain ?? {},
    ).filter(
        ([chainId, networkId]) =>
            chainId !== 'algorand' && isNetworkId(networkId),
    )

    const algorand = isUsable ? selected : config.defaultNetwork
    // A demoted selection moves the global one with it, so the two never
    // disagree about whether the wallet is on a custom node.
    const globalNetwork =
        isUsable && isGlobalNetwork(state.globalNetwork)
            ? state.globalNetwork
            : globalNetworkForAlgorand(algorand)

    return {
        globalNetwork,
        ...withNetworkShim({
            ...Object.fromEntries(otherChains),
            algorand,
        }),
        customNetworksByChain: { algorand: algorandCustom },
    }
}

const readLegacyCustomNetworks = (): unknown[] => {
    const raw = getProvider().keyValueStorage.getItem(LEGACY_CUSTOM_NETWORK_KEY)
    if (raw === null) return []
    try {
        const legacy = (
            JSON.parse(raw) as { state?: { customNetwork?: unknown } } | null
        )?.state?.customNetwork
        return typeof legacy === 'object' && legacy !== null
            ? [{ ...legacy, id: CUSTOM_NETWORK_ID }]
            : []
    } catch {
        return []
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

    return {
        selectedNetworkByChain: {
            algorand: (persisted as { network?: unknown } | null)?.network,
        },
        customNetworksByChain: { algorand: readLegacyCustomNetworks() },
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
            setGlobalNetwork: tier =>
                set({
                    globalNetwork: tier,
                    ...withNetworkShim({
                        algorand: networkIdForChain('algorand', tier),
                    }),
                }),
            setNetwork: network =>
                set({
                    globalNetwork: globalNetworkForAlgorand(network),
                    ...withNetworkShim({ algorand: network }),
                }),
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
                globalNetwork: state.globalNetwork,
                selectedNetworkByChain: state.selectedNetworkByChain,
                customNetworksByChain: state.customNetworksByChain,
            }),
            migrate: migrateNetworkState,
            merge: (persisted, current) => {
                // zustand calls `merge` even when storage held nothing and
                // applies the result with replace:true, so an empty read must
                // leave the selection alone. `migrate` never runs without a
                // blob, so a wallet that saved a custom network but never
                // switched still needs the legacy record folded in here.
                if (persisted === undefined || persisted === null) {
                    const legacy =
                        readLegacyCustomNetworks().filter(isCustomNetwork)
                    return legacy.length === 0
                        ? current
                        : {
                              ...current,
                              customNetworksByChain: {
                                  ...current.customNetworksByChain,
                                  algorand: legacy,
                              },
                          }
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

// A literal, not Networks.custom: module load must not touch the config enum.
const CUSTOM_SCOPE = scopeForLegacyNetwork('custom')

// config resolves chain endpoints but cannot import this store, so the saved
// node reaches getChainConfig through this reader.
registerCustomNetworkSource(scope => {
    const saved = getCustomNetworkConfig()
    if (
        saved === undefined ||
        scope.chainId !== CUSTOM_SCOPE.chainId ||
        scope.networkId !== CUSTOM_SCOPE.networkId
    ) {
        return undefined
    }
    return {
        algodUrl: saved.algodUrl,
        indexerUrl: saved.indexerUrl,
        algodToken: saved.algodToken ?? '',
        indexerToken: saved.indexerToken ?? '',
        genesisHash: saved.genesisHash,
        genesisId: saved.genesisId,
    }
})
