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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    ChainAdapterNotRegisteredError,
    DuplicateChainAdapterError,
} from '../errors'
import type { ChainId } from '../models/identity'
import { createChainAdapterRegistry } from '../registry'

type TestAdapter = { chainId: ChainId; label: string }

describe('createChainAdapterRegistry', () => {
    const registry = createChainAdapterRegistry<TestAdapter>('swaps')

    beforeEach(() => {
        registry.reset()
    })

    it('returns the adapter registered for a chain', () => {
        const adapter: TestAdapter = { chainId: 'algorand', label: 'a' }

        registry.register(adapter)

        expect(registry.has('algorand')).toBe(true)
        expect(registry.get('algorand')).toBe(adapter)
    })

    it('throws a typed error naming the feature and chain when nothing is registered', () => {
        expect(registry.has('algorand')).toBe(false)

        let caught: unknown
        try {
            registry.get('algorand')
        } catch (error) {
            caught = error
        }

        expect(caught).toBeInstanceOf(ChainAdapterNotRegisteredError)
        const error = caught as ChainAdapterNotRegisteredError
        expect(error.name).toBe('ChainAdapterNotRegisteredError')
        expect(error.feature).toBe('swaps')
        expect(error.chainId).toBe('algorand')
        expect(error.message).toBe(
            'No swaps adapter is registered for chain "algorand"',
        )
    })

    it('treats registering the same instance again as a no-op', () => {
        const adapter: TestAdapter = { chainId: 'algorand', label: 'a' }
        registry.register(adapter)

        expect(() => registry.register(adapter)).not.toThrow()
        expect(registry.get('algorand')).toBe(adapter)
    })

    it('rejects a different instance for an already registered chain and keeps the first', () => {
        const first: TestAdapter = { chainId: 'algorand', label: 'a' }
        const second: TestAdapter = { chainId: 'algorand', label: 'a' }
        registry.register(first)

        let caught: unknown
        try {
            registry.register(second)
        } catch (error) {
            caught = error
        }

        expect(caught).toBeInstanceOf(DuplicateChainAdapterError)
        const error = caught as DuplicateChainAdapterError
        expect(error.name).toBe('DuplicateChainAdapterError')
        expect(error.feature).toBe('swaps')
        expect(error.chainId).toBe('algorand')
        expect(registry.get('algorand')).toBe(first)
    })

    it('forgets every registration on reset', () => {
        registry.register({ chainId: 'algorand', label: 'a' })

        registry.reset()

        expect(registry.has('algorand')).toBe(false)
    })

    it('keeps registries for different features independent', () => {
        const other = createChainAdapterRegistry<TestAdapter>('staking')
        registry.register({ chainId: 'algorand', label: 'a' })

        expect(other.has('algorand')).toBe(false)
    })
})
