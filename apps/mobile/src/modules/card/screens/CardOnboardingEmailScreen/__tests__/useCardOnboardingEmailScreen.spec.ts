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
const mockWaitlistMutateAsync = vi.fn()
const mockSetOnboardingStep = vi.fn()
let mockSettings: { countries: SupportedCountry[]; usStates: [] } | undefined
let mockCurrentRegion: { iso3166alpha2: string; name: string } | undefined
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useSendEmailVerificationMutation: () => ({
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
        useRequestCountryAvailabilityMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockWaitlistMutateAsync,
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
        useCurrentRegionQuery: () => ({
            data: mockCurrentRegion,
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        }),
        useCardStore: (
            selector: (state: { setOnboardingStep: unknown }) => unknown,
        ) => selector({ setOnboardingStep: mockSetOnboardingStep }),
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

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

let mockDeviceId: string | null = 'device-1'
vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => mockDeviceId,
}))

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

const mockErrorToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        infoToast: vi.fn(),
        showToast: vi.fn(),
        successToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useCardOnboardingEmailScreen } from '../useCardOnboardingEmailScreen'

const france: SupportedCountry = {
    id: 'FR',
    iso3166alpha2: 'FR',
    name: 'France',
    callingCode: '33',
    canSignUp: true,
}

const russia: SupportedCountry = {
    id: 'RU',
    iso3166alpha2: 'RU',
    name: 'Russia',
    callingCode: '7',
    canSignUp: false,
}

const selectCountry = async (
    result: { current: ReturnType<typeof useCardOnboardingEmailScreen> },
    country: SupportedCountry,
) => {
    mockRequest.mockResolvedValueOnce(country)
    act(() => {
        result.current.handleSelectCountry()
    })
    await waitFor(() => expect(result.current.selectedCountry).toEqual(country))
}

describe('useCardOnboardingEmailScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDeviceId = 'device-1'
        mockSettings = { countries: [france, russia], usStates: [] }
        // Default: no detected region → nothing preselected.
        mockCurrentRegion = undefined
        mockMutateAsync.mockResolvedValue({ contactVerificationId: 'mock' })
    })

    it('starts with an invalid form and no selected country', () => {
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        expect(result.current.isValid).toBe(false)
        expect(result.current.selectedCountry).toBeUndefined()
        expect(result.current.isSubmitting).toBe(false)
        expect(result.current.isWaitlistCountry).toBe(false)
    })

    it('stores the country chosen from the picker', async () => {
        mockRequest.mockResolvedValue(france)
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        act(() => {
            result.current.handleSelectCountry()
        })

        await waitFor(() =>
            expect(result.current.selectedCountry).toEqual(france),
        )
        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                options: { size: 'full', autoCreateContainer: false },
            }),
        )
    })

    it('leaves the country unset when the picker is dismissed', async () => {
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        act(() => {
            result.current.handleSelectCountry()
        })

        await waitFor(() => expect(mockRequest).toHaveBeenCalled())
        expect(result.current.selectedCountry).toBeUndefined()
    })

    it('does not send the code while the form is invalid', async () => {
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    describe('email/send submission errors', () => {
        // Writes schema-valid values straight into the form store — no inputs
        // are rendered in a hook test, so this is the submit lever.
        const submitWithValidForm = async (result: {
            current: ReturnType<typeof useCardOnboardingEmailScreen>
        }) => {
            act(() => {
                Object.assign(result.current.control._formValues, {
                    email: 'john@example.com',
                    countryIso: 'FR',
                })
            })
            await act(async () => {
                result.current.handleConfirm()
            })
        }

        it('attributes a conflict (already registered) to the email field', async () => {
            mockMutateAsync.mockRejectedValueOnce({
                response: { status: 409 },
                data: { message: 'Email address already registered' },
            })
            const { result } = renderHook(() => useCardOnboardingEmailScreen())

            await submitWithValidForm(result)

            expect(result.current.errors.email?.message).toBe(
                'Email address already registered',
            )
            expect(mockErrorToast).not.toHaveBeenCalled()
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it("surfaces Baanx's own message on a non-conflict failure", async () => {
            mockMutateAsync.mockRejectedValueOnce({
                response: { status: 500 },
                data: { message: 'Registration is temporarily unavailable' },
            })
            const { result } = renderHook(() => useCardOnboardingEmailScreen())

            await submitWithValidForm(result)

            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.create_account.error_title',
                'Registration is temporarily unavailable',
            )
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('falls back to the generic body when the failure carries no message', async () => {
            mockMutateAsync.mockRejectedValueOnce(new Error('network down'))
            const { result } = renderHook(() => useCardOnboardingEmailScreen())

            await submitWithValidForm(result)

            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.create_account.error_title',
                'peraCard.create_account.error_body',
            )
        })
    })

    it('flags an unsupported country as a waitlist country', async () => {
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        await selectCountry(result, russia)

        expect(result.current.isWaitlistCountry).toBe(true)
    })

    it('joins the waitlist with the country + device, then opens the success sheet', async () => {
        mockWaitlistMutateAsync.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        await selectCountry(result, russia)
        act(() => {
            result.current.handleJoinWaitlist()
        })

        await waitFor(() =>
            expect(mockWaitlistMutateAsync).toHaveBeenCalledWith({
                countryCode: 'RU',
                deviceId: 'device-1',
            }),
        )
        // Second request() call (after the picker) opens the success sheet.
        await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(2))
        expect(mockRequest.mock.calls[1][0].contents.props.countryName).toBe(
            'Russia',
        )
    })

    it('returns home when the success sheet CTA is confirmed', async () => {
        mockWaitlistMutateAsync.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        await selectCountry(result, russia)
        mockRequest.mockResolvedValueOnce(true) // success-sheet CTA resolves true
        act(() => {
            result.current.handleJoinWaitlist()
        })

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
            }),
        )
    })

    it('does not call the waitlist endpoint when there is no device id', async () => {
        mockDeviceId = null
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        await selectCountry(result, russia)
        act(() => {
            result.current.handleJoinWaitlist()
        })

        expect(mockWaitlistMutateAsync).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalled()
    })

    it('shows an error toast and no success sheet when joining fails', async () => {
        mockWaitlistMutateAsync.mockRejectedValue(new Error('nope'))
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        await selectCountry(result, russia)
        act(() => {
            result.current.handleJoinWaitlist()
        })

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        // Only the picker request fired; the success sheet never opened.
        expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('preselects the detected region when it is a supported country', async () => {
        mockCurrentRegion = { iso3166alpha2: 'FR', name: 'France' }
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        await waitFor(() =>
            expect(result.current.selectedCountry).toEqual(france),
        )
        expect(result.current.isWaitlistCountry).toBe(false)
    })

    it('preselects an unsupported detected region and offers the waitlist', async () => {
        mockCurrentRegion = { iso3166alpha2: 'RU', name: 'Russia' }
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        await waitFor(() =>
            expect(result.current.selectedCountry).toEqual(russia),
        )
        expect(result.current.isWaitlistCountry).toBe(true)
    })

    it('does not preselect when the detected region is not in the supported list', async () => {
        mockCurrentRegion = { iso3166alpha2: 'ZZ', name: 'Nowhere' }
        const { result } = renderHook(() => useCardOnboardingEmailScreen())

        // Give the effect a chance to run before asserting nothing happened.
        await waitFor(() => expect(result.current).toBeTruthy())
        expect(result.current.selectedCountry).toBeUndefined()
    })
})
