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
import { waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppState, Linking } from 'react-native'

const mockStartMutateAsync = vi.fn()
const mockRefetch = vi.fn()
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockVerificationState: string | null = null
let mockQueryOptions:
    | { enabled?: boolean; refetchInterval?: number | false }
    | undefined

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useStartVerificationMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockStartMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useOnboardingDetailsQuery: (options: {
            enabled?: boolean
            refetchInterval?: number | false
        }) => {
            mockQueryOptions = options
            return {
                verificationState: mockVerificationState,
                isLoading: false,
                refetch: mockRefetch,
            }
        },
        useCardStore: (
            selector: (state: { onboardingId: string | null }) => unknown,
        ) => selector({ onboardingId: mockOnboardingId }),
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

const mockErrorToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: vi.fn(),
        errorToast: mockErrorToast,
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useCardOnboardingVerificationScreen } from '../useCardOnboardingVerificationScreen'

const SESSION_URL = 'https://veriff.example/session'

let appStateListener: ((state: string) => void) | undefined

beforeEach(() => {
    vi.clearAllMocks()
    mockOnboardingId = 'mock-onboarding-id'
    mockVerificationState = null
    mockQueryOptions = undefined
    mockStartMutateAsync.mockResolvedValue({ sessionUrl: SESSION_URL })
    vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    vi.spyOn(AppState, 'addEventListener').mockImplementation(
        (_event, listener) => {
            appStateListener = listener as (state: string) => void
            return { remove: vi.fn() } as ReturnType<
                typeof AppState.addEventListener
            >
        },
    )
})

const startVerification = async (result: {
    current: ReturnType<typeof useCardOnboardingVerificationScreen>
}) => {
    await act(async () => {
        result.current.handleVerify()
    })
    await waitFor(() =>
        expect(Linking.openURL).toHaveBeenCalledWith(SESSION_URL),
    )
}

describe('useCardOnboardingVerificationScreen', () => {
    it('starts pre-auth KYC with the onboarding id and opens the session URL', async () => {
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        await startVerification(result)

        expect(mockStartMutateAsync).toHaveBeenCalledWith({
            onboardingId: 'mock-onboarding-id',
        })
    })

    it('routes back to email verification when the onboarding id is missing', () => {
        mockOnboardingId = null
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        act(() => {
            result.current.handleVerify()
        })

        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingEmailVerify')
        expect(mockStartMutateAsync).not.toHaveBeenCalled()
    })

    it('moves to the setup status once Veriff reports back', async () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)

        mockVerificationState = 'PENDING'
        act(() => rerender())

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingStatus'),
        )
    })

    it('stops polling once it hands off to the setup status', async () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)
        // Polling is live while we wait for Veriff to report back.
        expect(mockQueryOptions?.enabled).toBe(true)

        mockVerificationState = 'PENDING'
        act(() => rerender())

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingStatus'),
        )
        // The handoff disables our poll so it doesn't keep refetching behind
        // the status screen (which polls from here on).
        expect(mockQueryOptions?.enabled).toBe(false)
        expect(mockQueryOptions?.refetchInterval).toBe(false)
    })

    it('stays put while the state is still UNVERIFIED (user abandoned Veriff)', async () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)

        mockVerificationState = 'UNVERIFIED'
        act(() => rerender())

        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows an error toast when starting fails, leaving the button re-tappable', async () => {
        mockStartMutateAsync.mockRejectedValueOnce(new Error('boom'))
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        await act(async () => {
            result.current.handleVerify()
        })

        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()

        // The same handler succeeds on the retry.
        await startVerification(result)
    })

    it('refetches the status when the app returns to the foreground while polling', async () => {
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)
        mockRefetch.mockClear()

        // background -> active is a foreground transition that forces a refetch.
        act(() => {
            appStateListener?.('background')
            appStateListener?.('active')
        })

        expect(mockRefetch).toHaveBeenCalled()
    })

    it('wires logout and the support link', () => {
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

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
