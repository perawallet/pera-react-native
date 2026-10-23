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
    type RegistrationOption,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'

const mockMutateAsync = vi.fn()
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockCountryIso: string | null = 'GB'
type MockSettings = {
    countries: SupportedCountry[]
    usStates: []
    employmentStatuses: RegistrationOption[]
    employmentSectors: RegistrationOption[]
}
let mockSettings: MockSettings | undefined
type MockOnboardingDetails = {
    verificationState: string
    firstName: string | null
    lastName: string | null
    dateOfBirth: string | null
    countryOfNationality: string | null
    additionalNationalities?: string[]
    portugalInvestmentScheme?: boolean | null
}
let mockOnboardingDetails: MockOnboardingDetails | undefined
// The gate's own derivation is unit-tested in the card package
// (useOnboardingKycGate.spec.ts); here only the screen's wiring matters.
let mockIsKycRequired = false
let mockIsRecordLoading = false
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
            data: mockOnboardingDetails && {
                additionalNationalities: [],
                portugalInvestmentScheme: null,
                ...mockOnboardingDetails,
            },
            isLoading: mockIsRecordLoading,
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

vi.mock('@hooks/useLanguage')

import { useCardOnboardingPersonalDetailsScreen } from '../useCardOnboardingPersonalDetailsScreen'
import { registerAlgorandCardAdapter } from '@test-utils/cardChainAdapter'

const uk: SupportedCountry = {
    id: 'gb',
    iso3166alpha2: 'GB',
    name: 'United Kingdom',
    callingCode: '44',
    canSignUp: true,
    cardProvider: null,
}

const france: SupportedCountry = {
    id: 'fr',
    iso3166alpha2: 'FR',
    name: 'France',
    callingCode: '33',
    canSignUp: true,
    cardProvider: null,
}

const usa: SupportedCountry = {
    id: 'us',
    iso3166alpha2: 'US',
    name: 'United States of America',
    callingCode: '1',
    canSignUp: true,
    cardProvider: null,
}

const EMPLOYED: RegistrationOption = { key: 'employed', name: 'Employed' }
const IT_SECTOR: RegistrationOption = {
    key: 'informationTechnology',
    name: 'Information technology',
}
const settingsWith = (countries: SupportedCountry[]): MockSettings => ({
    countries,
    usStates: [],
    employmentStatuses: [EMPLOYED],
    employmentSectors: [IT_SECTOR],
})

type HookResult = {
    current: ReturnType<typeof useCardOnboardingPersonalDetailsScreen>
}

// The employment pickers have no server prefill, so every valid form needs them.
const pickEmployment = async (result: HookResult) => {
    mockRequest.mockResolvedValueOnce(EMPLOYED)
    act(() => {
        result.current.handleSelectEmploymentStatus()
    })
    await waitFor(() =>
        expect(result.current.selectedEmploymentStatus).toEqual(EMPLOYED),
    )
    mockRequest.mockResolvedValueOnce(IT_SECTOR)
    act(() => {
        result.current.handleSelectEmploymentSector()
    })
    await waitFor(() =>
        expect(result.current.selectedEmploymentSector).toEqual(IT_SECTOR),
    )
}

beforeEach(() => {
    registerAlgorandCardAdapter()
})

describe('useCardOnboardingPersonalDetailsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockOnboardingId = 'mock-onboarding-id'
        mockCountryIso = 'GB'
        mockSettings = settingsWith([uk, france])
        mockOnboardingDetails = undefined
        mockIsKycRequired = false
        mockIsRecordLoading = false
        mockMutateAsync.mockResolvedValue({ phase: 'PHYSICAL_ADDRESS' })
    })

    it('holds the form while the onboarding record is still loading', () => {
        mockIsRecordLoading = true
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        expect(result.current.isRecordLoading).toBe(true)
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

        // Prefilled identity (DOB converted to DD/MM/YYYY) plus the employment
        // picks make the form valid with no typing, and those fields are locked.
        await pickEmployment(result)
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

    describe('US residents', () => {
        it('asks for the SSN and keeps the form invalid until it is entered', async () => {
            mockCountryIso = 'US'
            mockSettings = settingsWith([uk, france, usa])
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )

            // Nationality is locked to the server value and the birth country
            // preselects from the residence, so the SSN is the only gap.
            await waitFor(() =>
                expect(result.current.selectedBirthCountry).toEqual(usa),
            )
            expect(result.current.isUsResident).toBe(true)
            expect(result.current.isValid).toBe(false)
        })

        it('does not ask anyone else for an SSN', async () => {
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )

            await pickEmployment(result)
            await waitFor(() => expect(result.current.isValid).toBe(true))
            expect(result.current.isUsResident).toBe(false)
        })
    })

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
            await pickEmployment(result)
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
        await pickEmployment(result)
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
                // Preselected from the residence country (GB), like nationality.
                countryOfBirth: 'GB',
            }),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('continues to additional details when Baanx asks for them', async () => {
        prefillValidForm()
        mockMutateAsync.mockResolvedValueOnce({ phase: 'ADDITIONAL_DETAILS' })
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )
        await pickEmployment(result)
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith(
                'CardOnboardingAdditionalDetails',
            ),
        )
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
        await pickEmployment(result)
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
        await pickEmployment(result)
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
        await pickEmployment(result)
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingAddress'),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    describe('employment', () => {
        it('opens the option sheet over the matching settings list and submits the picked keys', async () => {
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )

            await pickEmployment(result)
            const [statusRequest, sectorRequest] = mockRequest.mock.calls.map(
                call => call[0],
            )
            expect(statusRequest.contents.props).toEqual({
                title: 'peraCard.personal_details.employment_status_label',
                list: 'employmentStatuses',
            })
            expect(sectorRequest.contents.props.list).toBe('employmentSectors')
            await waitFor(() => expect(result.current.isValid).toBe(true))

            await act(async () => {
                result.current.handleConfirm()
            })

            expect(mockMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    employmentStatus: 'employed',
                    employmentSector: 'informationTechnology',
                }),
            )
        })

        it('keeps the form invalid until both employment fields are picked', async () => {
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )

            await waitFor(() =>
                expect(result.current.isFirstNameLocked).toBe(true),
            )
            expect(result.current.isValid).toBe(false)
        })
    })

    it('hides and skips employment when the environment lists no options', async () => {
        mockSettings = {
            ...settingsWith([uk, france]),
            employmentStatuses: [],
            employmentSectors: [],
        }
        prefillValidForm()
        const { result } = renderHook(() =>
            useCardOnboardingPersonalDetailsScreen(),
        )

        expect(result.current.hasEmploymentStatuses).toBe(false)
        expect(result.current.hasEmploymentSectors).toBe(false)
        await waitFor(() => expect(result.current.isValid).toBe(true))
        await act(async () => {
            result.current.handleConfirm()
        })

        const sent = mockMutateAsync.mock.calls[0][0]
        expect(sent).not.toHaveProperty('employmentStatus')
        expect(sent).not.toHaveProperty('employmentSector')
    })

    describe('additional nationalities', () => {
        const spain: SupportedCountry = {
            ...france,
            id: 'es',
            iso3166alpha2: 'ES',
            name: 'Spain',
        }

        const addNationality = async (
            result: HookResult,
            country: SupportedCountry,
        ) => {
            const before = result.current.additionalNationalities.length
            mockRequest.mockResolvedValueOnce(country)
            act(() => {
                result.current.handleAddNationality()
            })
            await waitFor(() =>
                expect(result.current.additionalNationalities).toHaveLength(
                    before + 1,
                ),
            )
        }

        it('allows two extra nationalities and sends them with the details', async () => {
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )
            await pickEmployment(result)

            await addNationality(result, france)
            expect(result.current.canAddNationality).toBe(true)
            await addNationality(result, spain)
            expect(result.current.canAddNationality).toBe(false)
            await waitFor(() => expect(result.current.isValid).toBe(true))

            await act(async () => {
                result.current.handleConfirm()
            })

            expect(mockMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    additionalNationalities: ['FR', 'ES'],
                }),
            )
        })

        it('changes and removes an extra nationality', async () => {
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )
            await addNationality(result, france)

            mockRequest.mockResolvedValueOnce(spain)
            act(() => {
                result.current.handleChangeAdditionalNationality(0)
            })
            await waitFor(() =>
                expect(result.current.additionalNationalities).toEqual([spain]),
            )

            act(() => {
                result.current.handleRemoveAdditionalNationality(0)
            })
            expect(result.current.additionalNationalities).toEqual([])
        })

        it('flags an extra nationality that repeats the main one and blocks submit', async () => {
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )
            await pickEmployment(result)
            await waitFor(() => expect(result.current.isValid).toBe(true))

            await addNationality(result, uk)

            await waitFor(() =>
                expect(
                    result.current.errors.additionalNationalities,
                ).toBeTruthy(),
            )
            expect(result.current.isValid).toBe(false)
        })

        it('omits the field when no extra nationality was added', async () => {
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )
            await pickEmployment(result)
            await waitFor(() => expect(result.current.isValid).toBe(true))

            await act(async () => {
                result.current.handleConfirm()
            })

            expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty(
                'additionalNationalities',
            )
        })

        it('prefills the extra nationalities the record already holds', async () => {
            mockOnboardingDetails = {
                verificationState: 'UNVERIFIED',
                firstName: null,
                lastName: null,
                dateOfBirth: null,
                countryOfNationality: null,
                additionalNationalities: ['FR', 'JP'],
            }
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )

            // JP is not a supported country, so only FR can be shown.
            await waitFor(() =>
                expect(result.current.additionalNationalities).toEqual([
                    france,
                ]),
            )
        })
    })

    describe('Portugal residents', () => {
        const portugal: SupportedCountry = {
            ...france,
            id: 'pt',
            iso3166alpha2: 'PT',
            name: 'Portugal',
        }

        it('asks about the investment scheme and sends the answer', async () => {
            mockCountryIso = 'PT'
            mockSettings = settingsWith([uk, france, portugal])
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )
            await pickEmployment(result)
            expect(result.current.isPortugalResident).toBe(true)
            expect(result.current.isPortugalInvestmentScheme).toBe(false)

            act(() => {
                result.current.handleTogglePortugalInvestmentScheme()
            })
            await waitFor(() =>
                expect(result.current.isPortugalInvestmentScheme).toBe(true),
            )
            await waitFor(() => expect(result.current.isValid).toBe(true))
            await act(async () => {
                result.current.handleConfirm()
            })

            expect(mockMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ portugalInvestmentScheme: true }),
            )
        })

        it('does not send the scheme answer for anyone else', async () => {
            prefillValidForm()
            const { result } = renderHook(() =>
                useCardOnboardingPersonalDetailsScreen(),
            )
            await pickEmployment(result)
            await waitFor(() => expect(result.current.isValid).toBe(true))

            await act(async () => {
                result.current.handleConfirm()
            })

            expect(result.current.isPortugalResident).toBe(false)
            expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty(
                'portugalInvestmentScheme',
            )
        })
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
