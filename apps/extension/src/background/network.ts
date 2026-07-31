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

import {
    getNetworkConfig,
    type Network,
    Networks,
} from '@perawallet/wallet-core-config'

export type ActiveNetwork = Network

/** The chain identity advertised to dApps over ARC-0027 discover/enable. */
export type AdvertisedGenesis = {
    genesisHash: string
    genesisId: string
}

const SUPPORTED = new Set<string>(Object.values(Networks))

// Pure parser for the network zustand store's persisted envelope. The store
// persists through ChromeKeyValueStorageService, which JSON.stringifies the
// whole envelope (`setJSON` -> `setItem`) before handing it to
// chrome.storage.local — so the raw value read back from storage is a JSON
// *string*, not an object. Kept side-effect-free and exported so the
// mainnet-fallback behavior for every malformed/missing/unknown case is
// covered directly by tests instead of only through the SW's discover flow.
export const parseActiveNetwork = (raw: string | undefined): ActiveNetwork => {
    if (raw === undefined) return Networks.mainnet
    let envelope: unknown
    try {
        envelope = JSON.parse(raw)
    } catch {
        return Networks.mainnet
    }
    const network = (envelope as { state?: { network?: unknown } } | null)
        ?.state?.network
    return typeof network === 'string' && SUPPORTED.has(network)
        ? (network as ActiveNetwork)
        : Networks.mainnet
}

const bakedGenesis = (network: ActiveNetwork): AdvertisedGenesis => {
    const cfg = getNetworkConfig(network)
    return { genesisHash: cfg.genesisHash, genesisId: cfg.genesisId }
}

/**
 * Pure parser for the custom-network zustand store's persisted envelope, read
 * from `kv:custom-network-store` exactly the way parseActiveNetwork reads
 * `kv:network-store`.
 *
 * Returns undefined unless a real chain identity is there: `custom`'s baked
 * chain-table row is empty by design (every value lives in this store), so a
 * missing/corrupt entry must NOT resolve to `''`. genesisId is not
 * signature-bound and is allowed to be empty.
 */
const parseCustomNetworkGenesis = (
    raw: string | undefined,
): AdvertisedGenesis | undefined => {
    if (raw === undefined) return undefined
    let envelope: unknown
    try {
        envelope = JSON.parse(raw)
    } catch {
        return undefined
    }

    const customNetwork = (
        envelope as { state?: { customNetwork?: unknown } } | null
    )?.state?.customNetwork
    if (typeof customNetwork !== 'object' || customNetwork === null) {
        return undefined
    }

    const { genesisHash, genesisId } = customNetwork as {
        genesisHash?: unknown
        genesisId?: unknown
    }
    if (typeof genesisHash !== 'string' || genesisHash.length === 0) {
        return undefined
    }

    return {
        genesisHash,
        genesisId: typeof genesisId === 'string' ? genesisId : '',
    }
}

/**
 * The chain identity to advertise for the ACTIVE network.
 *
 * The three real networks come from the baked chain table. `custom` cannot:
 * `getNetworkConfig(Networks.custom)` returns empty strings on purpose, so
 * reading it would hand every dApp `genesisHash: ''` — a value a dApp cannot
 * validate and cannot detect as absent. Its identity lives in the
 * custom-network store, which the service worker reads out of
 * chrome.storage.local by key (it has no React tree to mount a store hook in).
 *
 * An unusable custom entry degrades to mainnet, the same rule
 * {@link parseActiveNetwork} already applies to every value it cannot use.
 */
export const resolveAdvertisedGenesis = (
    network: ActiveNetwork,
    rawCustomNetwork: string | undefined,
): AdvertisedGenesis => {
    if (network !== Networks.custom) return bakedGenesis(network)

    return (
        parseCustomNetworkGenesis(rawCustomNetwork) ??
        bakedGenesis(Networks.mainnet)
    )
}
