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
import { useController } from 'react-hook-form'
import type {
    RegistrationOption,
    SupportedCountry,
} from '@perawallet/wallet-core-card'

const mockMutateAsync = vi.fn()
let mockOnboardingId: string | null = 'mock-onboarding-id'
let mockCountryIso: string | null = 'PT'
let mockIsRecordLoading = false
type MockRecord = {
    occupation: string | null
    occupationOther: string | null
    sourceOfWealth: string | null
    sourceOfWealthOther: string | null
    businessSector: string | null
    estimatedAnnualIncome: string | null
    incomeCountries: string[]
}
let mockRecord: MockRecord | undefined

const country = (iso3166alpha2: string, name: string): SupportedCountry => ({
    id: iso3166alpha2.toLowerCase(),
    iso3166alpha2,
    name,
    callingCode: '1',
    canSignUp: true,
    cardProvider: null,
})
const PORTUGAL = country('PT', 'Portugal')
const SPAIN = country('ES', 'Spain')
const FRANCE = country('FR', 'France')
const GERMANY = country('DE', 'Germany')
const USA = country('US', 'United States of America')

const IT_PRO: RegistrationOption = {
    key: 'it_or_technology_professional',
    name: 'IT / Technology Professional',
}
const OTHER_OCCUPATION: RegistrationOption = {
    key: 'other_specify_occupation',
    name: 'Other',
}
const SALARY: RegistrationOption = {
    key: 'employment_salaried',
    name: 'Employment (Salaried)',
}
const ICT: RegistrationOption = {
    key: 'information_and_communication',
    name: 'Information and communication',
}

const mockSettings = {
    countries: [PORTUGAL, SPAIN, FRANCE, GERMANY, USA],
    usStates: [],
    occupations: [IT_PRO, OTHER_OCCUPATION],
    sourcesOfWealth: [SALARY],
    businessSectors: [ICT],
    employmentSectors: [],
    employmentStatuses: [],
}

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useSubmitAdditionalDetailsMutation: () => ({
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
            data: mockIsRecordLoading ? undefined : mockRecord,
            isLoading: mockIsRecordLoading,
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

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }))
vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

import { useCardOnboardingAdditionalDetailsScreen } from '../useCardOnboardingAdditionalDetailsScreen'
import { registerAlgorandCardAdapter } from '@test-utils/cardChainAdapter'

// The text fields are typed through react-hook-form's own controller, the way
// the screen's inputs write to the form.
const renderScreenHook = () =>
    renderHook(() => {
        const screen = useCardOnboardingAdditionalDetailsScreen()
        const tin = useController({ control: screen.control, name: 'tin' })
        const income = useController({
            control: screen.control,
            name: 'estimatedAnnualIncome',
        })
        const occupationOther = useController({
            control: screen.control,
            name: 'occupationOther',
        })
        return {
            ...screen,
            setTin: tin.field.onChange,
            setIncome: income.field.onChange,
            setOccupationOther: occupationOther.field.onChange,
        }
    })

type HookResult = {
    current: ReturnType<typeof renderScreenHook>['result']['current']
}

const pick = async (
    result: HookResult,
    open: () => void,
    value: RegistrationOption | SupportedCountry,
) => {
    mockRequest.mockResolvedValueOnce(value)
    act(open)
    await waitFor(() => expect(mockRequest).toHaveBeenCalled())
}

const fillValidForm = async (result: HookResult) => {
    act(() => {
        result.current.setTin('123456789')
        result.current.setIncome('30000')
    })
    await pick(result, () => result.current.handleSelectOccupation(), IT_PRO)
    await waitFor(() =>
        expect(result.current.selectedOccupation).toEqual(IT_PRO),
    )
    await pick(
        result,
        () => result.current.handleSelectSourceOfWealth(),
        SALARY,
    )
    await waitFor(() =>
        expect(result.current.selectedSourceOfWealth).toEqual(SALARY),
    )
    await pick(result, () => result.current.handleSelectBusinessSector(), ICT)
    await waitFor(() =>
        expect(result.current.selectedBusinessSector).toEqual(ICT),
    )
}

describe('useCardOnboardingAdditionalDetailsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAlgorandCardAdapter()
        mockOnboardingId = 'mock-onboarding-id'
        mockCountryIso = 'PT'
        mockIsRecordLoading = false
        mockRecord = undefined
        mockMutateAsync.mockResolvedValue({ phase: 'PHYSICAL_ADDRESS' })
    })

    it('holds the form while the onboarding record loads', () => {
        mockIsRecordLoading = true

        const { result } = renderScreenHook()

        expect(result.current.isRecordLoading).toBe(true)
        expect(result.current.incomeCountries).toEqual([])
    })

    it('defaults the TIN country and the income country to the residence', async () => {
        const { result } = renderScreenHook()

        await waitFor(() =>
            expect(result.current.selectedTinCountry).toEqual(PORTUGAL),
        )
        expect(result.current.incomeCountries).toEqual([PORTUGAL])
        expect(result.current.isValid).toBe(false)
    })

    it('never preselects a US TIN country', async () => {
        mockCountryIso = 'US'

        const { result } = renderScreenHook()

        await waitFor(() =>
            expect(result.current.incomeCountries).toEqual([USA]),
        )
        expect(result.current.selectedTinCountry).toBeUndefined()
    })

    it('resumes from the answers the record already holds', async () => {
        mockRecord = {
            occupation: OTHER_OCCUPATION.key,
            occupationOther: 'Beekeeper',
            sourceOfWealth: SALARY.key,
            sourceOfWealthOther: null,
            businessSector: ICT.key,
            estimatedAnnualIncome: '42000',
            incomeCountries: ['ES', 'FR'],
        }

        const { result } = renderScreenHook()

        await waitFor(() =>
            expect(result.current.selectedOccupation).toEqual(OTHER_OCCUPATION),
        )
        expect(result.current.isOccupationOther).toBe(true)
        expect(result.current.selectedSourceOfWealth).toEqual(SALARY)
        expect(result.current.selectedBusinessSector).toEqual(ICT)
        expect(result.current.incomeCountries).toEqual([SPAIN, FRANCE])

        // The TIN is never returned, so it is the one field left to type.
        act(() => {
            result.current.setTin('123456789')
        })
        await waitFor(() => expect(result.current.isValid).toBe(true))
    })

    it('posts the details and continues to the address step', async () => {
        const { result } = renderScreenHook()
        await waitFor(() =>
            expect(result.current.selectedTinCountry).toEqual(PORTUGAL),
        )
        await fillValidForm(result)
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockMutateAsync).toHaveBeenCalledWith({
            onboardingId: 'mock-onboarding-id',
            tin: '123456789',
            tinCountry: 'PT',
            occupation: IT_PRO.key,
            sourceOfWealth: SALARY.key,
            businessSector: ICT.key,
            estimatedAnnualIncome: '30000',
            incomeCountries: ['PT'],
        })
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingAddress')
        expect(mockTrackEvent).toHaveBeenCalledWith(
            'card_onb_create_addlDetails_continue',
        )
    })

    it('requires the free text for the "other" occupation and sends it', async () => {
        const { result } = renderScreenHook()
        await waitFor(() =>
            expect(result.current.selectedTinCountry).toEqual(PORTUGAL),
        )
        await fillValidForm(result)
        await pick(
            result,
            () => result.current.handleSelectOccupation(),
            OTHER_OCCUPATION,
        )
        await waitFor(() => expect(result.current.isOccupationOther).toBe(true))
        expect(result.current.isValid).toBe(false)

        act(() => {
            result.current.setOccupationOther('Beekeeper')
        })
        await waitFor(() => expect(result.current.isValid).toBe(true))
        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockMutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                occupation: OTHER_OCCUPATION.key,
                occupationOther: 'Beekeeper',
            }),
        )
    })

    it('rejects a US TIN country', async () => {
        const { result } = renderScreenHook()
        await waitFor(() =>
            expect(result.current.selectedTinCountry).toEqual(PORTUGAL),
        )
        await fillValidForm(result)

        await pick(result, () => result.current.handleSelectTinCountry(), USA)

        await waitFor(() =>
            expect(result.current.errors.tinCountry).toBeTruthy(),
        )
        expect(result.current.isValid).toBe(false)
    })

    it('adds up to three income countries, flags a repeat and removes one', async () => {
        const { result } = renderScreenHook()
        await waitFor(() =>
            expect(result.current.incomeCountries).toEqual([PORTUGAL]),
        )

        await pick(result, () => result.current.handleAddIncomeCountry(), SPAIN)
        await waitFor(() =>
            expect(result.current.incomeCountries).toHaveLength(2),
        )
        await pick(
            result,
            () => result.current.handleAddIncomeCountry(),
            PORTUGAL,
        )
        await waitFor(() =>
            expect(result.current.hasDuplicateIncomeCountry).toBe(true),
        )
        expect(result.current.canAddIncomeCountry).toBe(false)

        await pick(
            result,
            () => result.current.handleChangeIncomeCountry(2),
            GERMANY,
        )
        await waitFor(() =>
            expect(result.current.hasDuplicateIncomeCountry).toBe(false),
        )
        expect(result.current.incomeCountries).toEqual([
            PORTUGAL,
            SPAIN,
            GERMANY,
        ])

        act(() => {
            result.current.handleRemoveIncomeCountry(1)
        })
        expect(result.current.incomeCountries).toEqual([PORTUGAL, GERMANY])
        expect(result.current.canAddIncomeCountry).toBe(true)
    })

    it('shows retry copy when Baanx is still loading its lists', async () => {
        mockMutateAsync.mockRejectedValueOnce({
            response: { status: 503 },
            data: { message: 'Risk standards are unavailable' },
        })
        const { result } = renderScreenHook()
        await waitFor(() =>
            expect(result.current.selectedTinCountry).toEqual(PORTUGAL),
        )
        await fillValidForm(result)
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.additional_details.unavailable_title',
                'peraCard.additional_details.unavailable_body',
            ),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("surfaces Baanx's message for any other failure", async () => {
        mockMutateAsync.mockRejectedValueOnce({
            response: { status: 400 },
            data: { message: 'Invalid tin' },
        })
        const { result } = renderScreenHook()
        await waitFor(() =>
            expect(result.current.selectedTinCountry).toEqual(PORTUGAL),
        )
        await fillValidForm(result)
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'peraCard.additional_details.error_title',
                'Invalid tin',
            ),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('routes back to email verification when the onboarding id is missing', async () => {
        mockOnboardingId = null
        const { result } = renderScreenHook()
        await waitFor(() =>
            expect(result.current.selectedTinCountry).toEqual(PORTUGAL),
        )
        await fillValidForm(result)
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleConfirm()
        })

        expect(mockMutateAsync).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingEmailVerify')
    })
})
