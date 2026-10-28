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

import { describe, it, expect } from 'vitest'
import { toPersonalDetailsInput } from '../toPersonalDetailsInput'

const VALUES = {
    firstName: 'Ana',
    middleName: '',
    lastName: 'Silva',
    dateOfBirth: '27/02/1986',
    countryOfNationality: 'PT',
    countryOfBirth: 'PT',
    additionalNationalities: [],
    portugalInvestmentScheme: true,
    employmentStatus: '',
    employmentSector: '',
    ssn: '',
}
const CONTEXT = {
    onboardingId: 'ob_1',
    isUsResident: false,
    isPortugalResident: false,
}

describe('toPersonalDetailsInput', () => {
    it('sends only what was answered', () => {
        expect(toPersonalDetailsInput(VALUES, CONTEXT)).toEqual({
            onboardingId: 'ob_1',
            firstName: 'Ana',
            lastName: 'Silva',
            dateOfBirth: '1986-02-27',
            countryOfNationality: 'PT',
            countryOfBirth: 'PT',
            ssn: undefined,
        })
    })

    it('adds the optional answers when present', () => {
        expect(
            toPersonalDetailsInput(
                {
                    ...VALUES,
                    middleName: 'Maria',
                    additionalNationalities: ['ES'],
                    employmentStatus: 'employed',
                    employmentSector: 'retail',
                    ssn: '123-45-6789',
                },
                { ...CONTEXT, isUsResident: true, isPortugalResident: true },
            ),
        ).toMatchObject({
            middleName: 'Maria',
            additionalNationalities: ['ES'],
            portugalInvestmentScheme: true,
            employmentStatus: 'employed',
            employmentSector: 'retail',
            ssn: '123456789',
        })
    })
})
