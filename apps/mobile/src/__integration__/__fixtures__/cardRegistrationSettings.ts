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

import type { RegistrationSettingsApiResponse } from '@perawallet/wallet-core-card/test-handlers'

// Raw GET /v1/auth/settings body for the card signup forms. Shaped like a
// Monavate environment: every `{ key, name }` list is populated.

type MockSettingsCountry = NonNullable<
    RegistrationSettingsApiResponse['countries']
>[number]

export const settingsCountry = (
    iso3166alpha2: string,
    name: string,
    callingCode = '1',
): MockSettingsCountry => ({
    id: iso3166alpha2.toLowerCase(),
    iso3166alpha2,
    name,
    callingCode,
    canSignUp: true,
    cardProvider: 'monavate',
})

export const OTHER_OCCUPATION_KEY = 'other_specify_occupation'
export const OTHER_SOURCE_OF_WEALTH_KEY = 'other_specify_source_of_wealth'

export const REGISTRATION_OPTION_LISTS = {
    occupations: [
        {
            key: 'it_or_technology_professional',
            name: 'IT / Technology Professional',
        },
        { key: OTHER_OCCUPATION_KEY, name: 'Other' },
    ],
    sourcesOfWealth: [
        { key: 'employment_salaried', name: 'Employment (Salaried)' },
        { key: OTHER_SOURCE_OF_WEALTH_KEY, name: 'Other' },
    ],
    businessSectors: [
        {
            key: 'information_and_communication',
            name: 'Information and communication',
        },
    ],
    employmentSectors: [
        { key: 'informationTechnology', name: 'Information technology' },
    ],
    employmentStatuses: [
        { key: 'employed', name: 'Employed' },
        { key: 'selfEmployed', name: 'Self-employed' },
    ],
} satisfies Partial<RegistrationSettingsApiResponse>

export const buildRegistrationSettingsResponse = (
    overrides: Partial<RegistrationSettingsApiResponse> = {},
): RegistrationSettingsApiResponse => ({
    countries: [
        settingsCountry('GB', 'United Kingdom', '44'),
        settingsCountry('US', 'United States of America'),
    ],
    usStates: [],
    ...REGISTRATION_OPTION_LISTS,
    ...overrides,
})
