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

import { type Network, Networks } from '@perawallet/wallet-core-config'

export type ActiveNetwork = Network

const SUPPORTED = new Set<string>(Object.values(Networks))

// The service worker never hydrates the network zustand store, so it reads the persisted envelope
// straight from chrome.storage.local. That value is a JSON string, not an object, because the store
// persists through ChromeKeyValueStorageService, which stringifies the whole envelope.
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
