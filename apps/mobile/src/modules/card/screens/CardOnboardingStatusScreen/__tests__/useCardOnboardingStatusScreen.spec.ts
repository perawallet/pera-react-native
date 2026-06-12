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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OnboardingStep } from '@perawallet/wallet-core-card'

const mockSetOnboardingStep = vi.fn()
let mockVerificationState: string | null = null
let mockQueryOptions: { refetchInterval?: number | false } | undefined

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useOnboardingDetailsQuery: (options: {
            refetchInterval?: number | false
        }) => {
            mockQueryOptions = options
            return {
                verificationState: mockVerificationState,
                isLoading: false,
                refetch: vi.fn(),
            }
        },
        useCardStore: Object.assign(
            (selector: (state: { onboardingId: string | null }) => unknown) =>
                selector({ onboardingId: 'mock-onboarding-id' }),
            {
                getState: () => ({
                    setOnboardingStep: mockSetOnboardingStep,
                }),
            },
        ),
    }
})

const mockLogout = vi.fn()
vi.mock('@modules/card/hooks', () => ({
    useCardOnboardingLogout: () => ({ handleLogout: mockLogout }),
}))

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

import { useCardOnboardingStatusScreen } from '../useCardOnboardingStatusScreen'

beforeEach(() => {
    vi.clearAllMocks()
    mockVerificationState = null
    mockQueryOptions = undefined
})

describe('useCardOnboardingStatusScreen', () => {
    it('reports pending (and keeps polling) while Veriff reviews', () => {
        mockVerificationState = 'PENDING'
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('pending')
        expect(mockQueryOptions?.refetchInterval).not.toBe(false)
    })

    it('reports verified and stops polling once the identity is confirmed', async () => {
        mockVerificationState = 'VERIFIED'
        const { result, rerender } = renderHook(() =>
            useCardOnboardingStatusScreen(),
        )

        expect(result.current.documentsState).toBe('verified')
        // The post-decision render disables the poll interval.
        act(() => rerender())
        expect(mockQueryOptions?.refetchInterval).toBe(false)
    })

    it('reports rejected when verification failed', () => {
        mockVerificationState = 'REJECTED'
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        expect(result.current.documentsState).toBe('rejected')
    })

    it('continues to personal details and advances the stored step', () => {
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleEnterDetails()
        })

        expect(mockSetOnboardingStep).toHaveBeenCalledWith(
            OnboardingStep.PersonalDetails,
        )
        expect(mockNavigate).toHaveBeenCalledWith(
            'CardOnboardingPersonalDetails',
        )
    })

    it('wires logout and the support link', () => {
        const { result } = renderHook(() => useCardOnboardingStatusScreen())

        act(() => {
            result.current.handleLogout()
            result.current.handleOpenSupport()
        })

        expect(mockLogout).toHaveBeenCalled()
        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'card-support' }),
        )
    })
})
