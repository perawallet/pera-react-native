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

const mockMutateAsync = vi.fn()
const mockSetVerificationCode = vi.fn()
const mockSetCodeVerificationError = vi.fn()
const mockEmail = 'john@example.com'
let mockSendIsPending = false
let mockCodeVerificationError: 'email' | 'phone' | null = null
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useSendEmailVerificationMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockMutateAsync,
            isPending: mockSendIsPending,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useCardStore: (
            selector: (state: {
                email: string | null
                setVerificationCode: (code: string | null) => void
                codeVerificationError: 'email' | 'phone' | null
                setCodeVerificationError: (
                    target: 'email' | 'phone' | null,
                ) => void
            }) => unknown,
        ) =>
            selector({
                email: mockEmail,
                setVerificationCode: mockSetVerificationCode,
                codeVerificationError: mockCodeVerificationError,
                setCodeVerificationError: mockSetCodeVerificationError,
            }),
    }
})

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

import { useCardOnboardingEmailVerifyScreen } from '../useCardOnboardingEmailVerifyScreen'

/** A full-length (6-digit) code — the screen only checks the length now. */
const VALID_CODE = '123456'

const renderVerifyHook = () =>
    renderHook(() => useCardOnboardingEmailVerifyScreen())

describe('useCardOnboardingEmailVerifyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockMutateAsync.mockResolvedValue(undefined)
        mockSendIsPending = false
        mockCodeVerificationError = null
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts with an empty invalid code and an active cooldown', () => {
        const { result } = renderVerifyHook()

        expect(result.current.code).toBe('')
        expect(result.current.email).toBe(mockEmail)
        expect(result.current.isValid).toBe(false)
        expect(result.current.secondsRemaining).toBe(60)
        expect(result.current.canResend).toBe(false)
    })

    it('is valid only when the code is the full expected length', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('123'))
        expect(result.current.isValid).toBe(false)

        act(() => result.current.onChangeCode(VALID_CODE))
        expect(result.current.isValid).toBe(true)
    })

    it('stashes a full code and navigates to the password screen', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(VALID_CODE))
        act(() => result.current.handleConfirm())

        expect(mockSetVerificationCode).toHaveBeenCalledWith(VALID_CODE)
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingPassword')
    })

    it('does not navigate on an incomplete code', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('123'))
        act(() => result.current.handleConfirm())

        expect(mockSetVerificationCode).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('enables resend after the cooldown, then re-sends and restarts it', async () => {
        const { result } = renderVerifyHook()

        await act(async () => {
            vi.advanceTimersByTime(60_000)
        })
        expect(result.current.secondsRemaining).toBe(0)
        expect(result.current.canResend).toBe(true)

        await act(async () => {
            await result.current.handleResend()
        })

        expect(mockMutateAsync).toHaveBeenCalledWith({ email: mockEmail })
        expect(result.current.secondsRemaining).toBe(60)
        expect(result.current.canResend).toBe(false)
    })

    it('ignores an empty or whitespace-only code on confirm', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('   '))
        act(() => result.current.handleConfirm())

        expect(result.current.isValid).toBe(false)
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('does not re-send while a send is already in flight', async () => {
        mockSendIsPending = true
        const { result } = renderVerifyHook()

        await act(async () => {
            await result.current.handleResend()
        })

        expect(mockMutateAsync).not.toHaveBeenCalled()
    })

    it('surfaces an inline code error when a prior attempt was rejected', () => {
        mockCodeVerificationError = 'email'
        const { result } = renderVerifyHook()

        expect(result.current.codeError).toBe(
            'peraCard.verify_email.code_invalid',
        )
    })

    it('ignores a phone-targeted code error', () => {
        mockCodeVerificationError = 'phone'
        const { result } = renderVerifyHook()

        expect(result.current.codeError).toBeUndefined()
    })

    it('clears the code-error flag as soon as the user edits the code', () => {
        mockCodeVerificationError = 'email'
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('1'))

        expect(mockSetCodeVerificationError).toHaveBeenCalledWith(null)
    })
})
