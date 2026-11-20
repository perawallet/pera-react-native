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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { isSealedKvRecord, sealKvRecord } from './kv-record'
import { AuthenticatedKeyValueStorage } from './services/authenticated-key-value-storage'
import {
    ChromeKeyValueStorageService,
    KV_PREFIX,
} from './services/key-value-storage'

// Names persisted by `STORE_NAME` in chain-shared's network-store.ts (not
// exported) and `LEGACY_CUSTOM_NETWORK_KEY` in its legacy-network.ts (not on
// the package barrel). A mobile app spec pins the first against this list.
export const AUTHENTICATED_KV_KEYS: readonly string[] = [
    'network-store',
    'custom-network-store',
]

// Separate from resources.ts so the pre-hydration ./bootstrap subpath can import
// hydratePlatform without dragging in ChromeDatabaseService; resources.ts
// imports this same singleton.
const chromeKeyValueStorage = new ChromeKeyValueStorageService()
export const keyValueStorage = new AuthenticatedKeyValueStorage(
    chromeKeyValueStorage,
    AUTHENTICATED_KV_KEYS,
)

export const setKvAuthKey = (key: Nullable<Uint8Array>): void => {
    keyValueStorage.setAuthKey(key)
}

/**
 * Seals the unsealed network records already in chrome.storage.local. Reads
 * storage directly because the cache hides unsealed values. Rejects if the
 * write fails, so the caller leaves the migration unfinished.
 */
export const sealLegacyKvRecords = async (
    authKey: Uint8Array,
): Promise<void> => {
    const storageKeys = AUTHENTICATED_KV_KEYS.map(key => KV_PREFIX + key)
    const stored = await chrome.storage.local.get(storageKeys)
    const sealed: Record<string, string> = {}
    for (const storageKey of storageKeys) {
        const value = stored[storageKey]
        if (typeof value !== 'string' || isSealedKvRecord(value)) continue
        sealed[storageKey] = sealKvRecord(
            authKey,
            storageKey.slice(KV_PREFIX.length),
            value,
        )
    }
    if (Object.keys(sealed).length === 0) return
    await chrome.storage.local.set(sealed)
}

/**
 * The web app shell MUST await this before its first render — synchronous
 * storage reads throw until the cache is hydrated from chrome.storage.local.
 */
export const hydratePlatform = async (): Promise<void> => {
    await chromeKeyValueStorage.hydrate()
}
