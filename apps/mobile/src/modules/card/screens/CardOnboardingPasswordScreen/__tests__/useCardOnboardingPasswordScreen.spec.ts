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
                email: string | null
                countryIso: string | null
                verificationCode: string | null
                contactVerificationId: string | null
            }) => unknown,
        ) =>
            selector({
                email: 'john@example.com',
                countryIso: 'GB',
                verificationCode: 'PERA123',
                contactVerificationId: 'mock-contact-id',
            }),
    }
})

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

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

const renderPasswordHook = () =>
    renderHook(() => useCardOnboardingPasswordScreen())

describe('useCardOnboardingPasswordScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockVerifyMutateAsync.mockResolvedValue({
            onboardingId: 'mock-onboarding-id',
        })
    })

    it('starts invalid and not submitting', () => {
        const { result } = renderPasswordHook()

        expect(result.current.isValid).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
    })

    it('does not call verify while the form is invalid', async () => {
        const { result } = renderPasswordHook()

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockVerifyMutateAsync).not.toHaveBeenCalled()
    })
})
