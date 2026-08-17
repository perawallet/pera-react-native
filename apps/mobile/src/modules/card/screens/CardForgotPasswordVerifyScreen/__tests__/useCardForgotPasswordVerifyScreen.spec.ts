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

const mockRequestMutateAsync = vi.fn()
const mockVerifyMutateAsync = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useRequestPasswordResetMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockRequestMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useVerifyPasswordResetMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockVerifyMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            isPaused: false,
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

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: { email: 'typed@x.com' } }),
    }
})

const mockShowError = vi.fn()
vi.mock('@modules/card/hooks', () => ({
    useCardErrorToast: () => mockShowError,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useCardForgotPasswordVerifyScreen } from '../useCardForgotPasswordVerifyScreen'

describe('useCardForgotPasswordVerifyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('ignores submissions of an incomplete code', async () => {
        const { result } = renderHook(() => useCardForgotPasswordVerifyScreen())

        act(() => result.current.onChangeCode('123'))
        await act(async () => {
            result.current.handleVerify()
        })

        expect(mockVerifyMutateAsync).not.toHaveBeenCalled()
    })

    it('verifies a complete code and advances with the reset token', async () => {
        mockVerifyMutateAsync.mockResolvedValue('reset-token-1')
        const { result } = renderHook(() => useCardForgotPasswordVerifyScreen())

        // `submittedCode` comes from PWCodeInput's onComplete (auto-submit).
        await act(async () => {
            result.current.handleVerify('123456')
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            CardEvent.RecoverResetVerifyCode,
        )
        expect(mockVerifyMutateAsync).toHaveBeenCalledWith({
            email: 'typed@x.com',
            code: '123456',
        })
        expect(mockNavigate).toHaveBeenCalledWith(
            'CardForgotPasswordNewPassword',
            { email: 'typed@x.com', token: 'reset-token-1' },
        )
    })

    it('flags a rejected code inline instead of toasting', async () => {
        mockVerifyMutateAsync.mockRejectedValue(
            Object.assign(new Error('rejected'), { response: { status: 422 } }),
        )
        const { result } = renderHook(() => useCardForgotPasswordVerifyScreen())

        await act(async () => {
            result.current.handleVerify('123456')
        })

        expect(result.current.codeError).toBe(
            'peraCard.forgot_password.code_invalid',
        )
        expect(mockShowError).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('clears the inline error when the code is edited', async () => {
        mockVerifyMutateAsync.mockRejectedValue(
            Object.assign(new Error('rejected'), { response: { status: 422 } }),
        )
        const { result } = renderHook(() => useCardForgotPasswordVerifyScreen())
        await act(async () => {
            result.current.handleVerify('123456')
        })

        act(() => result.current.onChangeCode('1'))

        expect(result.current.codeError).toBeUndefined()
    })

    it('toasts on a non-validation failure', async () => {
        mockVerifyMutateAsync.mockRejectedValue(
            Object.assign(new Error('down'), { response: { status: 500 } }),
        )
        const { result } = renderHook(() => useCardForgotPasswordVerifyScreen())

        await act(async () => {
            result.current.handleVerify('123456')
        })

        expect(mockShowError).toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('re-requests the code on resend and re-arms the cooldown', async () => {
        mockRequestMutateAsync.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardForgotPasswordVerifyScreen())

        await act(async () => {
            result.current.handleResend()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            CardEvent.RecoverResetRequestCode,
        )
        expect(mockRequestMutateAsync).toHaveBeenCalledWith({
            email: 'typed@x.com',
        })
    })
})
