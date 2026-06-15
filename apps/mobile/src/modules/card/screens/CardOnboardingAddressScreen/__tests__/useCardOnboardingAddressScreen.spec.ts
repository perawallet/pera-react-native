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
import {
    OnboardingStep,
    type SupportedCountry,
    type SupportedUsState,
} from '@perawallet/wallet-core-card'

const mockMutateAsync = vi.fn()
const mockConsentMutateAsync = vi.fn()
const mockSetCountryIso = vi.fn()
const mockSetAllowMarketing = vi.fn()
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockOnboardingStep: OnboardingStep = OnboardingStep.EmailSend
let mockCountryIso: string | null = 'GB'
let mockSettings:
    | { countries: SupportedCountry[]; usStates: SupportedUsState[] }
    | undefined

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useSubmitAddressMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useSubmitConsentMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockConsentMutateAsync,
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
                onboardingStep: OnboardingStep
                countryIso: string | null
                allowMarketing: boolean
                setCountryIso: (iso: string) => void
                setAllowMarketing: (allow: boolean) => void
            }) => unknown,
        ) =>
            selector({
                onboardingId: mockOnboardingId,
                onboardingStep: mockOnboardingStep,
                countryIso: mockCountryIso,
                allowMarketing: true,
                setCountryIso: mockSetCountryIso,
                setAllowMarketing: mockSetAllowMarketing,
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

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
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

import { useCardOnboardingAddressScreen } from '../useCardOnboardingAddressScreen'

const gb: SupportedCountry = {
    id: 'gb',
    iso3166alpha2: 'GB',
    name: 'United Kingdom',
    callingCode: '44',
    canSignUp: true,
}
const us: SupportedCountry = {
    id: 'us',
    iso3166alpha2: 'US',
    name: 'United States',
    callingCode: '1',
    canSignUp: true,
}
const california: SupportedUsState = {
    id: 'ca',
    postalAbbreviation: 'CA',
    name: 'California',
    canSignUp: true,
}

describe('useCardOnboardingAddressScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockOnboardingId = 'mock-onboarding-id'
        mockOnboardingStep = OnboardingStep.EmailSend
        mockCountryIso = 'GB'
        mockSettings = { countries: [gb, us], usStates: [california] }
        mockMutateAsync.mockResolvedValue(undefined)
        mockConsentMutateAsync.mockResolvedValue(undefined)
    })

    it('starts with an invalid form and is not submitting', () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        expect(result.current.isValid).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
        expect(result.current.isCompleted).toBe(false)
        expect(result.current.isUsResident).toBe(false)
    })

    it('derives completion from the persisted onboarding step', () => {
        mockOnboardingStep = OnboardingStep.Completed
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        expect(result.current.isCompleted).toBe(true)
    })

    it('leaves onboarding from the completion state', () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        act(() => {
            result.current.handleDone()
        })

        expect(mockNavigate).toHaveBeenCalledWith('PeraCardIntro')
    })

    it('prefills the residence country', async () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        await waitFor(() => expect(result.current.selectedCountry).toEqual(gb))
    })

    it('reveals the US state requirement when residence switches to US', async () => {
        mockRequest.mockResolvedValueOnce(us)
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        act(() => {
            result.current.handleSelectCountry()
        })

        await waitFor(() => expect(result.current.isUsResident).toBe(true))
    })

    it('selects a US state from the picker', async () => {
        mockRequest.mockResolvedValueOnce(california)
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        act(() => {
            result.current.handleSelectUsState()
        })

        await waitFor(() =>
            expect(result.current.selectedUsState).toEqual(california),
        )
    })

    it('toggles the consent checkboxes', () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        expect(result.current.allowMarketing).toBe(true)
        expect(result.current.cardTermsAccepted).toBe(false)
        expect(result.current.platformTermsAccepted).toBe(false)

        act(() => result.current.handleToggleMarketing())
        act(() => result.current.handleToggleCardTerms())
        act(() => result.current.handleTogglePlatformTerms())

        // Marketing consent is persisted to the card store, not local state.
        expect(mockSetAllowMarketing).toHaveBeenCalledWith(false)
        expect(result.current.cardTermsAccepted).toBe(true)
        expect(result.current.platformTermsAccepted).toBe(true)
    })

    it('keeps submit disabled until the address is valid even with both T&Cs accepted', () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        act(() => result.current.handleToggleCardTerms())
        act(() => result.current.handleTogglePlatformTerms())

        // The address fields are still empty, so the form is invalid.
        expect(result.current.isValid).toBe(false)
    })

    it('opens the card and platform T&C links in the webview', () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        act(() => result.current.handleOpenCardTerms())
        act(() => result.current.handleOpenPlatformTerms())

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'card-terms' }),
        )
        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'platform-terms' }),
        )
    })
})
