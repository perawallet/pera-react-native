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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSigningStore } from '../index'
import {
    isResumableRehydratedRequest,
    migrateSigningState,
    rehydrateSigningStore,
    wasRestoredFromStorage,
} from '../store'
import { makeUnsignedTransaction } from '../../__tests__/transactions'
import type { SignRequest } from '../../models'

const { mockStorage } = vi.hoisted(() => ({
    mockStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: mockStorage,
    }),
}))

describe('SigningStore', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useSigningStore.getState().resetState()
    })

    test('should return true when adding a new request', () => {
        const { result } = renderHook(() => useSigningStore())
        const request: SignRequest = {
            id: 'test-id',
            txs: [],
            type: 'transactions',
            transport: 'algod',
        }

        let added = false
        act(() => {
            added = result.current.addSignRequest(request)
        })

        expect(added).toBe(true)
    })

    test('should return false when adding duplicate request', () => {
        const { result } = renderHook(() => useSigningStore())
        const request: SignRequest = {
            id: 'test-id',
            txs: [],
            type: 'transactions',
            transport: 'algod',
        }

        act(() => {
            result.current.addSignRequest(request)
        })

        let added = true
        act(() => {
            added = result.current.addSignRequest(request)
        })

        expect(added).toBe(false)
    })

    test('should handle adding request without id', () => {
        const { result } = renderHook(() => useSigningStore())
        const request: SignRequest = {
            txs: [],
            type: 'transactions',
            transport: 'algod',
        } as unknown as SignRequest

        act(() => {
            result.current.addSignRequest(request)
        })

        expect(result.current.pendingSignRequests).toHaveLength(1)
        expect(result.current.pendingSignRequests[0].id).toBeDefined()
    })

    test('should remove a sign request', () => {
        const { result } = renderHook(() => useSigningStore())
        const request: SignRequest = {
            id: 'test-id',
            txs: [],
            type: 'transactions',
            transport: 'algod',
        }

        act(() => {
            result.current.addSignRequest(request)
        })

        expect(result.current.pendingSignRequests).toHaveLength(1)

        let removed = false
        act(() => {
            removed = result.current.removeSignRequest(request)
        })

        expect(removed).toBe(true)
        expect(result.current.pendingSignRequests).toHaveLength(0)
    })

    test('should return false when removing non-existent request', () => {
        const { result } = renderHook(() => useSigningStore())
        const request: SignRequest = {
            id: 'test-id',
            txs: [],
            type: 'transactions',
            transport: 'algod',
        }

        let removed = true
        act(() => {
            removed = result.current.removeSignRequest(request)
        })

        expect(removed).toBe(false)
    })

    test('should filter out callback requests from persistence', async () => {
        await rehydrateSigningStore({ unstampedRequestChainId: 'algorand' })
        const { result } = renderHook(() => useSigningStore())

        act(() => {
            result.current.addSignRequest({
                id: '1',
                transport: 'algod',
                txs: [],
                type: 'transactions',
            })
            result.current.addSignRequest({
                id: '2',
                transport: 'callback',
                txs: [],
                type: 'transactions',
            })
        })

        expect(result.current.pendingSignRequests).toHaveLength(2)

        const setItemCalls = mockStorage.setItem.mock.calls
        const lastCall = setItemCalls[setItemCalls.length - 1]

        expect(lastCall).toBeDefined()
        const [key, value] = lastCall
        expect(key).toBe('signing-store')

        const storedValue = JSON.parse(value)
        expect(storedValue.state.pendingSignRequests).toHaveLength(1)
        expect(storedValue.state.pendingSignRequests[0].id).toBe('1')
    })

    test('should reset state to initial values', () => {
        const { result } = renderHook(() => useSigningStore())

        act(() => {
            result.current.addSignRequest({ id: '1' } as any)
        })

        expect(result.current.pendingSignRequests).toHaveLength(1)

        act(() => {
            result.current.resetState()
        })

        expect(result.current.pendingSignRequests).toEqual([])
    })

    test('marks rehydrated requests as restored from storage', async () => {
        mockStorage.getItem.mockReturnValueOnce(
            JSON.stringify({
                state: {
                    pendingSignRequests: [
                        {
                            id: 'restored-1',
                            type: 'transaction',
                            transport: 'algod',
                            sourceType: 'walletconnect',
                            txs: [],
                        },
                    ],
                },
                version: 1,
            }),
        )
        await rehydrateSigningStore({ unstampedRequestChainId: 'algorand' })

        // Drives the re-presentation guard: only these ids pay for a ledger
        // read before an approval sheet re-opens.
        expect(wasRestoredFromStorage('restored-1')).toBe(true)
        expect(wasRestoredFromStorage('fresh-1')).toBe(false)
    })

    test('stamps a request persisted before requests named their chain with the chain the caller names', async () => {
        mockStorage.getItem.mockReturnValueOnce(
            JSON.stringify({
                state: {
                    pendingSignRequests: [
                        {
                            id: 'unstamped-1',
                            type: 'transactions',
                            transport: 'algod',
                            sourceType: 'multisig-cosign',
                            txs: [],
                        },
                    ],
                },
                version: 1,
            }),
        )

        await rehydrateSigningStore({ unstampedRequestChainId: 'algorand' })

        expect(useSigningStore.getState().pendingSignRequests).toEqual([
            expect.objectContaining({
                id: 'unstamped-1',
                chainId: 'algorand',
            }),
        ])
    })

    test('boots with default state when persisted JSON is malformed', async () => {
        mockStorage.getItem.mockReturnValueOnce('{ not valid json')
        await useSigningStore.persist.rehydrate()
        expect(useSigningStore.getState().pendingSignRequests).toEqual([])
    })

    test('boots with default state when a persisted bigint tag is malformed', async () => {
        mockStorage.getItem.mockReturnValueOnce(
            '{"state":{"pendingSignRequests":[{"id":"1","amount":"__bigint__nope"}]},"version":1}',
        )
        await useSigningStore.persist.rehydrate()
        expect(useSigningStore.getState().pendingSignRequests).toEqual([])
    })
})

