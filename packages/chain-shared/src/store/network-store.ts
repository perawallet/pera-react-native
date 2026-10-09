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
    chainModeFor,
    defaultNetworkForTier,
    isNetworkId,
    isWalletMode,
    LEGACY_CHAIN_ID,
    networkIdForMode,
    networkTierForMode,
    type ChainId,
    type ChainMode,
    type NetworkId,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { config, type Network } from '@perawallet/wallet-core-config'
import {
    registerStore,
    type BaseStoreState,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    isLegacyOverrideUsable,
    LEGACY_CUSTOM_NETWORK_KEY,
    migrateLegacyNetworkState,
    readLegacyCustomNetworks,
    selectionForLegacyNetwork,
    withLegacyOverride,
} from './legacy-network'

const STORE_NAME = 'network-store'
const STORE_VERSION = 3

/**
 * A chain's saved network. Its config is the chain's own shape, so the store
 * keeps it opaque and the chain's reader validates it.
 */
export type CustomNetwork = { id: NetworkId } & Readonly<
    Record<string, unknown>
>

type CustomNetworksByChain = Partial<Record<ChainId, CustomNetwork[]>>

type NetworkSelection = {
    mode: WalletMode
    /** Developer-mode overrides; kept, unread, while the wallet is live. */
    selectedNetworkByChain: Partial<Record<ChainId, NetworkId>>
    customNetworksByChain: CustomNetworksByChain
}

type PersistedNetworkState = NetworkSelection & {
    /** The legacy chain's network in the legacy shape, derived on every write and persisted only because the extension worker reads storage without hydrating. */
    network: Network
}

type NetworkState = BaseStoreState &
    PersistedNetworkState & {
        setMode: (mode: WalletMode) => void
        /** Writes a developer-mode override; the chain's default test network clears it. */
        selectNetwork: (chainId: ChainId, networkId: NetworkId) => void
        /** Legacy entry: maps a legacy network onto a mode plus a legacy-chain override. */
        setNetwork: (network: Network) => void
        /** Replaces the chain's network with the same id, never merging into it. */
        setCustomNetwork: (chainId: ChainId, network: CustomNetwork) => void
        clearCustomNetwork: (chainId: ChainId, networkId: NetworkId) => void
    }

const selectionOf = (state: NetworkSelection): NetworkSelection => ({
    mode: state.mode,
    selectedNetworkByChain: state.selectedNetworkByChain,
    customNetworksByChain: state.customNetworksByChain,
})

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
    // the legacy chain's own id for each tier.
    if (!chains.has(chainId)) {
        return override ?? networkTierForMode(state.mode)
    }
    return networkIdForMode(
        chains.get(chainId).descriptor,
        state.mode,
        override,
    )
}

/** Agrees with `selectChainNetworkId`: a stale override reads as `developer`, as the network actually used does. */
export const selectChainMode = (
    state: NetworkSelection,
    chainId: ChainId,
): ChainMode => {
    if (state.mode === 'live') return 'live'
    const override = usableOverride(state, chainId)
    const { chains } = getProvider()
    // Mirrors the pre-bootstrap stand-in in selectChainNetworkId.
    if (!chains.has(chainId)) {
        return override === undefined ? 'developer' : 'developer-override'
    }
    return chainModeFor(chains.get(chainId).descriptor, 'developer', override)
}

export const selectCustomNetwork = (
    state: Pick<NetworkSelection, 'customNetworksByChain'>,
    chainId: ChainId,
    networkId: NetworkId,
): CustomNetwork | undefined =>
    state.customNetworksByChain[chainId]?.find(entry => entry.id === networkId)

const withNetworkShim = (
    selection: NetworkSelection,
): PersistedNetworkState => ({
    ...selection,
    network: selectChainNetworkId(selection, LEGACY_CHAIN_ID) as Network,
})

// The store is created at module load, before every provider is wired, so the
// shim is read straight off the default rather than resolved through the registry.
const initialState = (): PersistedNetworkState => {
    const { mode, legacyOverride } = selectionForLegacyNetwork(
        config.defaultNetwork,
    )
    return {
        mode,
        selectedNetworkByChain: withLegacyOverride({}, legacyOverride),
        customNetworksByChain: {},
        network: config.defaultNetwork,
    }
}

const isStoredCustomNetwork = (value: unknown): value is CustomNetwork =>
    typeof value === 'object' &&
    value !== null &&
    isNetworkId((value as { id?: unknown }).id)

