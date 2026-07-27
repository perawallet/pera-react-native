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
    OnboardingStep,
    type SupportedCountry,
    type SupportedUsState,
} from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'

const mockMutateAsync = vi.fn()
const mockConsentMutateAsync = vi.fn()
const mockLinkMutateAsync = vi.fn()
const mockSetCountryIso = vi.fn()
const mockSetAllowMarketing = vi.fn()
const mockSetAllowSms = vi.fn()
let mockAllowMarketing: boolean | null = true
let mockAllowSms: boolean | null = true
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockOnboardingStep: OnboardingStep = OnboardingStep.EmailSend
let mockCountryIso: string | null = 'GB'
let mockSettings:
    | {
          countries: SupportedCountry[]
          usStates: SupportedUsState[]
          // Optional so a test can simulate a settings shape missing the links
          // block (e.g. a stale bundle) and assert the render doesn't crash.
          termsAndConditionsUrls?: { us: string | null; intl: string | null }
      }
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
            isPaused: false,
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
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useLinkConsentMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockLinkMutateAsync,
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
        useCardStore: Object.assign(
            (
                selector: (state: {
                    onboardingId: string | null
                    onboardingStep: OnboardingStep
                    countryIso: string | null
                    allowMarketing: boolean | null
                    allowSms: boolean | null
                    setCountryIso: (iso: string) => void
                    setAllowMarketing: (allow: boolean) => void
                    setAllowSms: (allow: boolean) => void
                }) => unknown,
            ) =>
                selector({
                    onboardingId: mockOnboardingId,
                    onboardingStep: mockOnboardingStep,
                    countryIso: mockCountryIso,
                    allowMarketing: mockAllowMarketing,
                    allowSms: mockAllowSms,
                    setCountryIso: mockSetCountryIso,
                    setAllowMarketing: mockSetAllowMarketing,
                    setAllowSms: mockSetAllowSms,
                }),
            {
                getState: () => ({
                    consentSetId: null,
                    allowMarketing: mockAllowMarketing,
                    allowSms: mockAllowSms,
                }),
            },
        ),
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

const mockOpenURL = vi.fn()
vi.mock('react-native', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
    }
})

