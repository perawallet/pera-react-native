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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    waitForStoreHydration,
    type HydratableStore,
} from '../waitForStoreHydration'

const createStore = (hasHydrated: boolean) => {
    const callbacks: Array<() => void> = []
    const unsubscribe = vi.fn()
    const store: HydratableStore = {
        persist: {
            hasHydrated: () => hasHydrated,
            onFinishHydration: (callback: () => void) => {
                callbacks.push(callback)
                return unsubscribe
            },
        },
    }
    return { store, callbacks, unsubscribe }
}

describe('waitForStoreHydration', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    test('resolves immediately when the store is already hydrated', async () => {
        const { store, callbacks } = createStore(true)

        await expect(
            waitForStoreHydration(store, 2000),
        ).resolves.toBeUndefined()
        expect(callbacks).toHaveLength(0)
    })

    test('resolves once hydration finishes, and unsubscribes', async () => {
        const { store, callbacks, unsubscribe } = createStore(false)
        const pending = waitForStoreHydration(store, 2000)

        callbacks[0]()

        await expect(pending).resolves.toBeUndefined()
        expect(unsubscribe).toHaveBeenCalled()
    })

    test('resolves on timeout when hydration never finishes', async () => {
        const { store, unsubscribe } = createStore(false)
        const pending = waitForStoreHydration(store, 2000)

        await vi.advanceTimersByTimeAsync(2000)

        await expect(pending).resolves.toBeUndefined()
        expect(unsubscribe).toHaveBeenCalled()
    })

    test('a late hydration callback after the timeout does not re-resolve', async () => {
        const { store, callbacks } = createStore(false)
        const pending = waitForStoreHydration(store, 2000)

        await vi.advanceTimersByTimeAsync(2000)
        await pending

        expect(() => callbacks[0]()).not.toThrow()
    })
})
