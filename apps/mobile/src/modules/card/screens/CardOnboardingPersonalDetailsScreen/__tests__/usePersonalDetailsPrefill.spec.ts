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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
    OnboardingDetails,
    SupportedCountry,
} from '@perawallet/wallet-core-card'
import { usePersonalDetailsPrefill } from '../usePersonalDetailsPrefill'

const country = (iso3166alpha2: string): SupportedCountry => ({
    id: iso3166alpha2,
    iso3166alpha2,
    name: iso3166alpha2,
    callingCode: '1',
    canSignUp: true,
    cardProvider: null,
})
const COUNTRIES = [country('ES'), country('FR')]

const record = (over: Partial<OnboardingDetails>): OnboardingDetails => ({
    verificationState: null,
    phase: null,
    email: null,
    countryOfResidence: null,
    firstName: null,
    lastName: null,
    dateOfBirth: null,
    countryOfNationality: null,
    countryOfBirth: null,
    additionalNationalities: [],
    portugalInvestmentScheme: null,
    occupation: null,
    occupationOther: null,
    sourceOfWealth: null,
    sourceOfWealthOther: null,
    businessSector: null,
    estimatedAnnualIncome: null,
    incomeCountries: [],
    ...over,
})

describe('usePersonalDetailsPrefill', () => {
    const setValue = vi.fn()
    const setExtraNationalities = vi.fn()
    beforeEach(() => vi.clearAllMocks())

    const prefill = (value: OnboardingDetails) =>
        renderHook(() =>
            usePersonalDetailsPrefill({
                record: value,
                countries: COUNTRIES,
                maxExtraNationalities: 2,
                setValue,
                setExtraNationalities,
            }),
        )

    it('fills what the record holds', () => {
        prefill(
            record({
                firstName: 'Ana',
                dateOfBirth: '1986-02-27T00:00:00.000Z',
                additionalNationalities: ['ES', 'JP'],
                portugalInvestmentScheme: false,
            }),
        )

        expect(setValue).toHaveBeenCalledWith('firstName', 'Ana', {
            shouldValidate: true,
        })
        expect(setValue).toHaveBeenCalledWith('dateOfBirth', '27/02/1986', {
            shouldValidate: true,
        })
        expect(setValue).not.toHaveBeenCalledWith(
            'lastName',
            expect.anything(),
            expect.anything(),
        )
        // JP is not a supported country, so only ES can be shown.
        expect(setExtraNationalities).toHaveBeenCalledWith([COUNTRIES[0]])
        expect(setValue).toHaveBeenCalledWith('portugalInvestmentScheme', false)
    })

    it('leaves a fresh registration empty', () => {
        prefill(record({}))

        expect(setValue).not.toHaveBeenCalled()
        expect(setExtraNationalities).not.toHaveBeenCalled()
    })
})
