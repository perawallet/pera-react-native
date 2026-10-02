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
    defaultNetworkForTier,
    isNetworkId,
    isWalletMode,
    LEGACY_CHAIN_ID,
    networkIdForMode,
    networkTierForMode,
    scopeForLegacyNetwork,
    type ChainId,
    type NetworkId,
    type WalletMode,
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
const STORE_VERSION = 3

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

type NetworkSelection = {
    mode: WalletMode
    /** Developer-mode overrides; kept, unread, while the wallet is live. */
    selectedNetworkByChain: Partial<Record<ChainId, NetworkId>>
    customNetworksByChain: Record<ChainId, CustomNetwork[]>
}

type PersistedNetworkState = NetworkSelection & {
    /** Algorand's network in the legacy shape, derived on every write and persisted only because the extension worker reads storage without hydrating. */
    network: Network
}

type NetworkState = BaseStoreState &
    PersistedNetworkState & {
        setMode: (mode: WalletMode) => void
        /** Writes a developer-mode override; the chain's default test network clears it. */
        selectNetwork: (chainId: ChainId, networkId: NetworkId) => void
        /** Legacy entry: maps the Algorand network onto a mode plus an Algorand override. */
        setNetwork: (network: Network) => void
        setCustomNetwork: (config: CustomNetworkConfig) => void
        clearCustomNetwork: () => void
    }

const selectionForLegacyNetwork = (
    network: string,
): { mode: WalletMode; algorandOverride: NetworkId | undefined } => {
    if (network === 'mainnet') {
        return { mode: 'live', algorandOverride: undefined }
    }
    return {
        mode: 'developer',
        algorandOverride: network === 'testnet' ? undefined : network,
    }
}

const selectionOf = (state: NetworkSelection): NetworkSelection => ({
    mode: state.mode,
    selectedNetworkByChain: state.selectedNetworkByChain,
    customNetworksByChain: state.customNetworksByChain,
})

const withAlgorandOverride = (
    overrides: NetworkSelection['selectedNetworkByChain'],
    algorandOverride: NetworkId | undefined,
): NetworkSelection['selectedNetworkByChain'] => {
    const { [LEGACY_CHAIN_ID]: _dropped, ...rest } = overrides
    return algorandOverride === undefined
        ? rest
        : { ...rest, [LEGACY_CHAIN_ID]: algorandOverride }
}

// A registered chain's override must name one of its test networks or a saved
// custom network; anything else would make every read of its config throw.
// Before registration the registry can't say, so shape alone is kept.
const usableOverride = (
    state: NetworkSelection,
    chainId: ChainId,
): NetworkId | undefined => {
    const override = state.selectedNetworkByChain[chainId]
    if (override === undefined) return undefined
    const { chains } = getProvider()
    if (!chains.has(chainId)) return override
    const isTestNetwork = chains
        .get(chainId)
        .descriptor.networks.some(
            network => network.id === override && network.tier === 'testnet',
        )
    const isCustom = (state.customNetworksByChain[chainId] ?? []).some(
        entry => entry.id === override,
    )
    return isTestNetwork || isCustom ? override : undefined
}

/** Live ignores every override; developer uses a usable one, else the chain's default test network. */
export const selectChainNetworkId = (
    state: NetworkSelection,
    chainId: ChainId,
): NetworkId => {
    const override =
        state.mode === 'developer' ? usableOverride(state, chainId) : undefined
    const { chains } = getProvider()
    // Before bootstrap registers the chains, the tier name stands in: it is
    // Algorand's own id for each tier.
    if (!chains.has(chainId)) {
        return override ?? networkTierForMode(state.mode)
    }
    return networkIdForMode(
        chains.get(chainId).descriptor,
        state.mode,
        override,
    )
}

const withNetworkShim = (
    selection: NetworkSelection,
): PersistedNetworkState => ({
    ...selection,
    network: selectChainNetworkId(selection, LEGACY_CHAIN_ID) as Network,
})

