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

// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const registerStoreMock = vi.hoisted(() => vi.fn())
const persisted = vi.hoisted(() => new Map<string, string>())

vi.mock('@perawallet/wallet-extension-provider', () => {
    const store = persisted
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

const cursor = (overrides: Record<string, number | null> = {}) => ({
    refreshRound: null,
    lastAssetSyncAt: null,
    lastPriceSyncAt: null,
    ...overrides,
})

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const

describe('polling/store - useSyncCursorStore', () => {
    beforeEach(() => {
        vi.resetModules()
        persisted.clear()
    })

    test('starts with no cursors, so every scope reads as never synced', async () => {
        const { useSyncCursorStore } = await import('../store')

        const { result } = renderHook(() => useSyncCursorStore(s => s.cursors))

        expect(result.current).toEqual({})
    })

    test('setRefreshRound writes each scope under its own scope key', async () => {
        const { useSyncCursorStore } = await import('../store')
        const { setRefreshRound } = useSyncCursorStore.getState()

        act(() => {
            setRefreshRound(MAINNET, 100)
            setRefreshRound(TESTNET, 200)
            setRefreshRound(ETHEREUM, 300)
        })
        act(() => {
            setRefreshRound(MAINNET, null)
        })

        expect(useSyncCursorStore.getState().cursors).toEqual({
            'algorand/mainnet': cursor(),
            'algorand/testnet': cursor({ refreshRound: 200 }),
            'ethereum/mainnet': cursor({ refreshRound: 300 }),
        })
    })

    test('markSynced records each kind in its own field without touching the round', async () => {
        const { useSyncCursorStore } = await import('../store')
        const { setRefreshRound, markSynced } = useSyncCursorStore.getState()

        act(() => {
            setRefreshRound(MAINNET, 100)
            markSynced(MAINNET, 'assets', 1000)
            markSynced(MAINNET, 'prices', 2000)
            markSynced(TESTNET, 'prices', 3000)
        })

        expect(useSyncCursorStore.getState().cursors).toEqual({
            'algorand/mainnet': cursor({
                refreshRound: 100,
                lastAssetSyncAt: 1000,
                lastPriceSyncAt: 2000,
            }),
            'algorand/testnet': cursor({ lastPriceSyncAt: 3000 }),
        })
    })

    test("switching away and back leaves the first scope's cursor intact", async () => {
        const { useSyncCursorStore } = await import('../store')
        const { setRefreshRound, markSynced } = useSyncCursorStore.getState()

        act(() => {
            setRefreshRound(MAINNET, 100)
            markSynced(MAINNET, 'prices', 2000)
        })
        act(() => {
            setRefreshRound(TESTNET, 500)
            markSynced(TESTNET, 'prices', 9000)
        })

        expect(
            useSyncCursorStore.getState().cursors['algorand/mainnet'],
        ).toEqual(cursor({ refreshRound: 100, lastPriceSyncAt: 2000 }))
    })

    test('persists the cursors and rehydrates them into a fresh store', async () => {
        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        const { useSyncCursorStore } = await import('../store')

        act(() => {
            useSyncCursorStore.getState().setRefreshRound(MAINNET, 100)
            useSyncCursorStore.getState().markSynced(MAINNET, 'assets', 1000)
        })

        expect(
            JSON.parse(
                getProvider().keyValueStorage.getItem(
                    'polling-store',
                ) as string,
            ),
        ).toEqual({
            state: {
                cursors: {
                    'algorand/mainnet': cursor({
                        refreshRound: 100,
                        lastAssetSyncAt: 1000,
                    }),
                },
            },
            version: 2,
        })
    })

    test('resetState drops every cursor', async () => {
        const { useSyncCursorStore } = await import('../store')

        act(() => {
            useSyncCursorStore.getState().setRefreshRound(MAINNET, 100)
            useSyncCursorStore.getState().markSynced(TESTNET, 'prices', 1)
        })
        act(() => {
            useSyncCursorStore.getState().resetState()
        })

        expect(useSyncCursorStore.getState().cursors).toEqual({})
    })

    test('persists under the polling-store key so existing installs rehydrate', async () => {
        const { useSyncCursorStore } = await import('../store')

        expect(useSyncCursorStore.persist.getOptions().name).toBe(
            'polling-store',
        )
    })

    test('registers resetState and clearStorage callbacks with the store registry', async () => {
        const { useSyncCursorStore } = await import('../store')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('polling-store')

        act(() => {
            useSyncCursorStore.getState().setRefreshRound(MAINNET, 42)
        })
        act(() => registration.resetState())
        expect(useSyncCursorStore.getState().cursors).toEqual({})
        expect(() => registration.clearStorage()).not.toThrow()
    })

    test('hydrates an unversioned store keyed by bare network into scoped cursors', async () => {
        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        const { useSyncCursorStore } = await import('../store')
        getProvider().keyValueStorage.setItem(
            'polling-store',
            JSON.stringify({
                state: { lastRefreshedRound: { mainnet: 100, testnet: null } },
                version: 0,
            }),
        )

        await useSyncCursorStore.persist.rehydrate()

        expect(useSyncCursorStore.getState().cursors).toEqual({
            'algorand/mainnet': cursor({ refreshRound: 100 }),
        })
    })

    test('hydrates a v1 scope-keyed round map into scoped cursors', async () => {
        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        const { useSyncCursorStore } = await import('../store')
        getProvider().keyValueStorage.setItem(
            'polling-store',
            JSON.stringify({
                state: {
                    lastRefreshedRound: {
                        'algorand/mainnet': 100,
                        'algorand/testnet': 200,
                    },
                },
                version: 1,
            }),
        )

        await useSyncCursorStore.persist.rehydrate()

        expect(useSyncCursorStore.getState().cursors).toEqual({
            'algorand/mainnet': cursor({ refreshRound: 100 }),
            'algorand/testnet': cursor({ refreshRound: 200 }),
        })
    })
})

describe('polling/store - migrateSyncCursorState', () => {
    test('re-keys v0 rounds by scope key and folds them into cursors', async () => {
        const { migrateSyncCursorState } = await import('../store')

        expect(
            migrateSyncCursorState(
                { lastRefreshedRound: { mainnet: 100, testnet: 200 } },
                0,
            ),
        ).toEqual({
            cursors: {
                'algorand/mainnet': cursor({ refreshRound: 100 }),
                'algorand/testnet': cursor({ refreshRound: 200 }),
            },
        })
    })

    test('folds v1 rounds into cursors, dropping never-synced scopes', async () => {
        const { migrateSyncCursorState } = await import('../store')

        expect(
            migrateSyncCursorState(
                {
                    lastRefreshedRound: {
                        'algorand/mainnet': 7,
                        'algorand/testnet': null,
                    },
                },
                1,
            ),
        ).toEqual({
            cursors: { 'algorand/mainnet': cursor({ refreshRound: 7 }) },
        })
    })

    test('yields empty cursors for a missing persisted state', async () => {
        const { migrateSyncCursorState } = await import('../store')

        expect(migrateSyncCursorState(undefined, 1)).toEqual({ cursors: {} })
    })

    test('leaves v2 state untouched', async () => {
        const { migrateSyncCursorState } = await import('../store')
        const state = {
            cursors: { 'algorand/mainnet': cursor({ refreshRound: 7 }) },
        }

        expect(migrateSyncCursorState(state, 2)).toEqual(state)
    })
})
