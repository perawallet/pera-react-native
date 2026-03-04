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

import { logger } from './logging'

interface RegisteredStore {
    name: string
    clearStorage: () => void
    resetState: () => void
}

const registry: RegisteredStore[] = []

/**
 * Registers a store for global lifecycle management.
 * Called by each store at module scope after creation.
 */
export const registerStore = (entry: RegisteredStore): void => {
    registry.push(entry)
    logger.debug(`Registered store: ${entry.name}`)
}

/**
 * Clears persisted data and resets in-memory state for all registered stores.
 * Used during logout / "delete all data" flows.
 */
export const clearAllStores = (): void => {
    for (const store of registry) {
        logger.debug(`Clearing store: ${store.name}`)
        store.clearStorage()
        store.resetState()
        logger.debug(`Store ${store.name} cleared`)
    }
}

/**
 * Returns a read-only view of all registered stores.
 */
export const getStoreRegistry = (): ReadonlyArray<RegisteredStore> => registry

/**
 * Resets the registry. For testing only.
 */
export const resetStoreRegistry = (): void => {
    registry.length = 0
}
