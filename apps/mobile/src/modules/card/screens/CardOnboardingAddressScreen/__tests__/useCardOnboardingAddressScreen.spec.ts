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
const mockRefetchRecord = vi.fn()
const mockConsentMutateAsync = vi.fn()
const mockSetCountryIso = vi.fn()
const mockSetAllowMarketing = vi.fn()
const mockSetAllowSms = vi.fn()
let mockAllowMarketing: boolean | null = true
let mockAllowSms: boolean | null = true
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockOnboardingStep: OnboardingStep = OnboardingStep.EmailSend
let mockCountryIso: string | null = 'GB'
let mockProgressEmail: string | null = null
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
        useRegistrationSettingsQuery: () => ({
            data: mockSettings,
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        }),
        useOnboardingDetailsQuery: () => ({ refetch: mockRefetchRecord }),
        useCardStore: (
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
        getCardOnboardingProgress: () => ({ email: mockProgressEmail }),
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
    withLanguageParam: (url: string, locale: string) => `${url}?lang=${locale}`,
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

const mockGoToNextStep = vi.fn()
vi.mock('@modules/card/hooks/useCardOnboardingRouter', () => ({
    useCardOnboardingRouter: () => ({ goToNextStep: mockGoToNextStep }),
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

vi.mock('@hooks/useLanguage')

import { useCardOnboardingAddressScreen } from '../useCardOnboardingAddressScreen'
import { registerAlgorandCardAdapter } from '@test-utils/cardChainAdapter'

const gb: SupportedCountry = {
    id: 'gb',
    iso3166alpha2: 'GB',
    name: 'United Kingdom',
    callingCode: '44',
    canSignUp: true,
    cardProvider: null,
}
const us: SupportedCountry = {
    id: 'us',
    iso3166alpha2: 'US',
    name: 'United States',
    callingCode: '1',
    canSignUp: true,
    cardProvider: null,
}
const california: SupportedUsState = {
    id: 'ca',
    postalAbbreviation: 'CA',
    name: 'California',
    canSignUp: true,
}

beforeEach(() => {
    registerAlgorandCardAdapter()
})

describe('useCardOnboardingAddressScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(mockCapabilities, { inAppWebView: true })
        mockOnboardingId = 'mock-onboarding-id'
        mockOnboardingStep = OnboardingStep.EmailSend
        mockCountryIso = 'GB'
        mockProgressEmail = null
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
            accessToken: null,
            onboardingId: 'mock-onboarding-id',
            userId: null,
        })
        mockConsentMutateAsync.mockResolvedValue({ consentSetId: 'cs_1' })
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

    it('reveals the US state requirement for a US resident', async () => {
        mockCountryIso = 'US'
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        await waitFor(() => expect(result.current.isUsResident).toBe(true))
    })

    it('locks the country field once the residence is known', async () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())

        await waitFor(() => expect(result.current.selectedCountry).toEqual(gb))
        expect(result.current.isCountryLocked).toBe(true)
    })

    it('offers the picker only when no residence was stored', async () => {
        mockCountryIso = null
        mockRequest.mockResolvedValueOnce(us)
        const { result } = renderHook(() => useCardOnboardingAddressScreen())
        expect(result.current.isCountryLocked).toBe(false)

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

    it('submits the address and moves on to identity verification', async () => {
        const { result } = renderHook(() => useCardOnboardingAddressScreen())
        fillValidAddress(result)

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockGoToNextStep).toHaveBeenCalledWith({
                localStep: OnboardingStep.Verification,
            }),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('US: a separate mailing address posts the flag and continues to the mailing step', async () => {
        mockCountryIso = 'US'
        mockMutateAsync.mockResolvedValueOnce({
            accessToken: null,
            onboardingId: 'mock-onboarding-id',
            userId: null,
        })
        const { result } = renderHook(() => useCardOnboardingAddressScreen())
        await waitFor(() => expect(result.current.isUsResident).toBe(true))
        expect(result.current.isSameMailingAddress).toBe(true)

        act(() => {
            Object.assign(result.current.control._formValues, {
                addressLine1: '1 Main Street',
                city: 'Los Angeles',
                zip: '90001',
                usState: 'CA',
            })
            result.current.handleToggleCardTerms()
            result.current.handleTogglePlatformTerms()
            result.current.handleToggleSameMailingAddress()
        })
        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockGoToNextStep).toHaveBeenCalledWith({
                localStep: OnboardingStep.MailingAddress,
            }),
        )
        expect(mockMutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                isSameMailingAddress: false,
                usState: 'CA',
            }),
        )
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
        expect(mockGoToNextStep).not.toHaveBeenCalled()
    })

    const GONE_RECORD = {
        data: undefined,
        error: {
            response: { status: 404 },
            data: { message: 'Invalid onboarding ID' },
        },
    }

    it("continues from the record's phase when a duplicate means an earlier save already landed", async () => {
        mockMutateAsync.mockRejectedValueOnce({
            response: { status: 409 },
            data: { message: 'Duplicate onboardingId - record already exists' },
        })
        mockRefetchRecord.mockResolvedValueOnce({
            data: { phase: 'MAILING_ADDRESS' },
            error: null,
        })
        const { result } = renderHook(() => useCardOnboardingAddressScreen())
        fillValidAddress(result)

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockGoToNextStep).toHaveBeenCalledWith({
                phase: 'MAILING_ADDRESS',
                localStep: OnboardingStep.Verification,
            }),
        )
        expect(mockNavigate).not.toHaveBeenCalledWith(
            'CardSignIn',
            expect.anything(),
        )
        expect(mockInfoToast).not.toHaveBeenCalled()
    })

    it.each([
        [
            'a duplicate',
            {
                response: { status: 409 },
                data: {
                    message: 'Duplicate onboardingId - record already exists',
                },
            },
        ],
        [
            "Baanx's 'Create user failed'",
            {
                response: { status: 400 },
                data: { message: 'Create user failed' },
            },
        ],
    ])(
        'routes %s to sign-in once the record has become an account',
        async (_label, failure) => {
            mockMutateAsync.mockRejectedValueOnce(failure)
            mockRefetchRecord.mockResolvedValueOnce(GONE_RECORD)
            mockProgressEmail = 'user@example.com'
            const { result } = renderHook(() =>
                useCardOnboardingAddressScreen(),
            )
            fillValidAddress(result)

            await act(async () => {
                result.current.handleConfirm()
            })

            await waitFor(() =>
                expect(mockNavigate).toHaveBeenCalledWith('CardSignIn', {
                    email: 'user@example.com',
                    finishesRegistration: true,
                }),
            )
            expect(mockInfoToast).toHaveBeenCalledWith(
                'peraCard.address.already_registered_title',
                'peraCard.address.already_registered_body',
            )
            expect(mockErrorToast).not.toHaveBeenCalled()
        },
    )

    it('shows the error when the record cannot be read after a duplicate', async () => {
        mockMutateAsync.mockRejectedValueOnce({
            response: { status: 409 },
            data: { message: 'Duplicate onboardingId - record already exists' },
        })
        mockRefetchRecord.mockResolvedValueOnce({
            data: undefined,
            error: { response: { status: 503 } },
        })
        const { result } = renderHook(() => useCardOnboardingAddressScreen())
        fillValidAddress(result)

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        expect(mockNavigate).not.toHaveBeenCalledWith(
            'CardSignIn',
            expect.anything(),
        )
        expect(mockGoToNextStep).not.toHaveBeenCalled()
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
            url: `${config.termsOfServiceUrl}?lang=en`,
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
        expect(mockOpenURL).toHaveBeenCalledWith(
            `${config.termsOfServiceUrl}?lang=en`,
        )
        expect(mockPushWebView).not.toHaveBeenCalled()
    })

    it('opens the US Baanx card T&C for a US resident', async () => {
        mockCountryIso = 'US'
        const { result } = renderHook(() => useCardOnboardingAddressScreen())
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
            url: `${config.termsOfServiceUrl}?lang=en`,
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
            url: `${config.termsOfServiceUrl}?lang=en`,
            id: 'card-terms',
        })
    })
})
