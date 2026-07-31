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

import { renderHook, act } from '@test-utils/render'
import { waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppState, Linking } from 'react-native'
import { config } from '@perawallet/wallet-core-config'

// Mutable capability map: mutate `mockCapabilities` per test to simulate the
// native-shaped (inAppWebView: true) and web-shaped (false) route capability
// maps without re-mocking.
const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: { inAppWebView: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

const mockStartMutateAsync = vi.fn()
const mockRefetch = vi.fn()
const mockRestartPolling = vi.fn()
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockVerificationState: string | null = null
let mockIsStateUnknown = false
let mockHasPollTimedOut = false
let mockPollOptions: { enabled?: boolean } | undefined
let mockIsFocused = true

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<typeof import('@react-navigation/native')>()),
    useIsFocused: () => mockIsFocused,
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        // The poll mechanics (give-up limits) are unit-tested in the card
        // package's useOnboardingKycPoll.test — here we drive its output to
        // exercise the screen's handoff/give-up wiring.
        useOnboardingKycPoll: (options: { enabled?: boolean }) => {
            mockPollOptions = options
            return {
                verificationState: mockVerificationState,
                isStateUnknown: mockIsStateUnknown,
                hasPollTimedOut: mockHasPollTimedOut,
                restartPolling: mockRestartPolling,
                refetch: mockRefetch,
            }
        },
        useStartVerificationMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockStartMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useCardStore: (
            selector: (state: { onboardingId: string | null }) => unknown,
        ) => selector({ onboardingId: mockOnboardingId }),
    }
})

const mockLogout = vi.fn()
vi.mock('@modules/card/hooks', async () => {
    // Real error-toast hook (single file, not the whole barrel) so the specs
    // keep asserting the actual message-resolution behavior.
    const { useCardErrorToast } = await vi.importActual<
        typeof import('../../../hooks/useCardErrorToast')
    >('../../../hooks/useCardErrorToast')
    // Real support hook (over the mocked webview + capabilities) so the
    // in-app-vs-browser assertions below keep testing real behavior.
    const { useOpenCardSupport } = await vi.importActual<
        typeof import('../../../hooks/useOpenCardSupport')
    >('../../../hooks/useOpenCardSupport')
    return {
        useCardOnboardingLogout: () => ({ handleLogout: mockLogout }),
        useCardErrorToast,
        useOpenCardSupport,
    }
})

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
    Object.assign(mockCapabilities, { inAppWebView: true })
    mockOnboardingId = 'mock-onboarding-id'
    mockVerificationState = null
    mockIsStateUnknown = false
    mockHasPollTimedOut = false
    mockPollOptions = undefined
    mockIsFocused = true
    mockStartMutateAsync.mockResolvedValue({ sessionUrl: SESSION_URL })
    vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    vi.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
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
        expect(mockPollOptions?.enabled).toBe(true)

        mockVerificationState = 'PENDING'
        act(() => rerender())

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingStatus'),
        )
        // The handoff disables our poll so it doesn't keep refetching behind
        // the status screen (which polls from here on).
        expect(mockPollOptions?.enabled).toBe(false)
    })

    it('pauses the KYC poll while the screen is unfocused', async () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)
        expect(mockPollOptions?.enabled).toBe(true)

        mockIsFocused = false
        act(() => rerender())

        expect(mockPollOptions?.enabled).toBe(false)

        mockIsFocused = true
        act(() => rerender())

        expect(mockPollOptions?.enabled).toBe(true)
    })

    it('hands off to the setup status on an unmodelled server state', async () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)

        // An unknown (null) state means Veriff reported back with something we
        // don't model — still a handoff, not "user abandoned".
        mockVerificationState = null
        mockIsStateUnknown = true
        act(() => rerender())

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingStatus'),
        )
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

    it('resets the poll budget when a fresh session is opened', async () => {
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        await startVerification(result)

        // Opening a fresh Veriff session must restart the give-up counters so a
        // prior stuck run doesn't immediately trip the new one.
        expect(mockRestartPolling).toHaveBeenCalled()
    })

    it('hands off to the setup status when the poll gives up (no forced re-mint)', async () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)

        mockHasPollTimedOut = true
        act(() => rerender())

        // The checklist takes over (keeps polling for a late decision + offers
        // the verify row) instead of a dead-end error that forces a new session.
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingStatus'),
        )
        expect(mockPollOptions?.enabled).toBe(false)
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

    it("surfaces Baanx's own error message when starting fails with a response body", async () => {
        mockStartMutateAsync.mockRejectedValueOnce({
            response: { status: 400 },
            data: { message: 'Registration is not in the expected phase' },
        })
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        await act(async () => {
            result.current.handleVerify()
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.verification.error_title',
                'Registration is not in the expected phase',
            ),
        )
    })

    it('does not open or poll when the session URL is not https', async () => {
        mockStartMutateAsync.mockResolvedValueOnce({
            sessionUrl: 'notaurl',
        })
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        await act(async () => {
            result.current.handleVerify()
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.verification.error_title',
                'peraCard.verification.open_link_error_body',
            ),
        )
        expect(Linking.openURL).not.toHaveBeenCalled()
        // Nothing was opened, so the status poll must not arm.
        expect(mockPollOptions?.enabled).toBe(false)
    })

    it('does not poll when no browser can open the session URL', async () => {
        vi.mocked(Linking.canOpenURL).mockResolvedValueOnce(false)
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        await act(async () => {
            result.current.handleVerify()
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.verification.error_title',
                'peraCard.verification.open_link_error_body',
            ),
        )
        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(mockPollOptions?.enabled).toBe(false)
    })

    it('does not arm the poll when opening the browser fails', async () => {
        vi.mocked(Linking.openURL).mockRejectedValueOnce(
            new Error('no browser'),
        )
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        await act(async () => {
            result.current.handleVerify()
        })

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        expect(mockPollOptions?.enabled).toBe(false)

        // The same handler succeeds on the retry.
        await startVerification(result)
        expect(mockPollOptions?.enabled).toBe(true)
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

    it('opens support in a browser tab when inAppWebView is off (web)', () => {
        Object.assign(mockCapabilities, { inAppWebView: false })
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        act(() => {
            result.current.handleOpenSupport()
        })

        expect(Linking.openURL).toHaveBeenCalledWith(config.supportBaseUrl)
        expect(mockPushWebView).not.toHaveBeenCalled()
    })
})
