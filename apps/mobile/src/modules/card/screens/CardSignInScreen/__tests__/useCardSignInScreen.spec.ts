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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CardEvent } from '@analytics'

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }))
vi.mock('@analytics', async () => {
    const actual = await vi.importActual<object>('@analytics')
    return { ...actual, trackEvent: mockTrackEvent }
})

const mockMutateAsync = vi.fn()
const mockSetOnboardingStep = vi.fn()
const mockSendOtpMutateAsync = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardLoginMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useCardStore: Object.assign(vi.fn(), {
            getState: () => ({
                contactVerificationId: 'mock-contact-id',
                setOnboardingStep: mockSetOnboardingStep,
            }),
        }),
        useSendLoginOtpMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockSendOtpMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

const mockInfoToast = vi.fn()
const mockErrorToast = vi.fn()
const mockSuccessToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: mockInfoToast,
        errorToast: mockErrorToast,
        successToast: mockSuccessToast,
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useCardSignInScreen } from '../useCardSignInScreen'

describe('useCardSignInScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('starts with an invalid form, idle, and no OTP step', () => {
        const { result } = renderHook(() => useCardSignInScreen())

        expect(result.current.isValid).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
        expect(result.current.isOtpRequired).toBe(false)
        expect(result.current.isOtpValid).toBe(false)
    })

    it('does not attempt to log in while the form is invalid', async () => {
        const { result } = renderHook(() => useCardSignInScreen())

        await act(async () => {
            result.current.handleSignIn()
        })

        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows a coming-soon toast for the forgot-password link', () => {
        const { result } = renderHook(() => useCardSignInScreen())

        act(() => {
            result.current.handleForgotPassword()
        })

        expect(mockInfoToast).toHaveBeenCalledWith(
            'peraCard.sign_in.coming_soon_title',
            'peraCard.sign_in.coming_soon_body',
        )
        // The tap is tracked even while the flow is a stub — demand signal.
        expect(mockTrackEvent).toHaveBeenCalledWith(
            CardEvent.RecoverForgotPassword,
        )
    })

    it('tracks the sign-in submit on the credentials pass', async () => {
        mockMutateAsync.mockResolvedValue({
            accessToken: 'token',
            userId: 'user-1',
            isOtpRequired: false,
            phase: null,
            verificationState: null,
            isLinked: true,
        })
        const { result } = renderHook(() => useCardSignInScreen())

        act(() => {
            Object.assign(result.current.control._formValues, {
                email: 'user@example.com',
                password: 'hunter2hunter22!',
            })
        })
        await act(async () => {
            result.current.handleSignIn()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(CardEvent.RecoverSignIn)
    })

    it('keeps the OTP submit gated until the code is complete', () => {
        const { result } = renderHook(() => useCardSignInScreen())

        act(() => {
            result.current.onChangeOtp('123')
        })
        expect(result.current.isOtpValid).toBe(false)

        act(() => {
            result.current.onChangeOtp('123456')
        })
        expect(result.current.isOtpValid).toBe(true)
    })

    describe('mid-onboarding resume routing', () => {
        // Writes credentials straight into the form store — no inputs are
        // rendered in a hook test, so this is the sign-in lever.
        const signIn = async (result: {
            current: ReturnType<typeof useCardSignInScreen>
        }) => {
            act(() => {
                Object.assign(result.current.control._formValues, {
                    email: 'user@example.com',
                    password: 'hunter2hunter22!',
                })
            })
            await act(async () => {
                result.current.handleSignIn()
            })
        }

        const midOnboarding = (
            phase: string,
            verificationState: string | null,
        ) => ({
            accessToken: null,
            userId: 'user-1',
            isOtpRequired: false,
            phase,
            verificationState,
            isLinked: false,
        })

        it('resumes on the KYC entry when the server awaits details but KYC never ran', async () => {
            mockMutateAsync.mockResolvedValue(
                midOnboarding('PERSONAL_INFORMATION', 'UNVERIFIED'),
            )
            const { result } = renderHook(() => useCardSignInScreen())

            await signIn(result)

            expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
                screen: 'CardOnboarding',
                params: { screen: 'CardOnboardingVerification' },
            })
            expect(mockSetOnboardingStep).toHaveBeenCalledWith('VERIFICATION')
        })

        it('resumes on the personal details form once KYC has been submitted', async () => {
            mockMutateAsync.mockResolvedValue(
                midOnboarding('PERSONAL_INFORMATION', 'PENDING'),
            )
            const { result } = renderHook(() => useCardSignInScreen())

            await signIn(result)

            expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
                screen: 'CardOnboarding',
                params: { screen: 'CardOnboardingPersonalDetails' },
            })
            expect(mockSetOnboardingStep).toHaveBeenCalledWith(
                'PERSONAL_DETAILS',
            )
        })

        it('sends a rejected user to the status checklist without touching the stored step', async () => {
            mockMutateAsync.mockResolvedValue(
                midOnboarding('PHYSICAL_ADDRESS', 'REJECTED'),
            )
            const { result } = renderHook(() => useCardSignInScreen())

            await signIn(result)

            expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
                screen: 'CardOnboarding',
                params: { screen: 'CardOnboardingStatus', params: {} },
            })
            expect(mockSetOnboardingStep).not.toHaveBeenCalled()
        })

        it('shows the failure toast when login returns neither token, code, nor phase', async () => {
            mockMutateAsync.mockResolvedValue({
                accessToken: null,
                userId: null,
                isOtpRequired: false,
                phase: null,
                verificationState: null,
                isLinked: false,
            })
            const { result } = renderHook(() => useCardSignInScreen())

            await signIn(result)

            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.sign_in.error_title',
                'peraCard.sign_in.error_body',
            )
            expect(mockNavigate).not.toHaveBeenCalled()
        })
    })

    it('does not request a resend before a login has required OTP', async () => {
        // The OTP endpoint is keyed on the login's userId; without one (no
        // isOtpRequired login yet) resend must be a no-op, not a bad request.
        const { result } = renderHook(() => useCardSignInScreen())

        await act(async () => {
            result.current.handleResendOtp()
        })

        expect(mockSendOtpMutateAsync).not.toHaveBeenCalled()
    })
})
