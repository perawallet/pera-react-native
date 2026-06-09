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

const mockVerifyMutateAsync = vi.fn()
const mockSetOnboardingId = vi.fn()
const mockSetOnboardingStep = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useVerifyEmailMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockVerifyMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useCardStore: (
            selector: (state: {
                contactVerificationId: string | null
                setOnboardingId: unknown
                setOnboardingStep: unknown
            }) => unknown,
        ) =>
            selector({
                contactVerificationId: 'mock-contact-id',
                setOnboardingId: mockSetOnboardingId,
                setOnboardingStep: mockSetOnboardingStep,
            }),
    }
})

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: vi.fn(),
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useCardOnboardingPasswordScreen } from '../useCardOnboardingPasswordScreen'

const PARAMS = {
    email: 'john@example.com',
    countryIso: 'GB',
    verificationCode: 'PERA123',
}

const renderPasswordHook = () =>
    renderHook(() => useCardOnboardingPasswordScreen(PARAMS))

describe('useCardOnboardingPasswordScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockVerifyMutateAsync.mockResolvedValue({
            onboardingId: 'mock-onboarding-id',
        })
    })

    it('starts invalid with both fields hidden, unfocused', () => {
        const { result } = renderPasswordHook()

        expect(result.current.isValid).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
        expect(result.current.passwordField.isVisible).toBe(false)
        expect(result.current.passwordField.isFocused).toBe(false)
        expect(result.current.confirmPasswordField.isVisible).toBe(false)
        expect(result.current.confirmPasswordField.isFocused).toBe(false)
    })

    it('toggles visibility for each field independently', () => {
        const { result } = renderPasswordHook()

        act(() => result.current.passwordField.toggleVisibility())
        expect(result.current.passwordField.isVisible).toBe(true)
        // Toggling one field does not reveal the other.
        expect(result.current.confirmPasswordField.isVisible).toBe(false)

        act(() => result.current.confirmPasswordField.toggleVisibility())
        expect(result.current.confirmPasswordField.isVisible).toBe(true)

        act(() => result.current.passwordField.toggleVisibility())
        expect(result.current.passwordField.isVisible).toBe(false)
    })

    it('tracks focus per field so the toggle shows only on the focused input', () => {
        const { result } = renderPasswordHook()

        act(() => result.current.passwordField.handleFocus())
        expect(result.current.passwordField.isFocused).toBe(true)
        expect(result.current.confirmPasswordField.isFocused).toBe(false)

        act(() => result.current.passwordField.handleBlur())
        expect(result.current.passwordField.isFocused).toBe(false)

        act(() => result.current.confirmPasswordField.handleFocus())
        expect(result.current.confirmPasswordField.isFocused).toBe(true)
    })

    it('does not call verify while the form is invalid', async () => {
        const { result } = renderPasswordHook()

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockVerifyMutateAsync).not.toHaveBeenCalled()
    })
})
