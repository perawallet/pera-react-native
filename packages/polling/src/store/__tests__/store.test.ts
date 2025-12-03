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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { registerTestPlatform } from '@test-utils'

describe('services/polling/store', () => {
    beforeEach(() => {
        vi.resetModules()
        registerTestPlatform()
    })

    test('initPollingStore initializes the store', async () => {
        const { initPollingStore, usePollingStore } = await import('../store')

        initPollingStore()

        const { result } = renderHook(() => usePollingStore())

        expect(result.current.lastRefreshedRound).toBeNull()
    })

    test('setLastRefreshedRound updates the state', async () => {
        const { initPollingStore, usePollingStore } = await import('../store')

        initPollingStore()

        const { result } = renderHook(() => usePollingStore())

        act(() => {
            result.current.setLastRefreshedRound(100)
        })

        expect(result.current.lastRefreshedRound).toBe(100)

        act(() => {
            result.current.setLastRefreshedRound(null)
        })

        expect(result.current.lastRefreshedRound).toBeNull()
    })
})
