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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWalletConnectSessionRequests } from '../useWalletConnectSessionRequests'
import { useWalletConnectStore } from '../../store'

// Mock store
vi.mock('../../store', () => ({
    useWalletConnectStore: vi.fn(),
}))

describe('useWalletConnectSessionRequests', () => {
    let mockSessionRequests: any[]
    let mockSetSessionRequests: any

    beforeEach(() => {
        mockSessionRequests = []
        mockSetSessionRequests = vi.fn()
            ; (useWalletConnectStore as any).mockImplementation((selector: any) => {
                const state = {
                    sessionRequests: mockSessionRequests,
                    setSessionRequests: mockSetSessionRequests,
                }
                return selector(state)
            })
    })

    it('should add session request', () => {
        const { result } = renderHook(() => useWalletConnectSessionRequests())
        const request = { peerMeta: { name: 'Test App' }, chainId: 4160 } as any

        act(() => {
            result.current.addSessionRequest(request)
        })

        expect(mockSetSessionRequests).toHaveBeenCalledWith([request])
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
