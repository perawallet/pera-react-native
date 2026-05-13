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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { SignRequest } from '@perawallet/wallet-core-signing'

const mockRejectRequest = vi.fn()
const mockRetryRequest = vi.fn()
let mockPendingRequests: SignRequest[] = []

vi.mock('@perawallet/wallet-core-signing', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-signing',
    )
    return {
        ...actual,
        useSigningRequest: () => ({
            pendingSignRequests: mockPendingRequests,
            rejectRequest: mockRejectRequest,
            retryRequest: mockRetryRequest,
            lastCompletedRequest: null,
            lastFailedRequest: null,
            currentRequest: mockPendingRequests[0],
            currentActorRef: null,
            addSignRequest: vi.fn(),
            removeSignRequest: vi.fn(),
            clearLastCompletedRequest: vi.fn(),
            clearLastFailedRequest: vi.fn(),
            signAndSendRequest: vi.fn(),
        }),
    }
})

import { useLedgerSigningContent } from '../useLedgerSigningContent'
import { useHardwareSigningStore } from '@perawallet/wallet-core-signing'

describe('useLedgerSigningContent', () => {
    beforeEach(() => {
        useHardwareSigningStore.getState().reset()
        mockRejectRequest.mockReset()
        mockRetryRequest.mockReset()
        mockPendingRequests = []
    })

    it('falls back to connecting status when the store is idle', () => {
        const { result } = renderHook(() => useLedgerSigningContent())

        expect(result.current.status).toBe('connecting')
        expect(result.current.currentTx).toBeUndefined()
        expect(result.current.totalTxs).toBeUndefined()
    })

    it('exposes connecting status with no progress when signing starts', () => {
        act(() => {
            useHardwareSigningStore.getState().start('req-1')
        })

        const { result } = renderHook(() => useLedgerSigningContent())

        expect(result.current.status).toBe('connecting')
        expect(result.current.currentTx).toBeUndefined()
        expect(result.current.totalTxs).toBeUndefined()
    })

    it('forwards progress updates from the store', () => {
        act(() => {
            useHardwareSigningStore.getState().start('req-1')
            useHardwareSigningStore.getState().setStatus('confirming')
            useHardwareSigningStore.getState().setProgress(2, 3)
        })

        const { result } = renderHook(() => useLedgerSigningContent())

        expect(result.current.status).toBe('confirming')
        expect(result.current.currentTx).toBe(2)
        expect(result.current.totalTxs).toBe(3)
    })

    it('rejects the active request and resets the store on cancel', () => {
        const activeRequest = { id: 'req-1' } as SignRequest
        mockPendingRequests = [activeRequest]
        act(() => {
            useHardwareSigningStore.getState().start('req-1')
        })

        const { result } = renderHook(() => useLedgerSigningContent())
        act(() => {
            result.current.onCancel()
        })

        expect(mockRejectRequest).toHaveBeenCalledWith(activeRequest)
        expect(useHardwareSigningStore.getState().status).toBe('idle')
        expect(useHardwareSigningStore.getState().requestId).toBeNull()
    })

    it('resets the store on cancel even when the request is no longer queued', () => {
        // Simulates the user cancelling after the request has already been
        // popped from the queue (race condition on terminal transitions).
        mockPendingRequests = []
        act(() => {
            useHardwareSigningStore.getState().start('req-missing')
        })

        const { result } = renderHook(() => useLedgerSigningContent())
        act(() => {
            result.current.onCancel()
        })

        expect(mockRejectRequest).not.toHaveBeenCalled()
        expect(useHardwareSigningStore.getState().status).toBe('idle')
    })

    it('retries the active request on retry', () => {
        const activeRequest = { id: 'req-1' } as SignRequest
        mockPendingRequests = [activeRequest]
        act(() => {
            useHardwareSigningStore.getState().start('req-1')
            useHardwareSigningStore.getState().setError('error')
        })

        const { result } = renderHook(() => useLedgerSigningContent())
        act(() => {
            result.current.onRetry()
        })

        expect(mockRetryRequest).toHaveBeenCalledWith(activeRequest)
    })
})