describe('SigningStore writes before hydration', () => {
    const request = (id: string): SignRequest => ({
        id,
        chainId: 'algorand',
        txs: [],
        type: 'transactions',
        transport: 'algod',
        sourceType: 'multisig-cosign',
    })
    const persisted = JSON.stringify({
        state: { pendingSignRequests: [request('persisted')] },
        version: 1,
    })

    const loadStore = async () => {
        vi.resetModules()
        vi.clearAllMocks()
        return import('../store')
    }

    test('drops a write made before hydration, and persists the ones after it', async () => {
        const store = await loadStore()

        store.useSigningStore.getState().addSignRequest(request('early'))

        expect(mockStorage.setItem).not.toHaveBeenCalled()

        mockStorage.getItem.mockReturnValueOnce(persisted)
        await store.rehydrateSigningStore({
            unstampedRequestChainId: 'algorand',
        })
        mockStorage.setItem.mockClear()
        store.useSigningStore.getState().addSignRequest(request('late'))

        expect(mockStorage.setItem).toHaveBeenCalledWith(
            'signing-store',
            expect.stringContaining('late'),
        )
    })

    test('leaves storage untouched, keeps dropping writes and logs, when the migration throws', async () => {
        const store = await loadStore()
        const { logger } = await import('@perawallet/wallet-core-shared')
        const logError = vi.spyOn(logger, 'error').mockImplementation(() => {})
        mockStorage.getItem.mockReturnValueOnce(persisted)
        store.useSigningStore.persist.setOptions({
            migrate: () => {
                throw new Error('migration broke')
            },
        })

        await store.useSigningStore.persist.rehydrate()
        store.useSigningStore.getState().addSignRequest(request('after'))

        expect(store.useSigningStore.persist.hasHydrated()).toBe(false)
        expect(mockStorage.setItem).not.toHaveBeenCalled()
        expect(mockStorage.removeItem).not.toHaveBeenCalled()
        expect(logError).toHaveBeenCalledWith(
            'Signing store hydration failed; the persisted state is left untouched',
            { error: expect.any(Error) },
        )
    })
})

describe('migrateSigningState', () => {
    const unstamped = {
        id: 'u',
        type: 'transactions',
        transport: 'algod',
        sourceType: 'multisig-cosign',
        txs: [],
    }

    test('stamps every unstamped request with the named chain', () => {
        expect(
            migrateSigningState(
                { pendingSignRequests: [unstamped] },
                'algorand',
            ).pendingSignRequests,
        ).toEqual([{ ...unstamped, chainId: 'algorand' }])
    })

    test('keeps a stamped request and a chain-neutral request as stored', () => {
        const stamped = { ...unstamped, id: 's', chainId: 'ethereum' }
        const neutral = {
            ...unstamped,
            id: 'n',
            txs: [makeUnsignedTransaction('0xFROM')],
        }

        expect(
            migrateSigningState(
                { pendingSignRequests: [stamped, neutral] },
                'algorand',
            ).pendingSignRequests,
        ).toEqual([stamped, neutral])
    })

    test('drops an unstamped request when no chain is named', () => {
        expect(
            migrateSigningState({ pendingSignRequests: [unstamped] })
                .pendingSignRequests,
        ).toEqual([])
    })
})

describe('isResumableRehydratedRequest', () => {
    const base = {
        id: '1',
        type: 'transactions',
        transport: 'algod',
        chainId: 'algorand',
    }

    test('drops a request that names no chain', () => {
        const { chainId: _chainId, ...unstamped } = base
        expect(
            isResumableRehydratedRequest({
                ...unstamped,
                sourceType: 'multisig-cosign',
            }),
        ).toBe(false)
    })

    test('keeps a chain-neutral request, whose transactions name their scope', () => {
        const { chainId: _chainId, ...unstamped } = base
        expect(
            isResumableRehydratedRequest({
                ...unstamped,
                sourceType: 'multisig-cosign',
                txs: [makeUnsignedTransaction('0xFROM')],
            }),
        ).toBe(true)
    })

    test('keeps a well-formed interactive (multisig-cosign) request', () => {
        expect(
            isResumableRehydratedRequest({
                ...base,
                sourceType: 'multisig-cosign',
            }),
        ).toBe(true)
    })

    test('drops a headless request (sourceType "local") so it cannot auto-sign on cold start', () => {
        expect(
            isResumableRehydratedRequest({ ...base, sourceType: 'local' }),
        ).toBe(false)
    })

    test('drops a request with no sourceType (headless by default)', () => {
        expect(isResumableRehydratedRequest({ ...base })).toBe(false)
    })

    test('drops an ephemeral deeplink request', () => {
        expect(
            isResumableRehydratedRequest({ ...base, sourceType: 'deeplink' }),
        ).toBe(false)
    })

    test('drops a crafted callback-transport request (callbacks cannot survive serialization)', () => {
        expect(
            isResumableRehydratedRequest({
                ...base,
                transport: 'callback',
                sourceType: 'walletconnect',
            }),
        ).toBe(false)
    })

    test('drops malformed entries (missing id / wrong shape)', () => {
        expect(
            isResumableRehydratedRequest({
                type: 'transactions',
                transport: 'algod',
                sourceType: 'multisig-cosign',
            }),
        ).toBe(false)
        expect(isResumableRehydratedRequest(null)).toBe(false)
        expect(isResumableRehydratedRequest('nope')).toBe(false)
    })
})
