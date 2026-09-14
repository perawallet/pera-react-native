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

import { logger } from '@perawallet/wallet-core-shared'
import type { KeyValueStorageService } from '@perawallet/wallet-extension-platform'

/**
 * `IKeyValueStorage` from `@walletconnect/keyvaluestorage`, restated
 * structurally: the specifier only resolves from inside `@walletconnect/core`
 * on a pnpm layout, and the published signatures are `any`-typed. The
 * assignability check that matters happens where `Core({ storage })` is
 * constructed in `./client`.
 */
export interface WalletConnectV2Storage {
    getKeys(): Promise<string[]>
    getEntries<T>(): Promise<[string, T][]>
    getItem<T>(key: string): Promise<T | undefined>
    setItem<T>(key: string, value: T): Promise<void>
    removeItem(key: string): Promise<void>
}

/**
 * WalletKit and Pera share one MMKV instance, and WalletKit's own key names
 * (`topic`, `keychain`, `messages`) are generic enough to collide with the
 * wallet's. Every entry is namespaced, and `getKeys`/`getEntries` report only
 * this namespace so WalletKit never enumerates — or migrates — Pera's rows.
 */
export const WALLET_CONNECT_V2_STORAGE_PREFIX = 'wc2:'

const ownKeysOf = (keyValueStorage: KeyValueStorageService): string[] =>
    keyValueStorage
        .getAllKeys()
        .filter(key => key.startsWith(WALLET_CONNECT_V2_STORAGE_PREFIX))

/**
 * Removes everything WalletKit persisted, keychain included: every pairing and
 * session symKey and the client seed sit here, and no session disconnect
 * clears the seed or a pairing that never settled. Needs no live client. A
 * client still running writes its in-memory keychain back on its next
 * mutation, so run this as close to the handler's teardown as the caller can.
 */
export const clearWalletConnectV2Storage = (
    keyValueStorage: KeyValueStorageService,
): void => {
    const keys = ownKeysOf(keyValueStorage)
    for (const key of keys) keyValueStorage.removeItem(key)
    // MMKV is an append log: without compaction the removed symKeys stay
    // recoverable from the file.
    if (keys.length > 0) keyValueStorage.trim?.()
}

/**
 * Bridges Pera's synchronous KV service to the promise-based store
 * `Core({ storage })` expects.
 *
 * Plain JSON, unlike the reference adapter's `safeJson*`, which encodes a
 * `bigint` as `"<digits>n"` on write and promotes both that form and any
 * integer of 17 digits or more back to `BigInt` on read. Here a `bigint`
 * instead reaches `JSON.stringify` as a `TypeError` — a rejected `setItem`
 * rather than a silently dropped row — and a large integer reads back as a
 * `number`. Algorand's payloads are base64 strings, so nothing on this path
 * carries either.
 */
export const createWalletConnectV2Storage = (
    keyValueStorage: KeyValueStorageService,
): WalletConnectV2Storage => {
    const prefixed = (key: string): string =>
        `${WALLET_CONNECT_V2_STORAGE_PREFIX}${key}`

    const ownKeys = (): string[] =>
        keyValueStorage
            .getAllKeys()
            .filter(key => key.startsWith(WALLET_CONNECT_V2_STORAGE_PREFIX))

    const unprefixed = (key: string): string =>
        key.slice(WALLET_CONNECT_V2_STORAGE_PREFIX.length)

    // A row that will not parse is unusable either way; reported absent so
    // WalletKit rebuilds it instead of throwing out of an unrelated read.
    // `key` is always the unprefixed name, the one WalletKit asked for.
    const parse = <T>(key: string, raw: string): T | undefined => {
        try {
            return JSON.parse(raw) as T
        } catch {
            logger.warn('[WC v2] discarding an unparsable storage entry', {
                key,
            })
            return undefined
        }
    }

    return {
        getKeys: async () => ownKeys().map(unprefixed),

        getEntries: async <T>() => {
            const entries: [string, T][] = []
            for (const key of ownKeys()) {
                const raw = keyValueStorage.getItem(key)
                if (raw === null) continue
                const name = unprefixed(key)
                const value = parse<T>(name, raw)
                if (value === undefined) continue
                entries.push([name, value])
            }
            return entries
        },

        getItem: async <T>(key: string) => {
            const raw = keyValueStorage.getItem(prefixed(key))
            return raw === null ? undefined : parse<T>(key, raw)
        },

        setItem: async <T>(key: string, value: T) => {
            keyValueStorage.setItem(prefixed(key), JSON.stringify(value))
        },

        removeItem: async (key: string) => {
            keyValueStorage.removeItem(prefixed(key))
        },
    }
}
