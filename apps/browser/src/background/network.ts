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
    isLegacyNetwork,
    isWalletMode,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional, Nullable } from '@perawallet/wallet-core-shared'

// The service worker never hydrates the network zustand store, so it reads the persisted envelope
// straight from chrome.storage.local. That value is a JSON string, not an object, because the store
// persists through ChromeKeyValueStorageService, which stringifies the whole envelope.
export const parseActiveDeployment = (raw: Optional<string>): WalletMode => {
    if (raw === undefined) return 'live'
    let envelope: unknown
    try {
        envelope = JSON.parse(raw)
    } catch {
        return 'live'
    }
    const state = (
        envelope as Nullable<{
            state?: {
                mode?: unknown
                selectedNetworkByChain?: { algorand?: unknown }
                network?: unknown
            }
        }>
    )?.state
    if (isWalletMode(state?.mode)) return state.mode
    // v1 and v2 predate the mode, and either may survive until a UI or offscreen context rewrites it: only MainNet was live then.
    const network = state?.network ?? state?.selectedNetworkByChain?.algorand
    return isLegacyNetwork(network) && network !== 'mainnet'
        ? 'developer'
        : 'live'
}

// The network store persists under this key; there is no shared export for it.
const NETWORK_STORAGE_KEY = 'kv:network-store'

export const readActiveDeployment = async (): Promise<WalletMode> => {
    const stored = await chrome.storage.local.get(NETWORK_STORAGE_KEY)
    const raw = stored[NETWORK_STORAGE_KEY]
    return parseActiveDeployment(typeof raw === 'string' ? raw : undefined)
}