// The store is created at module load, before every provider is wired, so the
// shim is read straight off the default rather than resolved through the registry.
const initialState = (): PersistedNetworkState => {
    const { mode, algorandOverride } = selectionForLegacyNetwork(
        config.defaultNetwork,
    )
    return {
        mode,
        selectedNetworkByChain: withAlgorandOverride({}, algorandOverride),
        customNetworksByChain: { algorand: [] },
        network: config.defaultNetwork,
    }
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
 * Validates a persisted state on every hydrate.
 *
 * An unknown Algorand override (a device that picked 'fnet' before the custom
 * slot replaced it) would reach `getNetworkConfig`, which throws
 * `UnconfiguredScopeError` in every render that reads it, far from the cause. A `'custom'` override with no record has no baked
 * fallback, so every endpoint resolves to `''` and `useAlgorandClient` throws
 * during render. A developer-mode wallet that loses its Algorand override, or
 * has no valid mode, falls back to `config.defaultNetwork`; a live one just
 * drops it.
 */
export const mergePersistedNetwork = (
    persisted: unknown,
): PersistedNetworkState => {
    const state = (persisted ?? {}) as {
        mode?: unknown
        selectedNetworkByChain?: Record<string, unknown>
        customNetworksByChain?: Record<string, unknown>
    }

    const rawCustom = state.customNetworksByChain?.algorand
    const algorandCustom = Array.isArray(rawCustom)
        ? rawCustom.filter(isCustomNetwork)
        : []

    const selected = state.selectedNetworkByChain?.algorand
    const isAlgorandUsable =
        typeof selected === 'string' &&
        selected !== Networks.mainnet &&
        (Object.values(Networks) as string[]).includes(selected) &&
        (selected !== CUSTOM_NETWORK_ID ||
            findCustomNetwork(algorandCustom) !== undefined)

    // Kept on shape alone: see usableOverride.
    const otherChains = Object.entries(
        state.selectedNetworkByChain ?? {},
    ).filter(
        ([chainId, networkId]) =>
            chainId !== 'algorand' && isNetworkId(networkId),
    ) as [ChainId, NetworkId][]

    const overrides = withAlgorandOverride(
        Object.fromEntries(otherChains),
        isAlgorandUsable ? selected : undefined,
    )
    const isFallbackNeeded =
        !isWalletMode(state.mode) ||
        (state.mode === 'developer' &&
            selected !== undefined &&
            !isAlgorandUsable)
    const fallback = selectionForLegacyNetwork(config.defaultNetwork)

    return withNetworkShim({
        mode: isFallbackNeeded ? fallback.mode : (state.mode as WalletMode),
        selectedNetworkByChain: isFallbackNeeded
            ? withAlgorandOverride(overrides, fallback.algorandOverride)
            : overrides,
        customNetworksByChain: { algorand: algorandCustom },
    })
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

const migrateV1 = (persisted: unknown): unknown => ({
    selectedNetworkByChain: {
        algorand: (persisted as { network?: unknown } | null)?.network,
    },
    customNetworksByChain: { algorand: readLegacyCustomNetworks() },
})

/**
 * Keyed on v2's Algorand entry, not `globalNetwork`: every v2 writer kept the
 * two in step, and the entry is what `network` returned, so the legacy shim
 * and the extension worker see the same network afterwards.
 */
const migrateV2 = (persisted: unknown): unknown => {
    const state = (persisted ?? {}) as {
        selectedNetworkByChain?: Record<string, unknown>
        customNetworksByChain?: unknown
    }
    const entry = state.selectedNetworkByChain?.algorand
    if (typeof entry !== 'string') {
        return {
            selectedNetworkByChain: state.selectedNetworkByChain,
            customNetworksByChain: state.customNetworksByChain,
        }
    }
    const { mode, algorandOverride } = selectionForLegacyNetwork(entry)
    return {
        mode,
        selectedNetworkByChain: withAlgorandOverride(
            state.selectedNetworkByChain as Record<string, string>,
            algorandOverride,
        ),
        customNetworksByChain: state.customNetworksByChain,
    }
}

/**
 * v1 kept one `network` for the whole wallet and the custom config in its own
 * store; v2 a global selection plus per-chain entries. The output is left
 * raw; `mergePersistedNetwork` validates it next.
 */
export const migrateNetworkState = (
    persisted: unknown,
    version: number,
): unknown => {
    if (version >= STORE_VERSION) return persisted
    return migrateV2(version < 2 ? migrateV1(persisted) : persisted)
}

export const useNetworkStore: UseBoundStore<
    WithPersist<StoreApi<NetworkState>, unknown>
> = create<NetworkState>()(
    persist(
        set => ({
            ...initialState(),
            setMode: mode =>
                set(state => withNetworkShim({ ...selectionOf(state), mode })),
            selectNetwork: (chainId, networkId) =>
                set(state => {
                    const { chains } = getProvider()
                    const isDefault =
                        chains.has(chainId) &&
                        defaultNetworkForTier(
                            chains.get(chainId).descriptor,
                            'testnet',
                        )?.id === networkId
                    const { [chainId]: _replaced, ...rest } =
                        state.selectedNetworkByChain
                    return withNetworkShim({
                        ...selectionOf(state),
                        selectedNetworkByChain: isDefault
                            ? rest
                            : { ...rest, [chainId]: networkId },
                    })
                }),
            setNetwork: network =>
                set(state => {
                    const { mode, algorandOverride } =
                        selectionForLegacyNetwork(network)
                    return withNetworkShim({
                        ...selectionOf(state),
                        mode,
                        selectedNetworkByChain:
                            mode === 'live'
                                ? state.selectedNetworkByChain
                                : withAlgorandOverride(
                                      state.selectedNetworkByChain,
                                      algorandOverride,
                                  ),
                    })
                }),
            // Replace, never merge: see CustomNetworkConfig.
            setCustomNetwork: customConfig =>
                set(state =>
                    withNetworkShim({
                        ...selectionOf(state),
                        customNetworksByChain: {
                            ...state.customNetworksByChain,
                            algorand: [
                                ...state.customNetworksByChain.algorand.filter(
                                    entry => entry.id !== CUSTOM_NETWORK_ID,
                                ),
                                { ...customConfig, id: CUSTOM_NETWORK_ID },
                            ],
                        },
                    }),
                ),
            clearCustomNetwork: () =>
                set(state =>
                    withNetworkShim({
                        ...selectionOf(state),
                        customNetworksByChain: {
                            ...state.customNetworksByChain,
                            algorand:
                                state.customNetworksByChain.algorand.filter(
                                    entry => entry.id !== CUSTOM_NETWORK_ID,
                                ),
                        },
                    }),
                ),
            resetState: () => set(initialState()),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: STORE_VERSION,
            partialize: state => ({
                mode: state.mode,
                selectedNetworkByChain: state.selectedNetworkByChain,
                customNetworksByChain: state.customNetworksByChain,
                network: state.network,
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
    state: Pick<NetworkSelection, 'customNetworksByChain'>,
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
