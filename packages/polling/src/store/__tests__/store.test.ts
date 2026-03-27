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

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

describe('services/polling/store', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('store initializes with default values', async () => {
        const { usePollingStore } = await import('../store')

        const { result } = renderHook(() => usePollingStore())

        expect(result.current.lastRefreshedRound).toEqual({
            mainnet: null,
            testnet: null,
        })
    })

    test('setLastRefreshedRound updates the state per network', async () => {
        const { usePollingStore } = await import('../store')

        const { result } = renderHook(() => usePollingStore())

        act(() => {
            result.current.setLastRefreshedRound('mainnet', 100)
        })

        expect(result.current.lastRefreshedRound).toEqual({
            mainnet: 100,
            testnet: null,
        })

        act(() => {
            result.current.setLastRefreshedRound('testnet', 200)
        })

        expect(result.current.lastRefreshedRound).toEqual({
            mainnet: 100,
            testnet: 200,
        })

        act(() => {
            result.current.setLastRefreshedRound('mainnet', null)
        })

        expect(result.current.lastRefreshedRound).toEqual({
            mainnet: null,
            testnet: 200,
        })
    })
})
