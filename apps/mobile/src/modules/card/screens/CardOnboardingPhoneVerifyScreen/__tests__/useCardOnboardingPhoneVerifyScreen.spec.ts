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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSendMutateAsync = vi.fn()
const mockVerifyMutateAsync = vi.fn()
let mockSendIsPending = false
let mockVerifyIsPending = false
let mockPhoneCountryCode: string | null = '44'
let mockPhoneNumber: string | null = '7400846282'
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockContactVerificationId: string | null = 'mock-contact-id'
let mockCodeVerificationError: 'email' | 'phone' | null = null
const mockSetCodeVerificationError = vi.fn()

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useSendPhoneVerificationMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockSendMutateAsync,
            isPending: mockSendIsPending,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useVerifyPhoneMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockVerifyMutateAsync,
            isPending: mockVerifyIsPending,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useCardStore: (
            selector: (state: {
                phoneCountryCode: string | null
                phoneNumber: string | null
                onboardingId: string | null
                contactVerificationId: string | null
                codeVerificationError: 'email' | 'phone' | null
                setCodeVerificationError: (
                    target: 'email' | 'phone' | null,
                ) => void
            }) => unknown,
        ) =>
            selector({
                phoneCountryCode: mockPhoneCountryCode,
                phoneNumber: mockPhoneNumber,
                onboardingId: mockOnboardingId,
                contactVerificationId: mockContactVerificationId,
                codeVerificationError: mockCodeVerificationError,
                setCodeVerificationError: mockSetCodeVerificationError,
            }),
    }
})

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

const mockSuccessToast = vi.fn()
const mockErrorToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: mockErrorToast,
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useCardOnboardingPhoneVerifyScreen } from '../useCardOnboardingPhoneVerifyScreen'

/** A full-length (6-digit) code — the screen only checks the length now. */
const VALID_CODE = '123456'

const renderVerifyHook = () =>
    renderHook(() => useCardOnboardingPhoneVerifyScreen())

describe('useCardOnboardingPhoneVerifyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSendMutateAsync.mockResolvedValue(undefined)
        mockVerifyMutateAsync.mockResolvedValue(undefined)
        mockSendIsPending = false
        mockVerifyIsPending = false
        mockPhoneCountryCode = '44'
        mockPhoneNumber = '7400846282'
        mockOnboardingId = 'mock-onboarding-id'
        mockContactVerificationId = 'mock-contact-id'
        mockCodeVerificationError = null
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts with an empty code, an active cooldown, and the formatted phone', () => {
        const { result } = renderVerifyHook()

        expect(result.current.code).toBe('')
        expect(result.current.isValid).toBe(false)
        expect(result.current.secondsRemaining).toBe(60)
        expect(result.current.canResend).toBe(false)
        expect(result.current.phoneDisplay).toBe('+44 7400846282')
    })

    it('verifies with the stored ids on the valid code and goes to identity verification', async () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(VALID_CODE))
        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockVerifyMutateAsync).toHaveBeenCalledWith({
            onboardingId: 'mock-onboarding-id',
            phoneCountryCode: '44',
            phoneNumber: '7400846282',
            contactVerificationId: 'mock-contact-id',
            verificationCode: VALID_CODE,
        })
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingVerification')
    })

    it('flags the code as invalid (no toast) when verification rejects it (422)', async () => {
        mockVerifyMutateAsync.mockRejectedValue({ response: { status: 422 } })
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(VALID_CODE))
        await act(async () => {
            result.current.handleConfirm()
        })

        // A rejected code is surfaced inline on the input rather than via a
        // transient toast, and the user stays on the screen to retry.
        expect(mockSetCodeVerificationError).toHaveBeenCalledWith('phone')
        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows a generic toast (not a code error) when verification fails for a non-code reason', async () => {
        // A network/5xx failure isn't the code's fault — don't mislabel it.
        mockVerifyMutateAsync.mockRejectedValue(new Error('network down'))
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(VALID_CODE))
        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockSetCodeVerificationError).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("surfaces Baanx's own message when a non-code failure carries one", async () => {
        mockVerifyMutateAsync.mockRejectedValue({
            response: { status: 500 },
            data: { message: 'Verification service unavailable' },
        })
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(VALID_CODE))
        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'peraCard.verify_phone.verify_error_title',
            'Verification service unavailable',
        )
        expect(mockSetCodeVerificationError).not.toHaveBeenCalled()
    })

    it('exposes the inline code error when a prior attempt was rejected', () => {
        mockCodeVerificationError = 'phone'
        const { result } = renderVerifyHook()

        expect(result.current.codeError).toBe(
            'peraCard.verify_phone.code_invalid',
        )
    })

    it('clears the code-error flag as soon as the user edits the code', () => {
        mockCodeVerificationError = 'phone'
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('1'))

        expect(mockSetCodeVerificationError).toHaveBeenCalledWith(null)
    })

    it('routes back to the password step (no verify) when there is no onboarding id', async () => {
        // email/verify (which issues the onboardingId phone/verify needs) runs
        // on the password step before this screen; without it the code can't be
        // verified, so the user is routed back rather than POSTing blind.
        mockOnboardingId = null
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(VALID_CODE))
        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockVerifyMutateAsync).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingPassword')
    })

    it('routes back to the phone screen when the phone inputs are missing', async () => {
        mockPhoneNumber = null
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(VALID_CODE))
        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockVerifyMutateAsync).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingPhone')
    })

    it('ignores an incomplete code on confirm', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('123'))
        act(() => result.current.handleConfirm())

        expect(result.current.isValid).toBe(false)
        expect(mockVerifyMutateAsync).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('re-sends the code and restarts the cooldown once it elapses', async () => {
        const { result } = renderVerifyHook()

        await act(async () => {
            vi.advanceTimersByTime(60_000)
        })
        expect(result.current.canResend).toBe(true)

        await act(async () => {
            result.current.handleResend()
        })

        expect(mockSendMutateAsync).toHaveBeenCalledWith({
            phoneCountryCode: '44',
            phoneNumber: '7400846282',
            contactVerificationId: 'mock-contact-id',
        })
        expect(result.current.secondsRemaining).toBe(60)
        expect(result.current.canResend).toBe(false)
    })

    it('does not re-send while a send is already in flight', async () => {
        mockSendIsPending = true
        const { result } = renderVerifyHook()

        await act(async () => {
            result.current.handleResend()
        })

        expect(mockSendMutateAsync).not.toHaveBeenCalled()
    })
})
