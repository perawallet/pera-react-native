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

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }))
vi.mock('@analytics', async () => {
    const actual = await vi.importActual<object>('@analytics')
    return { ...actual, trackEvent: mockTrackEvent }
})

const mockConfirmMutateAsync = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useConfirmPasswordResetMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockConfirmMutateAsync,
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
const mockGoBack = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}))

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({
            params: { email: 'typed@x.com', token: 'reset-token-1' },
        }),
    }
})

const mockErrorToast = vi.fn()
const mockSuccessToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        successToast: mockSuccessToast,
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

const mockShowError = vi.fn()
vi.mock('@modules/card/hooks', () => ({
    useCardErrorToast: () => mockShowError,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useCardForgotPasswordNewPasswordScreen } from '../useCardForgotPasswordNewPasswordScreen'

describe('useCardForgotPasswordNewPasswordScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('starts invalid and refuses to submit an empty form', async () => {
        const { result } = renderHook(() =>
            useCardForgotPasswordNewPasswordScreen(),
        )

        expect(result.current.isValid).toBe(false)
        await act(async () => {
            result.current.handleConfirm()
        })
        expect(mockConfirmMutateAsync).not.toHaveBeenCalled()
        // The tap is tracked even when validation blocks the call, matching
        // how the onboarding password screen tracks CreatePassword.
        expect(mockTrackEvent).toHaveBeenCalled()
    })

    it('exposes the live password value for the requirements checklist', () => {
        const { result } = renderHook(() =>
            useCardForgotPasswordNewPasswordScreen(),
        )

        expect(result.current.password).toBe('')
    })
})
