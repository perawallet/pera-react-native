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
import {
    OnboardingNotVerifiedError,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'

const mockMutateAsync = vi.fn()
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockCountryIso: string | null = 'GB'
let mockSettings: { countries: SupportedCountry[]; usStates: [] } | undefined
type MockOnboardingDetails = {
    verificationState: string
    firstName: string | null
    lastName: string | null
    dateOfBirth: string | null
    countryOfNationality: string | null
}
let mockOnboardingDetails: MockOnboardingDetails | undefined
// The gate's own derivation is unit-tested in the card package
// (useOnboardingKycGate.test.ts); here only the screen's wiring matters.
let mockIsKycRequired = false
const mockMarkServerRefused = vi.fn()

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useSubmitPersonalDetailsMutation: () => ({
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
        useOnboardingDetailsQuery: () => ({
            data: mockOnboardingDetails,
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        }),
        useOnboardingKycGate: () => ({
            isKycRequired: mockIsKycRequired,
            markServerRefused: mockMarkServerRefused,
        }),
        useCardStore: (
            selector: (state: {
                onboardingId: string | null
                countryIso: string | null
            }) => unknown,
        ) =>
            selector({
                onboardingId: mockOnboardingId,
                countryIso: mockCountryIso,
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

import { useCardOnboardingPersonalDetailsScreen } from '../useCardOnboardingPersonalDetailsScreen'

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

describe('useCardOnboardingPersonalDetailsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockOnboardingId = 'mock-onboarding-id'
        mockCountryIso = 'GB'
        mockSettings = { countries: [uk, france], usStates: [] }
        mockOnboardingDetails = undefined
        mockIsKycRequired = false
        mockMutateAsync.mockResolvedValue(undefined)
    })

    it('starts with an invalid form and is not submitting', () => {
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        expect(result.current.isValid).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
    })

    it('preselects the residence country as the nationality', async () => {
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        await waitFor(() =>
            expect(result.current.selectedNationality).toEqual(uk),
        )
    })

    it('does not preselect when the residence country is not in the supported list', () => {
        mockCountryIso = 'ZZ'
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        expect(result.current.selectedNationality).toBeUndefined()
    })

    it('overrides the preselection with a different pick from the picker', async () => {
        // No residence country, so nothing is preselected.
        mockCountryIso = null
        mockRequest.mockResolvedValueOnce(france)
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        act(() => {
            result.current.handleSelectNationality()
        })

        await waitFor(() =>
            expect(result.current.selectedNationality).toEqual(france),
        )
        // Opens full-size with the nationality-specific sheet title. The
        // picker manages its own scroll, so the sheet must not auto-wrap it.
        const requestArg = mockRequest.mock.calls[0]?.[0]
        expect(requestArg?.options).toEqual({
            size: 'full',
            autoCreateContainer: false,
        })
        expect(requestArg?.contents?.props?.title).toBe(
            'peraCard.personal_details.nationality_picker_title',
        )
    })

    it('does not submit while the form is invalid', async () => {
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('prefills and locks the identity fields the server has confirmed', async () => {
        mockOnboardingDetails = {
            verificationState: 'VERIFIED',
            firstName: 'YASIN',
            lastName: 'ÇALIŞKAN',
            dateOfBirth: '1997-11-08T00:00:00.000Z',
            countryOfNationality: null,
        }
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        // Prefilled identity (DOB converted to DD/MM/YYYY) makes the form valid
        // with no typing, and those fields are locked.
        await waitFor(() => expect(result.current.isValid).toBe(true))
        expect(result.current.isFirstNameLocked).toBe(true)
        expect(result.current.isLastNameLocked).toBe(true)
        expect(result.current.isDateOfBirthLocked).toBe(true)
        // Nationality wasn't returned, so it stays editable, defaulted to the
        // residence country.
        expect(result.current.isNationalityLocked).toBe(false)
        await waitFor(() =>
            expect(result.current.selectedNationality).toEqual(uk),
        )
    })

    it('leaves the form empty and editable for a registration with no profile data yet', () => {
        mockOnboardingDetails = {
            verificationState: 'PENDING',
            firstName: null,
            lastName: null,
            dateOfBirth: null,
            countryOfNationality: null,
        }
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        expect(result.current.isFirstNameLocked).toBe(false)
        expect(result.current.isLastNameLocked).toBe(false)
        expect(result.current.isDateOfBirthLocked).toBe(false)
        expect(result.current.isNationalityLocked).toBe(false)
    })

    it('locks nationality and prefers the server value over the residence guess', async () => {
        mockCountryIso = 'GB'
        mockOnboardingDetails = {
            verificationState: 'VERIFIED',
            firstName: 'YASIN',
            lastName: 'ÇALIŞKAN',
            dateOfBirth: '1997-11-08T00:00:00.000Z',
            countryOfNationality: 'FR',
        }
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        expect(result.current.isNationalityLocked).toBe(true)
        // Server nationality (FR) wins over the residence default (GB).
        await waitFor(() =>
            expect(result.current.selectedNationality).toEqual(france),
        )
    })

    // Prefilled server data makes the form valid with no typing — the lever
    // used by the submit tests below.
    const prefillValidForm = () => {
        mockOnboardingDetails = {
            verificationState: 'VERIFIED',
            firstName: 'YASIN',
            lastName: 'ÇALIŞKAN',
            dateOfBirth: '1997-11-08T00:00:00.000Z',
            countryOfNationality: 'GB',
        }
    }

    describe('KYC gating', () => {
        it('surfaces the gate and offers a route back to verification', () => {
            mockIsKycRequired = true
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )

            expect(result.current.isKycRequired).toBe(true)

            act(() => {
                result.current.handleVerifyIdentity()
            })
            expect(mockNavigate).toHaveBeenCalledWith(
                'CardOnboardingVerification',
            )
        })

        it('marks the gate refused and keeps the user here when the server rejects the submit', async () => {
            prefillValidForm()
            mockMutateAsync.mockRejectedValueOnce(
                new OnboardingNotVerifiedError(),
            )
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )
            await waitFor(() => expect(result.current.isValid).toBe(true))

            await act(async () => {
                result.current.handleConfirm()
            })

            expect(mockMarkServerRefused).toHaveBeenCalledTimes(1)
            expect(mockNavigate).not.toHaveBeenCalledWith(
                'CardOnboardingAddress',
            )
            // Our copy, never Baanx's "User is not verified".
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.kyc_required.title',
                'peraCard.kyc_required.body',
            )
        })
    })

    it('submits the details and continues to the address step', async () => {
        prefillValidForm()
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingAddress'),
        )
        expect(mockMutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                onboardingId: 'mock-onboarding-id',
                firstName: 'YASIN',
                dateOfBirth: '1997-11-08',
            }),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it("surfaces Baanx's own error message when the submit is rejected", async () => {
        prefillValidForm()
        mockMutateAsync.mockRejectedValueOnce({
            response: { status: 400 },
            data: { message: 'Registration is not in the expected phase' },
        })
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.personal_details.error_title',
                'Registration is not in the expected phase',
            ),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('falls back to the generic error body when the failure carries no message', async () => {
        prefillValidForm()
        mockMutateAsync.mockRejectedValueOnce(new Error('network down'))
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.personal_details.error_title',
                'peraCard.personal_details.error_body',
            ),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('treats a duplicate submission as success and continues to the address step', async () => {
        prefillValidForm()
        mockMutateAsync.mockRejectedValueOnce({
            response: { status: 409 },
            data: { message: 'Duplicate onboardingId - record already exists' },
        })
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingAddress'),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('stays editable when the server nationality is not in the supported list', async () => {
        // A nationality outside the signup-eligible list (e.g. pulled from the
        // KYC scan) can't be resolved to a picker option. Locking it would
        // leave the field empty + locked and block submit, so it stays editable
        // and falls back to the residence guess.
        mockCountryIso = 'GB'
        mockOnboardingDetails = {
            verificationState: 'VERIFIED',
            firstName: 'YASIN',
            lastName: 'ÇALIŞKAN',
            dateOfBirth: '1997-11-08T00:00:00.000Z',
            countryOfNationality: 'JP',
        }
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        expect(result.current.isNationalityLocked).toBe(false)
        // Falls back to the residence country so the field isn't left empty.
        await waitFor(() =>
            expect(result.current.selectedNationality).toEqual(uk),
        )
    })
})
