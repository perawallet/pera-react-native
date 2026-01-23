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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBlockchainStore, initBlockchainStore } from '../index'
import { SignRequest } from '../../models'

// Mock the storage service
const mockStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
}

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useKeyValueStorageService: vi.fn(() => mockStorage),
}))

describe('BlockchainStore', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        initBlockchainStore()
    })

    test('should return true when adding a new request', () => {
        const { result } = renderHook(() => useBlockchainStore())
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
        const { result } = renderHook(() => useBlockchainStore())
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
        const { result } = renderHook(() => useBlockchainStore())
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
        const { result } = renderHook(() => useBlockchainStore())
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
        const { result } = renderHook(() => useBlockchainStore())
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
        const { result } = renderHook(() => useBlockchainStore())

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

        // Verify state has both
        expect(result.current.pendingSignRequests).toHaveLength(2)

        // Verify storage only has the non-callback one
        // Zustand persist might be async or immediate depending on config, but here we use synchronous JSON storage wrapper
        // We verify the last call to setItem
        const setItemCalls = mockStorage.setItem.mock.calls
        const lastCall = setItemCalls[setItemCalls.length - 1]

        expect(lastCall).toBeDefined()
        const [key, value] = lastCall
        expect(key).toBe('blockchain-store')

        const storedValue = JSON.parse(value)
        // Zustand wraps state in { state: ..., version: ... }
        expect(storedValue.state.pendingSignRequests).toHaveLength(1)
        expect(storedValue.state.pendingSignRequests[0].id).toBe('1')
    })

    test('should reset state to initial values', () => {
        const { result } = renderHook(() => useBlockchainStore())

        act(() => {
            result.current.addSignRequest({ id: '1' } as any)
        })

        expect(result.current.pendingSignRequests).toHaveLength(1)

        act(() => {
            result.current.resetState()
        })

        expect(result.current.pendingSignRequests).toEqual([])
    })
})
