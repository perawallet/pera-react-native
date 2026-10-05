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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const registerStoreMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-extension-provider', () => {
    const store = new Map<string, string>()
    return {
        getProvider: () => ({
            keyValueStorage: {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => store.set(key, value),
                removeItem: (key: string) => {
                    store.delete(key)
                },
            },
        }),
    }
})

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
            'algorand/mainnet': null,
            'algorand/testnet': null,
        })
    })

    test('setLastRefreshedRound updates the state per network', async () => {
        const { usePollingStore } = await import('../store')

        const { result } = renderHook(() => usePollingStore())

        act(() => {
            result.current.setLastRefreshedRound('mainnet', 100)
        })

        expect(result.current.lastRefreshedRound).toEqual({
            'algorand/mainnet': 100,
            'algorand/testnet': null,
        })

        act(() => {
            result.current.setLastRefreshedRound('testnet', 200)
        })

        expect(result.current.lastRefreshedRound).toEqual({
            'algorand/mainnet': 100,
            'algorand/testnet': 200,
        })

        act(() => {
            result.current.setLastRefreshedRound('mainnet', null)
        })

        expect(result.current.lastRefreshedRound).toEqual({
            'algorand/mainnet': null,
            'algorand/testnet': 200,
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
            'algorand/mainnet': null,
            'algorand/testnet': null,
        })
    })

    test('persists under the polling-store key so existing installs rehydrate', async () => {
        const { usePollingStore } = await import('../store')

        expect(usePollingStore.persist.getOptions().name).toBe('polling-store')
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
            'algorand/mainnet': null,
            'algorand/testnet': null,
        })
        expect(() => registration.clearStorage()).not.toThrow()
    })

    test('hydrates an unversioned store keyed by bare network under scope keys', async () => {
        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        const { usePollingStore } = await import('../store')
        getProvider().keyValueStorage.setItem(
            'polling-store',
            JSON.stringify({
                state: { lastRefreshedRound: { mainnet: 100, testnet: null } },
                version: 0,
            }),
        )

        await usePollingStore.persist.rehydrate()

        expect(usePollingStore.getState().lastRefreshedRound).toEqual({
            'algorand/mainnet': 100,
            'algorand/testnet': null,
        })
    })
})

describe('services/polling/store - migratePollingState', () => {
    test('re-keys v0 rounds by scope key, values unchanged', async () => {
        const { migratePollingState } = await import('../store')

        expect(
            migratePollingState(
                { lastRefreshedRound: { mainnet: 100, testnet: 200 } },
                0,
            ),
        ).toEqual({
            lastRefreshedRound: {
                'algorand/mainnet': 100,
                'algorand/testnet': 200,
            },
        })
    })

    test('leaves v1 state untouched', async () => {
        const { migratePollingState } = await import('../store')
        const state = { lastRefreshedRound: { 'algorand/mainnet': 7 } }

        expect(migratePollingState(state, 1)).toEqual(state)
    })
})
