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

import { describe, test, expect } from 'vitest'
import { createLazyStore } from '../store'
import { create, StoreApi } from 'zustand'

interface TestState {
    count: number
    increment: () => void
}

describe('utils/store', () => {
    describe('createLazyStore', () => {
        test('throws error when used before initialization', () => {
            const lazy = createLazyStore<StoreApi<TestState>>('test')

            expect(() => {
                lazy.useStore((state: TestState) => state.count)
            }).toThrow('Zustand store test used in useStore before initialization')
        })

        test('initializes without error', () => {
            const lazy = createLazyStore<StoreApi<TestState>>('test')
            const testStore = create<TestState>(set => ({
                count: 0,
                increment: () => set(state => ({ count: state.count + 1 })),
            }))

            // Should not throw
            expect(() => lazy.init(testStore, vi.fn())).not.toThrow()
        })

        test('calls resetState when cleared', () => {
            const lazy = createLazyStore<StoreApi<TestState>>('test')
            const resetState = vi.fn()
            const testStore = create<TestState>(set => ({
                count: 0,
                increment: () => set(state => ({ count: state.count + 1 })),
            }))

            lazy.init(testStore, resetState)
            lazy.clear()

            expect(resetState).toHaveBeenCalledTimes(1)
        })
    })
})