const customNetworksOf = (raw: unknown): CustomNetworksByChain =>
    Object.fromEntries(
        Object.entries((raw ?? {}) as Record<string, unknown>).map(
            ([chainId, entries]) => [
                chainId,
                Array.isArray(entries)
                    ? entries.filter(isStoredCustomNetwork)
                    : [],
            ],
        ),
    )

/**
 * Validates a persisted state on every hydrate. Other chains' overrides are
 * kept on shape alone (see usableOverride); the legacy chain's is checked
 * here because the persisted shim is derived from it. A developer-mode wallet
 * that loses that override, or has no valid mode, falls back to
 * `config.defaultNetwork`; a live one just drops it.
 */
export const mergePersistedNetwork = (
    persisted: unknown,
): PersistedNetworkState => {
    const state = (persisted ?? {}) as {
        mode?: unknown
        selectedNetworkByChain?: Record<string, unknown>
        customNetworksByChain?: unknown
    }

    const customNetworksByChain = customNetworksOf(state.customNetworksByChain)
    const legacyOverride = state.selectedNetworkByChain?.[LEGACY_CHAIN_ID]
    const isLegacyUsable = isLegacyOverrideUsable(
        legacyOverride,
        customNetworksByChain[LEGACY_CHAIN_ID] ?? [],
    )

    const otherChains = Object.entries(
        state.selectedNetworkByChain ?? {},
    ).filter(
        ([chainId, networkId]) =>
            chainId !== LEGACY_CHAIN_ID && isNetworkId(networkId),
    ) as [ChainId, NetworkId][]

    const overrides = withLegacyOverride(
        Object.fromEntries(otherChains),
        isLegacyUsable ? legacyOverride : undefined,
    )
    const isFallbackNeeded =
        !isWalletMode(state.mode) ||
        (state.mode === 'developer' &&
            legacyOverride !== undefined &&
            !isLegacyUsable)
    const fallback = selectionForLegacyNetwork(config.defaultNetwork)

    return withNetworkShim({
        mode: isFallbackNeeded ? fallback.mode : (state.mode as WalletMode),
        selectedNetworkByChain: isFallbackNeeded
            ? withLegacyOverride(overrides, fallback.legacyOverride)
            : overrides,
        customNetworksByChain,
    })
}

export const migrateNetworkState = (
    persisted: unknown,
    version: number,
): unknown =>
    version >= STORE_VERSION
        ? persisted
        : migrateLegacyNetworkState(persisted, version)

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
                    const { mode, legacyOverride } =
                        selectionForLegacyNetwork(network)
                    return withNetworkShim({
                        ...selectionOf(state),
                        mode,
                        selectedNetworkByChain:
                            mode === 'live'
                                ? state.selectedNetworkByChain
                                : withLegacyOverride(
                                      state.selectedNetworkByChain,
                                      legacyOverride,
                                  ),
                    })
                }),
            setCustomNetwork: (chainId, network) =>
                set(state =>
                    withNetworkShim({
                        ...selectionOf(state),
                        customNetworksByChain: {
                            ...state.customNetworksByChain,
                            [chainId]: [
                                ...(
                                    state.customNetworksByChain[chainId] ?? []
                                ).filter(entry => entry.id !== network.id),
                                network,
                            ],
                        },
                    }),
                ),
            clearCustomNetwork: (chainId, networkId) =>
                set(state =>
                    withNetworkShim({
                        ...selectionOf(state),
                        customNetworksByChain: {
                            ...state.customNetworksByChain,
                            [chainId]: (
                                state.customNetworksByChain[chainId] ?? []
                            ).filter(entry => entry.id !== networkId),
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
                    const legacy = readLegacyCustomNetworks().filter(
                        isStoredCustomNetwork,
                    )
                    return legacy.length === 0
                        ? current
                        : {
                              ...current,
                              customNetworksByChain: {
                                  ...current.customNetworksByChain,
                                  [LEGACY_CHAIN_ID]: legacy,
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

registerStore({
    name: STORE_NAME,
    clearStorage: () => {
        useNetworkStore.persist.clearStorage()
        // The legacy record holds a node URL and token; a wipe must scrub it too.
        getProvider().keyValueStorage.removeItem(LEGACY_CUSTOM_NETWORK_KEY)
    },
    resetState: () => useNetworkStore.getState().resetState(),
})
