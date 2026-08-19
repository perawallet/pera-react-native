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
import { useArbitraryDataSigningScreen } from '../useArbitraryDataSigningScreen'

const mockNavigate = vi.fn()
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
}))

type MockPipeline = {
    currentRequest: unknown
    isLoading: boolean
    next: () => void
    fail: () => void
}

const mockPipeline: MockPipeline = {
    currentRequest: null,
    isLoading: false,
    next: vi.fn(),
    fail: vi.fn(),
}

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useSigningPipeline: () => mockPipeline,
        useLastSigningEvent: () => null,
    }
})

const mockConfirmQuantumDappUsage = vi.fn()
vi.mock('@hooks/useQuantumDappWarning', () => ({
    useQuantumDappWarning: () => ({
        confirmQuantumDappUsage: mockConfirmQuantumDappUsage,
    }),
}))

const mockIsQuantumDataSigningBlocked = vi.fn()
vi.mock('@hooks/useIsQuantumDataSigningBlocked', () => ({
    useIsQuantumDataSigningBlocked: (request: unknown) =>
        mockIsQuantumDataSigningBlocked(request),
}))

const buildRequest = (sourceType: string) => ({
    id: 'req-1',
    type: 'arbitrary-data',
    sourceType,
    data: [{ signer: 'ADDR', data: 'ZGF0YQ==' }],
})

describe('useArbitraryDataSigningScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPipeline.currentRequest = buildRequest('walletconnect')
        mockPipeline.isLoading = false
        mockConfirmQuantumDappUsage.mockResolvedValue('continue')
        mockIsQuantumDataSigningBlocked.mockReturnValue(false)
    })

    it('exposes the quantum block state for the current request', () => {
        mockIsQuantumDataSigningBlocked.mockReturnValue(true)
        const { result } = renderHook(() => useArbitraryDataSigningScreen())

        expect(mockIsQuantumDataSigningBlocked).toHaveBeenCalledWith(
            mockPipeline.currentRequest,
        )
        expect(result.current.isQuantumBlocked).toBe(true)
    })

    it('never advances the pipeline from handleApprove when quantum-blocked', async () => {
        mockIsQuantumDataSigningBlocked.mockReturnValue(true)
        const { result } = renderHook(() => useArbitraryDataSigningScreen())

        await act(async () => {
            result.current.handleApprove()
        })

        expect(mockPipeline.next).not.toHaveBeenCalled()
        expect(mockConfirmQuantumDappUsage).not.toHaveBeenCalled()
    })

    it('advances the pipeline when the quantum dApp warning continues', async () => {
        const { result } = renderHook(() => useArbitraryDataSigningScreen())

        await act(async () => {
            result.current.handleApprove()
        })

        expect(mockConfirmQuantumDappUsage).toHaveBeenCalledWith(['ADDR'])
        expect(mockPipeline.next).toHaveBeenCalledTimes(1)
    })

    it('rejects the request when the quantum dApp warning is cancelled', async () => {
        mockConfirmQuantumDappUsage.mockResolvedValue('cancel')
        const { result } = renderHook(() => useArbitraryDataSigningScreen())

        await act(async () => {
            result.current.handleApprove()
        })

        expect(mockPipeline.fail).toHaveBeenCalledTimes(1)
        expect(mockPipeline.next).not.toHaveBeenCalled()
    })

    it('does not consult the quantum dApp warning for non-dApp requests', async () => {
        mockPipeline.currentRequest = buildRequest('local')
        const { result } = renderHook(() => useArbitraryDataSigningScreen())

        await act(async () => {
            result.current.handleApprove()
        })

        expect(mockConfirmQuantumDappUsage).not.toHaveBeenCalled()
        expect(mockPipeline.next).toHaveBeenCalledTimes(1)
    })
})