// Mutable capability map: mutate `mockCapabilities` per test to simulate the
// native-shaped (inAppWebView: true) and web-shaped (false) route capability
// maps without re-mocking.
const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: { inAppWebView: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

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
        Object.assign(mockCapabilities, { inAppWebView: true })
        mockOnboardingId = 'mock-onboarding-id'
        mockOnboardingStep = OnboardingStep.EmailSend
        mockCountryIso = 'GB'
        mockAllowMarketing = true
        mockAllowSms = true
        mockSettings = {
            countries: [gb, us],
            usStates: [california],
            termsAndConditionsUrls: {
                us: 'https://baanx/us-terms.pdf',
                intl: 'https://baanx/intl-terms.pdf',
            },
        }
        mockMutateAsync.mockResolvedValue({
            accessToken: 'tok',
            onboardingId: 'mock-onboarding-id',
            userId: 'mock-user-id',
        })
        mockConsentMutateAsync.mockResolvedValue({ consentSetId: 'cs_1' })
        mockLinkMutateAsync.mockResolvedValue(undefined)
    })

    it('starts with an invalid form and is not submitting', () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        expect(result.current.isValid).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
        expect(result.current.isUsResident).toBe(false)
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

    it('toggles the T&C checkboxes', () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        expect(result.current.cardTermsAccepted).toBe(false)
        expect(result.current.platformTermsAccepted).toBe(false)

        act(() => result.current.handleToggleCardTerms())
        act(() => result.current.handleTogglePlatformTerms())

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

    // Writes a valid address straight into the form store and accepts both
    // T&Cs — no inputs are rendered in a hook test, so this is the submit lever.
    const fillValidAddress = (result: {
        current: ReturnType<typeof useCardOnboardingAddressScreen>
    }) => {
        act(() => {
            Object.assign(result.current.control._formValues, {
                countryIso: 'GB',
                addressLine1: '1 Main Street',
                city: 'London',
                zip: 'N1 9GU',
            })
            result.current.handleToggleCardTerms()
            result.current.handleTogglePlatformTerms()
        })
    }

    describe('consent re-collection on resumed sessions', () => {
        it('hides the consent opt-ins when the password step ran this session', () => {
            const { result } = renderHook(() =>
                useCardOnboardingAddressScreen(),
            )

            expect(result.current.showsConsentOptIns).toBe(false)
        })

        it('re-collects the consents when they were never asked, gating submit on SMS', async () => {
            mockAllowMarketing = null
            mockAllowSms = null
            const { result, rerender } = renderHook(() =>
                useCardOnboardingAddressScreen(),
            )
            fillValidAddress(result)
            expect(result.current.showsConsentOptIns).toBe(true)

            // The form and T&Cs alone are not enough on a resumed session —
            // the required SMS consent must be re-ticked first.
            await act(async () => {
                result.current.handleConfirm()
            })
            expect(mockConsentMutateAsync).not.toHaveBeenCalled()

            act(() => {
                result.current.handleToggleSms()
            })
            expect(mockSetAllowSms).toHaveBeenCalledWith(true)

            // Simulate the store update the real setter would apply; the
            // boxes stay visible (mount snapshot) and submit unlocks.
            mockAllowSms = true
            act(() => rerender())
            expect(result.current.showsConsentOptIns).toBe(true)

            await act(async () => {
                result.current.handleConfirm()
            })
            await waitFor(() =>
                expect(mockConsentMutateAsync).toHaveBeenCalledWith(
                    expect.objectContaining({ allowSms: true }),
                ),
            )
        })

        it('submits the re-collected consent values, not silent denials', async () => {
            mockAllowMarketing = null
            mockAllowSms = true
            const { result } = renderHook(() =>
                useCardOnboardingAddressScreen(),
            )
            fillValidAddress(result)

            await act(async () => {
                result.current.handleConfirm()
            })

            await waitFor(() =>
                expect(mockConsentMutateAsync).toHaveBeenCalledWith(
                    expect.objectContaining({
                        allowSms: true,
                        // Marketing left untouched on a resumed session is an
                        // explicit non-opt-in.
                        allowMarketing: false,
                    }),
                ),
            )
        })
    })

    it('submits the address and returns to the setup checklist', async () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())
        fillValidAddress(result)

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingStatus'),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it("surfaces Baanx's own error message when the submit is rejected", async () => {
        mockMutateAsync.mockRejectedValueOnce({
            response: { status: 400 },
            data: { message: 'Registration is not in the expected phase' },
        })
        const { result } = renderHook(() => useCardOnboardingAddressScreen())
        fillValidAddress(result)

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.address.error_title',
                'Registration is not in the expected phase',
            ),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('routes a duplicate submission to sign-in (registration finished but no session was stored)', async () => {
        mockMutateAsync.mockRejectedValueOnce({
            response: { status: 409 },
            data: { message: 'Duplicate onboardingId - record already exists' },
        })
        const { result } = renderHook(() => useCardOnboardingAddressScreen())
        fillValidAddress(result)

        await act(async () => {
            result.current.handleConfirm()
        })

        // The session token only arrives on a successful address response, so
        // a duplicate retry must send the user to sign in for one — landing on
        // the checklist tokenless would strand them.
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardSignIn'),
        )
        expect(mockInfoToast).toHaveBeenCalledWith(
            'peraCard.address.already_registered_title',
            'peraCard.address.already_registered_body',
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('opens the intl Baanx card T&C and Pera platform T&C links', () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        // Default residence (GB) is non-US → the intl Baanx T&C URL.
        act(() => result.current.handleOpenCardTerms())
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://baanx/intl-terms.pdf',
            id: 'card-terms',
        })

        // The second checkbox is Pera's own T&C.
        act(() => result.current.handleOpenPlatformTerms())
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: config.termsOfServiceUrl,
            id: 'platform-terms',
        })
        expect(mockOpenURL).not.toHaveBeenCalled()
    })

    it('opens the T&C links in a browser tab when inAppWebView is off (web)', () => {
        Object.assign(mockCapabilities, { inAppWebView: false })
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        act(() => result.current.handleOpenCardTerms())
        expect(mockOpenURL).toHaveBeenCalledWith('https://baanx/intl-terms.pdf')

        act(() => result.current.handleOpenPlatformTerms())
        expect(mockOpenURL).toHaveBeenCalledWith(config.termsOfServiceUrl)
        expect(mockPushWebView).not.toHaveBeenCalled()
    })

    it('opens the US Baanx card T&C once the resident is in the US', async () => {
        mockRequest.mockResolvedValueOnce(us)
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        act(() => result.current.handleSelectCountry())
        await waitFor(() => expect(result.current.isUsResident).toBe(true))

        act(() => result.current.handleOpenCardTerms())
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://baanx/us-terms.pdf',
            id: 'card-terms',
        })
    })

    it('falls back to Pera terms for the card T&C when settings have no link', () => {
        mockSettings = {
            countries: [gb, us],
            usStates: [california],
            termsAndConditionsUrls: { us: null, intl: null },
        }
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        act(() => result.current.handleOpenCardTerms())
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: config.termsOfServiceUrl,
            id: 'card-terms',
        })
    })

    it('renders and falls back when settings lack the links block entirely', () => {
        // A settings shape without `termsAndConditionsUrls` (e.g. a stale
        // package bundle) must not crash the render via an index on undefined.
        mockSettings = { countries: [gb, us], usStates: [california] }
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        act(() => result.current.handleOpenCardTerms())
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: config.termsOfServiceUrl,
            id: 'card-terms',
        })
    })
})
