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
import { isResumableRehydratedRequest } from '../store'
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

    test('should filter out callback requests from persistence', () => {
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

describe('isResumableRehydratedRequest', () => {
    const base = { id: '1', type: 'transactions', transport: 'algod' }

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
