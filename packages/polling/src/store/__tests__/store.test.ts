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

const registerStoreMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: registerStoreMock,
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

    test('resetState reverts lastRefreshedRound to the initial defaults', async () => {
        const { usePollingStore } = await import('../store')
        const { result } = renderHook(() => usePollingStore())

        act(() => {
            result.current.setLastRefreshedRound('mainnet', 100)
            result.current.setLastRefreshedRound('testnet', 200)
        })
        act(() => {
            result.current.resetState()
        })

        expect(result.current.lastRefreshedRound).toEqual({
            mainnet: null,
            testnet: null,
        })
    })

    test('registers resetState and clearStorage callbacks with the store registry', async () => {
        const { usePollingStore } = await import('../store')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('polling-store')

        act(() => {
            usePollingStore.getState().setLastRefreshedRound('mainnet', 42)
        })
        act(() => registration.resetState())
        expect(usePollingStore.getState().lastRefreshedRound).toEqual({
            mainnet: null,
            testnet: null,
        })
        expect(() => registration.clearStorage()).not.toThrow()
    })
})
