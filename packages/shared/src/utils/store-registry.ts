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

export interface RegisterableStore {
    name: string
    init: () => void
    clear: () => void
}

class DataStoreRegistryImpl {
    private stores: Map<string, RegisterableStore> = new Map()
    private initialized = false

    register(store: RegisterableStore): void {
        if (this.stores.has(store.name)) {
            logger.warn(
                `Store "${store.name}" is already registered. Skipping.`,
            )
            return
        }
        this.stores.set(store.name, store)
        logger.debug(`Store "${store.name}" registered`)
    }

    async initializeAll(): Promise<void> {
        if (this.initialized) {
            logger.warn('DataStoreRegistry already initialized. Skipping.')
            return
        }

        logger.debug(
            `Initializing ${this.stores.size} stores: ${this.getRegisteredStores().join(', ')}`,
        )

        const initPromises = Array.from(this.stores.values()).map(
            async store => {
                try {
                    await Promise.resolve(store.init())
                } catch (error) {
                    logger.error(`Failed to initialize store "${store.name}"`, {
                        error,
                    })
                    throw error
                }
            },
        )

        await Promise.allSettled(initPromises)
        this.initialized = true
        logger.debug('All stores initialized')
    }

    async clearAll(): Promise<void> {
        logger.debug(
            `Clearing ${this.stores.size} stores: ${this.getRegisteredStores().join(', ')}`,
        )

        const clearPromises = Array.from(this.stores.values()).map(
            async store => {
                try {
                    await Promise.resolve(store.clear())
                    logger.debug(`Store "${store.name}" cleared`)
                } catch (error) {
                    logger.error(`Failed to clear store "${store.name}"`, {
                        error,
                    })
                    throw error
                }
            },
        )

        await Promise.allSettled(clearPromises)
        logger.debug('All stores cleared')
    }

    getRegisteredStores(): string[] {
        return Array.from(this.stores.keys())
    }

    reset(): void {
        this.stores.clear()
        this.initialized = false
        logger.debug('DataStoreRegistry reset')
    }

    isInitialized(): boolean {
        return this.initialized
    }
}

export const DataStoreRegistry = new DataStoreRegistryImpl()
