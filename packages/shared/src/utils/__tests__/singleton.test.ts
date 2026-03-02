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

import { describe, it, expect, beforeEach } from 'vitest'
import { getProvider, initializeProvider, resetProvider } from '../singleton'

describe('Provider singleton', () => {
    beforeEach(() => {
        resetProvider()
    })

    describe('getProvider', () => {
        it('should throw when provider is not initialized', () => {
            expect(() => getProvider()).toThrow(
                'Provider not initialized. Call initializeProvider() during bootstrap.',
            )
        })

        it('should return the provider after initialization', () => {
            const provider = { id: 'test', name: 'Test Provider' }
            initializeProvider(provider)

            expect(getProvider()).toBe(provider)
        })

        it('should return the same instance on subsequent calls', () => {
            const provider = { id: 'test', name: 'Test Provider' }
            initializeProvider(provider)

            expect(getProvider()).toBe(getProvider())
        })
    })

    describe('initializeProvider', () => {
        it('should set the provider singleton', () => {
            const provider = { id: 'test', name: 'Test Provider' }

            initializeProvider(provider)

            expect(getProvider()).toBe(provider)
        })

        it('should throw when called twice', () => {
            const provider = { id: 'test', name: 'Test Provider' }
            initializeProvider(provider)

            expect(() =>
                initializeProvider({ id: 'test2', name: 'Test 2' }),
            ).toThrow('Provider already initialized.')
        })
    })

    describe('resetProvider', () => {
        it('should clear the singleton so getProvider throws again', () => {
            const provider = { id: 'test', name: 'Test Provider' }
            initializeProvider(provider)
            expect(getProvider()).toBe(provider)

            resetProvider()

            expect(() => getProvider()).toThrow('Provider not initialized.')
        })

        it('should allow re-initialization after reset', () => {
            const provider1 = { id: 'test1', name: 'Test 1' }
            initializeProvider(provider1)
            resetProvider()

            const provider2 = { id: 'test2', name: 'Test 2' }
            initializeProvider(provider2)

            expect(getProvider()).toBe(provider2)
        })
    })
})
