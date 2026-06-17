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
import { waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupportedCountry } from '@perawallet/wallet-core-card'

const mockMutateAsync = vi.fn()
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockCountryIso: string | null = 'GB'
let mockSettings: { countries: SupportedCountry[]; usStates: [] } | undefined

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
})
