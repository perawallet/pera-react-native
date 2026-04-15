/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { MmkvLike } from './types'

/**
 * Structural subset of the `KeyValueStorageService` interface defined in
 * `@perawallet/wallet-extension-platform`. We re-declare it here instead
 * of importing it because the collections layer must stay independent of
 * the platform/extension packages — the adapter is driven by whatever
 * key-value store the host app hands over at bootstrap.
 */
export interface KeyValueStorageLike {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
    getAllKeys(): string[]
}

/**
 * Adapt a platform `KeyValueStorageService`-shaped object into the
 * `MmkvLike` surface the MMKV adapter expects. The difference is
 * cosmetic (method naming + `null` vs `undefined` for missing values),
 * so the adaptation is a trivial one-liner — but centralizing it here
 * means `App.tsx` can call `bootstrapCollections({ mmkv: fromKeyValueStorage(kvs) })`
 * without reaching into RN-specific MMKV internals.
 */
export function fromKeyValueStorage(kvs: KeyValueStorageLike): MmkvLike {
    return {
        set: (key, value) => kvs.setItem(key, value),
        getString: key => kvs.getItem(key) ?? undefined,
        delete: key => kvs.removeItem(key),
        getAllKeys: () => kvs.getAllKeys(),
    }
}
