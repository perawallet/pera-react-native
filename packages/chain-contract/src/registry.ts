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
    ChainAdapterNotRegisteredError,
    DuplicateChainAdapterError,
} from './errors'
import type { ChainId } from './models/identity'

export interface ChainAdapterRegistry<T extends { chainId: ChainId }> {
    register(adapter: T): void
    /** @throws ChainAdapterNotRegisteredError */
    get(chainId: ChainId): T
    has(chainId: ChainId): boolean
    /** Test-only: drops every registration. */
    reset(): void
}

/**
 * One registry per feature, keyed by the adapter's `chainId`. Registering the
 * same instance again is a no-op so a repeated bootstrap stays safe; a
 * different instance throws rather than silently replacing a live adapter.
 */
export const createChainAdapterRegistry = <T extends { chainId: ChainId }>(
    feature: string,
): ChainAdapterRegistry<T> => {
    const adapters = new Map<ChainId, T>()

    return {
        register: adapter => {
            const existing = adapters.get(adapter.chainId)
            if (existing === adapter) {
                return
            }
            if (existing) {
                throw new DuplicateChainAdapterError(feature, adapter.chainId)
            }
            adapters.set(adapter.chainId, adapter)
        },
        get: chainId => {
            const adapter = adapters.get(chainId)
            if (!adapter) {
                throw new ChainAdapterNotRegisteredError(feature, chainId)
            }
            return adapter
        },
        has: chainId => adapters.has(chainId),
        reset: () => {
            adapters.clear()
        },
    }
}
