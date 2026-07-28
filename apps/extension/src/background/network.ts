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
