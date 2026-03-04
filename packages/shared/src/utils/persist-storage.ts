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

/**
 * Returns the platform's keyValueStorage via the platform driver.
 *
 * Uses `require()` to avoid a static dependency on the driver package
 * (which would create a turbo build cycle: shared → platform-driver →
 * platform → shared). At runtime the bundler (Metro) aliases the driver
 * to the concrete platform extension, so the call always succeeds.
 */
declare const require: (id: string) => {
    getPlatformServices: () => { keyValueStorage: StateStorage }
}

// Uses require() instead of a static import to avoid a circular turbo build
// dependency (shared → platform-driver → platform → shared).
// At runtime, Metro aliases the driver to the concrete platform extension
// (e.g. platform-react-native), so the call always resolves.
const getKeyValueStorage = (): StateStorage =>
    require('@perawallet/wallet-extension-platform-driver').getPlatformServices()
        .keyValueStorage

/**
 * Creates a storage adapter backed by the platform's keyValueStorage.
 *
 * Each method lazily resolves the storage via the platform driver, so the
 * driver only needs to be available when `getItem`/`setItem`/`removeItem`
 * are actually called (Zustand persist invokes them asynchronously).
 */
export const createPersistStorage = (): StateStorage => ({
    getItem: (key: string) => getKeyValueStorage().getItem(key),
    setItem: (key: string, value: string) =>
        getKeyValueStorage().setItem(key, value),
    removeItem: (key: string) => getKeyValueStorage().removeItem(key),
})
