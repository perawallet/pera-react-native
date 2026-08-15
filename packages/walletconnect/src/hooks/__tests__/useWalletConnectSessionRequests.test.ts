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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWalletConnectSessionRequests } from '../useWalletConnectSessionRequests'
import { useWalletConnectStore } from '../../store'

// Mock store
vi.mock('../../store', () => ({
    useWalletConnectStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}))

// The constants module re-exports signing caps whose barrel pulls in
// react-native-mmkv — stub just those.
vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 10,
    MAX_TRANSACTION_SIGN_REQUESTS: 64,
    ARC60_MAX_REQUEST_BYTES: 64 * 1024,
}))

describe('useWalletConnectSessionRequests', () => {
    let mockSessionRequests: any[]
    let mockSetSessionRequests: any

    beforeEach(() => {
        mockSessionRequests = []
        mockSetSessionRequests = vi.fn()
        ;(useWalletConnectStore as any).mockImplementation((selector: any) => {
            const state = {
                sessionRequests: mockSessionRequests,
                setSessionRequests: mockSetSessionRequests,
            }
            return selector(state)
        })
        ;(useWalletConnectStore as any).getState.mockImplementation(() => ({
            sessionRequests: mockSessionRequests,
            setSessionRequests: mockSetSessionRequests,
        }))
    })

    it('should add session request stamped with createdAt', () => {
        const { result } = renderHook(() => useWalletConnectSessionRequests())
        const request = { peerMeta: { name: 'Test App' }, chainId: 4160 } as any

        act(() => {
            result.current.addSessionRequest(request)
        })

        expect(mockSetSessionRequests).toHaveBeenCalledWith([
            { ...request, createdAt: expect.any(Number) },
        ])
    })

    it('filters expired requests out of the returned list and prunes them from the store', () => {
        const fresh = {
            clientId: 'fresh',
            peerMeta: { name: 'Fresh dApp' },
            createdAt: Date.now(),
        } as any
        const stale = {
            clientId: 'stale',
            peerMeta: { name: 'Stale dApp' },
            createdAt: Date.now() - 6 * 60 * 1000,
        } as any
        mockSessionRequests = [stale, fresh]

        const { result } = renderHook(() => useWalletConnectSessionRequests())

        // A stale request queued during an outage must never pop its
        // approval sheet — approving it would feed a dead socket.
        expect(result.current.sessionRequests).toEqual([fresh])
        expect(mockSetSessionRequests).toHaveBeenCalledWith([fresh])
    })

    it('treats requests without createdAt as fresh', () => {
        const legacy = { clientId: 'legacy', peerMeta: { name: 'Old' } } as any
        mockSessionRequests = [legacy]

        const { result } = renderHook(() => useWalletConnectSessionRequests())

        expect(result.current.sessionRequests).toEqual([legacy])
        expect(mockSetSessionRequests).not.toHaveBeenCalled()
    })

    it('appends to live store state when called through a stale closure', () => {
        // Connector handlers capture addSessionRequest once, at connect()
        // time. Two session_requests arriving through the same captured
        // reference must both survive — a render-time snapshot would let
        // the second write clobber the first.
        mockSetSessionRequests = vi.fn((next: any[]) => {
            mockSessionRequests = next
        })
        const { result } = renderHook(() => useWalletConnectSessionRequests())
        const capturedAdd = result.current.addSessionRequest

        act(() => {
            capturedAdd({ clientId: 'dapp-a' } as any)
        })
        act(() => {
            capturedAdd({ clientId: 'dapp-b' } as any)
        })

        expect(mockSessionRequests.map(r => r.clientId)).toEqual([
            'dapp-a',
            'dapp-b',
        ])
    })

    it('should remove session request', () => {
        const request1 = { id: 1 } as any
        const request2 = { id: 2 } as any
        mockSessionRequests = [request1, request2]

        const { result } = renderHook(() => useWalletConnectSessionRequests())

        act(() => {
            result.current.removeSessionRequest(request1)
        })

        expect(mockSetSessionRequests).toHaveBeenCalledWith([request2])
    })
})
