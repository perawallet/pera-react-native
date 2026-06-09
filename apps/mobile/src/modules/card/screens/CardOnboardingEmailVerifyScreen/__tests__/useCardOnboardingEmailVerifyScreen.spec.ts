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

const mockMutateAsync = vi.fn()
let mockSendIsPending = false
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
            error: null,
            data: null,
            reset: vi.fn(),
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

import {
    MOCK_VALID_VERIFICATION_CODE,
    useCardOnboardingEmailVerifyScreen,
} from '../useCardOnboardingEmailVerifyScreen'

const EMAIL = 'john@example.com'
const COUNTRY_ISO = 'GB'

const renderVerifyHook = () =>
    renderHook(() =>
        useCardOnboardingEmailVerifyScreen({
            email: EMAIL,
            countryIso: COUNTRY_ISO,
        }),
    )

describe('useCardOnboardingEmailVerifyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockMutateAsync.mockResolvedValue(undefined)
        mockSendIsPending = false
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts with an empty invalid code and an active cooldown', () => {
        const { result } = renderVerifyHook()

        expect(result.current.code).toBe('')
        expect(result.current.isValid).toBe(false)
        expect(result.current.secondsRemaining).toBe(60)
        expect(result.current.canResend).toBe(false)
    })

    it('flags a wrong code without navigating onward', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('NOPE'))
        act(() => result.current.handleConfirm())

        expect(result.current.isWrongCode).toBe(true)
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('navigates to the password screen on the valid code', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode(MOCK_VALID_VERIFICATION_CODE))
        act(() => result.current.handleConfirm())

        expect(result.current.isWrongCode).toBe(false)
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingPassword', {
            email: EMAIL,
            countryIso: COUNTRY_ISO,
            verificationCode: MOCK_VALID_VERIFICATION_CODE,
        })
    })

    it('clears the wrong-code error as the user edits', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('NOPE'))
        act(() => result.current.handleConfirm())
        expect(result.current.isWrongCode).toBe(true)

        act(() => result.current.onChangeCode('NOPE2'))
        expect(result.current.isWrongCode).toBe(false)
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

        expect(mockMutateAsync).toHaveBeenCalledWith({ email: EMAIL })
        expect(result.current.secondsRemaining).toBe(60)
        expect(result.current.canResend).toBe(false)
    })

    it('ignores an empty or whitespace-only code on confirm', () => {
        const { result } = renderVerifyHook()

        act(() => result.current.onChangeCode('   '))
        act(() => result.current.handleConfirm())

        expect(result.current.isValid).toBe(false)
        expect(result.current.isWrongCode).toBe(false)
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
})
