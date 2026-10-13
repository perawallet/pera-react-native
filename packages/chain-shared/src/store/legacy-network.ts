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

// Everything here serves the legacy single-network shape: the `network` shim,
// `setNetwork`, and the v1 and v2 formats it was persisted in. It goes when
// that shape does, and nothing else in the store depends on a chain.

import {
    CUSTOM_NETWORK_ID,
    isLegacyNetwork,
    LEGACY_CHAIN_ID,
    type ChainId,
    type NetworkId,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { isCustomNetworkConfig } from '@perawallet/wallet-core-config'
import { getProvider } from '@perawallet/wallet-extension-provider'

// Folded in on hydrate, never written. Kept on disk so a crash mid-migration
// or a downgraded build still finds the config.
export const LEGACY_CUSTOM_NETWORK_KEY = 'custom-network-store'

type Overrides = Partial<Record<ChainId, NetworkId>>

export const selectionForLegacyNetwork = (
    network: string,
): { mode: WalletMode; legacyOverride: NetworkId | undefined } => {
    if (network === 'mainnet') {
        return { mode: 'live', legacyOverride: undefined }
    }
    return {
        mode: 'developer',
        legacyOverride: network === 'testnet' ? undefined : network,
    }
}

export const withLegacyOverride = (
    overrides: Overrides,
    legacyOverride: NetworkId | undefined,
): Overrides => {
    const { [LEGACY_CHAIN_ID]: _dropped, ...rest } = overrides
    return legacyOverride === undefined
        ? rest
        : { ...rest, [LEGACY_CHAIN_ID]: legacyOverride }
}

/**
 * Checked on hydrate, before any chain registers, because the shim is
 * persisted from it. An unknown override (a device that picked 'fnet' before
 * the custom slot replaced it) reaches `getNetworkConfig`, which throws
 * `UnconfiguredScopeError` in every render that reads it. A `'custom'`
 * override without a complete saved node resolves every endpoint to `''`, and
 * `useAlgorandClient` throws during render.
 */
export const isLegacyOverrideUsable = (
    override: unknown,
    customNetworks: readonly { id: NetworkId }[],
): override is NetworkId =>
    isLegacyNetwork(override) &&
    override !== 'mainnet' &&
    (override !== CUSTOM_NETWORK_ID ||
        customNetworks.some(
            entry =>
                entry.id === CUSTOM_NETWORK_ID && isCustomNetworkConfig(entry),
        ))

export const readLegacyCustomNetworks = (): unknown[] => {
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
        [LEGACY_CHAIN_ID]: (persisted as { network?: unknown } | null)?.network,
    },
    customNetworksByChain: { [LEGACY_CHAIN_ID]: readLegacyCustomNetworks() },
})

/**
 * Keyed on v2's legacy-chain entry, not `globalNetwork`: every v2 writer kept
 * the two in step, and the entry is what `network` returned, so the shim and
 * the extension worker see the same network afterwards.
 */
const migrateV2 = (persisted: unknown): unknown => {
    const state = (persisted ?? {}) as {
        selectedNetworkByChain?: Record<string, unknown>
        customNetworksByChain?: unknown
    }
    const entry = state.selectedNetworkByChain?.[LEGACY_CHAIN_ID]
    if (typeof entry !== 'string') {
        return {
            selectedNetworkByChain: state.selectedNetworkByChain,
            customNetworksByChain: state.customNetworksByChain,
        }
    }
    const { mode, legacyOverride } = selectionForLegacyNetwork(entry)
    return {
        mode,
        selectedNetworkByChain: withLegacyOverride(
            state.selectedNetworkByChain as Overrides,
            legacyOverride,
        ),
        customNetworksByChain: state.customNetworksByChain,
    }
}

/**
 * v1 kept one `network` for the whole wallet and the custom config in its own
 * store; v2 a global selection plus per-chain entries. The output is left
 * raw; `mergePersistedNetwork` validates it next.
 */
export const migrateLegacyNetworkState = (
    persisted: unknown,
    version: number,
): unknown => migrateV2(version < 2 ? migrateV1(persisted) : persisted)
