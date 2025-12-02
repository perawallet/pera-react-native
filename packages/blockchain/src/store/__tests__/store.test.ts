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
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useKeyValueStorageService: vi.fn(() => ({
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    })),
}))

describe('BlockchainStore', () => {
    beforeEach(() => {
        initBlockchainStore()
    })

    test('should add a sign request', () => {
        const { result } = renderHook(() => useBlockchainStore())
        const request: SignRequest = {
            id: 'test-id',
            txs: [],
        }

        act(() => {
            result.current.addSignRequest(request)
        })

        expect(result.current.pendingSignRequests).toHaveLength(1)
        expect(result.current.pendingSignRequests[0]).toEqual(request)
    })

    test('should not add duplicate sign request', () => {
        const { result } = renderHook(() => useBlockchainStore())
        const request: SignRequest = {
            id: 'test-id',
            txs: [],
        }

        act(() => {
            result.current.addSignRequest(request)
        })

        act(() => {
            const added = result.current.addSignRequest(request)
            expect(added).toBe(false)
        })

        expect(result.current.pendingSignRequests).toHaveLength(1)
    })

    test('should remove a sign request', () => {
        const { result } = renderHook(() => useBlockchainStore())
        const request: SignRequest = {
            id: 'test-id',
            txs: [],
        }

        act(() => {
            result.current.addSignRequest(request)
        })

        expect(result.current.pendingSignRequests).toHaveLength(1)

        act(() => {
            result.current.removeSignRequest(request)
        })

        expect(result.current.pendingSignRequests).toHaveLength(0)
    })
})
