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
import { AppError, PeraNetworkError } from '@perawallet/wallet-core-shared'
import { CardEvent } from '@analytics'
import { useArc60SigningScreen } from '../useArc60SigningScreen'

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }))
vi.mock('@analytics', async () => {
    const actual = await vi.importActual<object>('@analytics')
    return { ...actual, trackEvent: mockTrackEvent }
})

const mockNavigate = vi.fn()
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
}))

type MockPipeline = {
    currentRequest: unknown
    resolved: unknown
    isLoading: boolean
    error: unknown
    next: () => void
    fail: () => void
}

const mockPipeline: MockPipeline = {
    currentRequest: null,
    resolved: null,
    isLoading: false,
    error: null,
    next: vi.fn(),
    fail: vi.fn(),
}

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: () => mockPipeline,
    useLastSigningEvent: () => null,
    isArc60OriginMismatch: () => false,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useFindAccountByAddress: () => null,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useAlgodErrorMessage', () => ({
    useAlgodErrorMessage: () => ({
        getMessage: () => ({
            title: 'errors.algod.unknown_node_error.title',
            body: 'errors.algod.unknown_node_error.body',
        }),
    }),
}))

describe('useArc60SigningScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPipeline.currentRequest = {
            id: 'req-1',
            stdSigData: { signer: 'ADDR', domain: 'example.com' },
        }
        mockPipeline.resolved = null
        mockPipeline.isLoading = false
        mockPipeline.error = null
    })

    it('returns a null errorMessage when the pipeline has no error', () => {
        const { result } = renderHook(() => useArc60SigningScreen())

        expect(result.current.errorMessage).toBeNull()
    })

    it('resolves localized copy rather than exposing the raw AppError message', () => {
        mockPipeline.error = new AppError('raw internal detail', {})

        const { result } = renderHook(() => useArc60SigningScreen())

        expect(result.current.errorMessage).not.toBe('raw internal detail')
        expect(result.current.errorMessage).toBe('errors.general.body')
    })

    it('resolves localized copy for a typed PeraNetworkError', () => {
        mockPipeline.error = new PeraNetworkError('timeout')

        const { result } = renderHook(() => useArc60SigningScreen())

        expect(result.current.errorMessage).toBe('errors.network.timeout.body')
    })

    it('resolves localized copy for an untyped raw Error via the algod fallback', () => {
        mockPipeline.error = new Error('boom')

        const { result } = renderHook(() => useArc60SigningScreen())

        expect(result.current.errorMessage).not.toBe('boom')
        expect(result.current.errorMessage).toBe('errors.general.body')
    })

    it('tracks card events only for card-originated (sourceType arc60) requests', () => {
        mockPipeline.currentRequest = {
            id: 'req-1',
            sourceType: 'arc60',
            stdSigData: { signer: 'ADDR', domain: 'example.com' },
        }
        const { result } = renderHook(() => useArc60SigningScreen())

        act(() => {
            result.current.handleApprove()
        })
        expect(mockTrackEvent).toHaveBeenCalledWith(
            CardEvent.CreateArbTxConfirm,
        )

        act(() => {
            result.current.handleReject()
        })
        expect(mockTrackEvent).toHaveBeenCalledWith(CardEvent.CreateArbTxClose)
    })

    it('does not track card events for dApp-originated requests', () => {
        mockPipeline.currentRequest = {
            id: 'req-1',
            sourceType: 'walletconnect',
            stdSigData: { signer: 'ADDR', domain: 'example.com' },
        }
        const { result } = renderHook(() => useArc60SigningScreen())

        act(() => {
            result.current.handleApprove()
            result.current.handleReject()
        })

        expect(mockTrackEvent).not.toHaveBeenCalled()
        expect(mockPipeline.next).toHaveBeenCalledTimes(1)
        expect(mockPipeline.fail).toHaveBeenCalledTimes(1)
    })
})
