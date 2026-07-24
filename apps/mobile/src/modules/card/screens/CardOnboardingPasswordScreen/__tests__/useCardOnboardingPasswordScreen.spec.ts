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

const mockVerifyEmailMutateAsync = vi.fn()
const mockSetAllowMarketing = vi.fn()
const mockSetAllowSms = vi.fn()
let mockAllowSms: boolean | null = false
let mockAllowMarketing: boolean | null = false
let mockExistingOnboardingId: string | null = null
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    const mutationShell = {
        mutate: vi.fn(),
        isPending: false,
        isError: false,
        isSuccess: false,
        isPaused: false,
        error: null,
        data: null,
        reset: vi.fn(),
    }
    return {
        ...actual,
        useVerifyEmailMutation: () => ({
            ...mutationShell,
            mutateAsync: mockVerifyEmailMutateAsync,
        }),
        useCardStore: (
            selector: (state: {
                email: string | null
                countryIso: string | null
                verificationCode: string | null
                contactVerificationId: string | null
                onboardingId: string | null
                allowMarketing: boolean | null
                allowSms: boolean | null
                setCodeVerificationError: (
                    target: 'email' | 'phone' | null,
                ) => void
                setAllowMarketing: (allow: boolean) => void
                setAllowSms: (allow: boolean) => void
            }) => unknown,
        ) =>
            selector({
                email: 'john@example.com',
                countryIso: 'GB',
                verificationCode: '123456',
                contactVerificationId: 'mock-contact-id',
                onboardingId: mockExistingOnboardingId,
                allowMarketing: mockAllowMarketing,
                allowSms: mockAllowSms,
                setCodeVerificationError: vi.fn(),
                setAllowMarketing: mockSetAllowMarketing,
                setAllowSms: mockSetAllowSms,
            }),
    }
})

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

const mockErrorToast = vi.fn()
const mockInfoToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: vi.fn(),
        errorToast: mockErrorToast,
        infoToast: mockInfoToast,
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
        mockAllowSms = false
        mockAllowMarketing = false
        mockExistingOnboardingId = null
        mockVerifyEmailMutateAsync.mockResolvedValue({
            onboardingId: 'mock-onboarding-id',
            hasAccount: false,
        })
    })

    it('starts invalid and not submitting', () => {
        const { result } = renderPasswordHook()

        expect(result.current.isValid).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
    })

    it('does not call email/verify while the form is invalid', async () => {
        const { result } = renderPasswordHook()

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockVerifyEmailMutateAsync).not.toHaveBeenCalled()
    })

    it('exposes the consent flags (off by default) and toggles them', () => {
        const { result } = renderPasswordHook()

        expect(result.current.allowMarketing).toBe(false)
        expect(result.current.allowSms).toBe(false)

        act(() => result.current.handleToggleMarketing())
        act(() => result.current.handleToggleSms())

        expect(mockSetAllowMarketing).toHaveBeenCalledWith(true)
        expect(mockSetAllowSms).toHaveBeenCalledWith(true)
    })

    describe('email/verify submission errors', () => {
        const VALID_PASSWORD = 'CorrectHorse7Battery!'

        // Writes a schema-valid password straight into the form store — no
        // inputs are rendered in a hook test, so this is the submit lever.
        const submitWithValidForm = async (result: {
            current: ReturnType<typeof useCardOnboardingPasswordScreen>
        }) => {
            act(() => {
                Object.assign(result.current.control._formValues, {
                    password: VALID_PASSWORD,
                    confirmPassword: VALID_PASSWORD,
                })
            })
            await act(async () => {
                result.current.handleConfirm()
            })
        }

        beforeEach(() => {
            mockAllowSms = true
        })

        it('submits and continues to the phone step on success', async () => {
            const { result } = renderPasswordHook()

            await submitWithValidForm(result)

            expect(mockVerifyEmailMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'john@example.com',
                    password: VALID_PASSWORD,
                    allowSms: true,
                }),
            )
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingPhone')
            expect(mockErrorToast).not.toHaveBeenCalled()
            // The untouched marketing box is committed as an explicit decline
            // so the address step doesn't re-ask this session.
            expect(mockSetAllowMarketing).toHaveBeenCalledWith(false)
        })

        it('shows an error and stays put on a malformed 200 (no id, no account)', async () => {
            // Neither hasAccount nor a usable onboardingId — must not advance to
            // the phone step with a null id (which dead-ends at phone/verify).
            mockVerifyEmailMutateAsync.mockResolvedValueOnce({
                onboardingId: null,
                hasAccount: false,
            })
            const { result } = renderPasswordHook()

            await submitWithValidForm(result)

            await waitFor(() =>
                expect(mockErrorToast).toHaveBeenCalledWith(
                    'peraCard.create_account.error_title',
                    'peraCard.create_account.error_body',
                ),
            )
            expect(mockNavigate).not.toHaveBeenCalledWith('CardOnboardingPhone')
            expect(mockNavigate).not.toHaveBeenCalledWith('CardSignIn')
        })

        it('routes to sign in when the email already has an account', async () => {
            // email/verify answers 200 with { hasAccount: true, onboardingId:
            // null } — the email is already registered, so sign in instead of
            // a generic error.
            mockVerifyEmailMutateAsync.mockResolvedValueOnce({
                onboardingId: null,
                hasAccount: true,
            })
            const { result } = renderPasswordHook()

            await submitWithValidForm(result)

            expect(mockInfoToast).toHaveBeenCalled()
            expect(mockNavigate).toHaveBeenCalledWith('CardSignIn')
            expect(mockNavigate).not.toHaveBeenCalledWith('CardOnboardingPhone')
            expect(mockErrorToast).not.toHaveBeenCalled()
        })

        it('skips the spent email/verify but still commits the consents when backing in', async () => {
            // Cold-resume state: onboardingId persisted, consents never asked.
            mockExistingOnboardingId = 'existing-onboarding-id'
            mockAllowMarketing = null
            const { result } = renderPasswordHook()

            await submitWithValidForm(result)

            expect(mockVerifyEmailMutateAsync).not.toHaveBeenCalled()
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingPhone')
            // The boxes were shown and answered on this screen, so the
            // untouched marketing box commits as an explicit decline — the
            // address step must not re-ask.
            expect(mockSetAllowMarketing).toHaveBeenCalledWith(false)
        })

        it('routes back to the code screen on a rejected code (400/422)', async () => {
            mockVerifyEmailMutateAsync.mockRejectedValueOnce({
                response: { status: 400 },
                data: { message: 'Error, no valid verification code' },
            })
            const { result } = renderPasswordHook()

            await submitWithValidForm(result)

            expect(mockNavigate).toHaveBeenCalledWith(
                'CardOnboardingEmailVerify',
            )
            expect(mockErrorToast).not.toHaveBeenCalled()
        })

        it("surfaces Baanx's own error message on a non-input failure", async () => {
            mockVerifyEmailMutateAsync.mockRejectedValueOnce({
                response: { status: 409 },
                data: { message: 'Email address already registered' },
            })
            const { result } = renderPasswordHook()

            await submitWithValidForm(result)

            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.create_account.error_title',
                'Email address already registered',
            )
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('falls back to the generic error body when the failure carries no message', async () => {
            mockVerifyEmailMutateAsync.mockRejectedValueOnce(
                new Error('network down'),
            )
            const { result } = renderPasswordHook()

            await submitWithValidForm(result)

            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.create_account.error_title',
                'peraCard.create_account.error_body',
            )
            expect(mockNavigate).not.toHaveBeenCalled()
        })
    })
})
