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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSendMutateAsync = vi.fn()
const mockVerifyMutateAsync = vi.fn()
let mockSendIsPending = false
let mockVerifyIsPending = false
let mockPhoneCountryCode: string | null = '44'
let mockPhoneNumber: string | null = '7400846282'
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockContactVerificationId: string | null = 'mock-contact-id'

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
            }) => unknown,
        ) =>
            selector({
                phoneCountryCode: mockPhoneCountryCode,
                phoneNumber: mockPhoneNumber,
                onboardingId: mockOnboardingId,
                contactVerificationId: mockContactVerificationId,
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

import {
    MOCK_VALID_VERIFICATION_CODE,
    useCardOnboardingPhoneVerifyScreen,
} from '../useCardOnboardingPhoneVerifyScreen'

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

    it('flags a wrong code without calling verify', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('NOPE'))
        act(() => result.current.handleConfirm())

        expect(result.current.isWrongCode).toBe(true)
        expect(mockVerifyMutateAsync).not.toHaveBeenCalled()
    })

    it('clears the wrong-code error as the user edits', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('NOPE'))
        act(() => result.current.handleConfirm())
        expect(result.current.isWrongCode).toBe(true)

        act(() => result.current.onChangeCode('NOPE2'))
        expect(result.current.isWrongCode).toBe(false)
    })

    it('verifies with the stored ids on the valid code and shows success', async () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(MOCK_VALID_VERIFICATION_CODE))
        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockVerifyMutateAsync).toHaveBeenCalledWith({
            onboardingId: 'mock-onboarding-id',
            phoneCountryCode: '44',
            phoneNumber: '7400846282',
            contactVerificationId: 'mock-contact-id',
            verificationCode: MOCK_VALID_VERIFICATION_CODE,
        })
        expect(mockSuccessToast).toHaveBeenCalled()
        // Terminus: the verify screen does not navigate onward yet.
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows an error toast when verification fails', async () => {
        mockVerifyMutateAsync.mockRejectedValue(new Error('nope'))
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(MOCK_VALID_VERIFICATION_CODE))
        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockSuccessToast).not.toHaveBeenCalled()
    })

    it('routes back to verify when the onboarding id is missing', async () => {
        mockOnboardingId = null
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(MOCK_VALID_VERIFICATION_CODE))
        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockVerifyMutateAsync).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingEmailVerify')
    })

    it('ignores an empty or whitespace-only code on confirm', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('   '))
        act(() => result.current.handleConfirm())

        expect(result.current.isValid).toBe(false)
        expect(result.current.isWrongCode).toBe(false)
        expect(mockVerifyMutateAsync).not.toHaveBeenCalled()
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
