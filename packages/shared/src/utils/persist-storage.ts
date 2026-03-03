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

import type { StateStorage } from 'zustand/middleware'
import { getProvider } from './singleton'

/**
 * Creates a lazy storage adapter backed by the provider's keyValueStorage.
 *
 * Each method delegates to `getProvider().keyValueStorage` at call time,
 * so the returned object is safe to construct at module scope — before
 * the provider has been initialized.
 *
 * Zustand's `createJSONStorage` invokes the factory eagerly, but the
 * proxy defers the actual provider access until the first read/write,
 * which happens after bootstrap.
 */
export const createPersistStorage = (): StateStorage => ({
    getItem: (key: string) =>
        getProvider<{
            keyValueStorage: StateStorage
        }>().keyValueStorage.getItem(key),
    setItem: (key: string, value: string) =>
        getProvider<{
            keyValueStorage: StateStorage
        }>().keyValueStorage.setItem(key, value),
    removeItem: (key: string) =>
        getProvider<{
            keyValueStorage: StateStorage
        }>().keyValueStorage.removeItem(key),
})
