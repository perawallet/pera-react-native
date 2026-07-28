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
import type { SupportedCountry } from '@perawallet/wallet-core-card'

const mockMutateAsync = vi.fn()
const mockSetPhone = vi.fn()
let mockSettings: { countries: SupportedCountry[]; usStates: [] } | undefined
let mockCountryIso: string | null = 'GB'
let mockContactVerificationId: string | null = 'mock-contact-id'

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useSendPhoneVerificationMutation: () => ({
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
        useRegistrationSettingsQuery: () => ({
            data: mockSettings,
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        }),
        useCardStore: (
            selector: (state: {
                countryIso: string | null
                contactVerificationId: string | null
                setPhone: (phone: {
                    phoneCountryCode: string
                    phoneNumber: string
                }) => void
            }) => unknown,
        ) =>
            selector({
                countryIso: mockCountryIso,
                contactVerificationId: mockContactVerificationId,
                setPhone: mockSetPhone,
            }),
    }
})

const mockRequest = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequest,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

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

import { useCardOnboardingPhoneScreen } from '../useCardOnboardingPhoneScreen'

const uk: SupportedCountry = {
    id: 'gb',
    iso3166alpha2: 'GB',
    name: 'United Kingdom',
    callingCode: '44',
    canSignUp: true,
}

const france: SupportedCountry = {
    id: 'fr',
    iso3166alpha2: 'FR',
    name: 'France',
    callingCode: '33',
    canSignUp: true,
}

describe('useCardOnboardingPhoneScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSettings = { countries: [uk, france], usStates: [] }
        mockCountryIso = 'GB'
        mockContactVerificationId = 'mock-contact-id'
        mockMutateAsync.mockResolvedValue(undefined)
    })

    it('starts with an invalid form and is not submitting', () => {
        const { result } = renderHook(() => useCardOnboardingPhoneScreen())

        expect(result.current.isValid).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
    })

    it('preselects the residence country as the calling code', async () => {
        const { result } = renderHook(() => useCardOnboardingPhoneScreen())

        await waitFor(() =>
            expect(result.current.selectedCallingCountry).toEqual(uk),
        )
    })

    it('updates the calling country from the picker', async () => {
        // No residence country, so nothing is preselected.
        mockCountryIso = null
        mockRequest.mockResolvedValueOnce(france)
        const { result } = renderHook(() => useCardOnboardingPhoneScreen())

        act(() => {
            result.current.handleSelectCallingCountry()
        })

        await waitFor(() =>
            expect(result.current.selectedCallingCountry).toEqual(france),
        )
        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                options: { size: 'full', autoCreateContainer: false },
            }),
        )
    })

    it('does not send the code while the form is invalid', async () => {
        const { result } = renderHook(() => useCardOnboardingPhoneScreen())

        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    describe('phone/send submission errors', () => {
        // Writes schema-valid values straight into the form store — no inputs
        // are rendered in a hook test, so this is the submit lever.
        const submitWithValidForm = async (result: {
            current: ReturnType<typeof useCardOnboardingPhoneScreen>
        }) => {
            act(() => {
                Object.assign(result.current.control._formValues, {
                    phoneCountryCode: '44',
                    phoneNumber: '7400846282',
                })
            })
            await act(async () => {
                result.current.handleConfirm()
            })
        }

        it('attributes a conflict (already registered) to the phone field', async () => {
            mockMutateAsync.mockRejectedValueOnce({
                response: { status: 409 },
                data: { message: 'Phone number already registered' },
            })
            const { result } = renderHook(() => useCardOnboardingPhoneScreen())

            await submitWithValidForm(result)

            expect(result.current.errors.phoneNumber?.message).toBe(
                'Phone number already registered',
            )
            expect(mockErrorToast).not.toHaveBeenCalled()
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it("surfaces Baanx's own message on a non-conflict failure", async () => {
            mockMutateAsync.mockRejectedValueOnce({
                response: { status: 500 },
                data: { message: 'SMS provider unavailable' },
            })
            const { result } = renderHook(() => useCardOnboardingPhoneScreen())

            await submitWithValidForm(result)

            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.verify_phone.send_error_title',
                'SMS provider unavailable',
            )
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('falls back to the generic body when the failure carries no message', async () => {
            mockMutateAsync.mockRejectedValueOnce(new Error('network down'))
            const { result } = renderHook(() => useCardOnboardingPhoneScreen())

            await submitWithValidForm(result)

            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.verify_phone.send_error_title',
                'peraCard.verify_phone.send_error_body',
            )
        })
    })
})
