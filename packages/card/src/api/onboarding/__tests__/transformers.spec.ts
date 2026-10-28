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
import { CardProvider } from '../../../models'
import { transformRegistrationSettings } from '../transformers'

describe('onboarding transformers', () => {
    it('maps the country and US-state lists', () => {
        const settings = transformRegistrationSettings({
            countries: [
                {
                    id: 'c1',
                    iso3166alpha2: 'GB',
                    name: 'United Kingdom',
                    callingCode: '44',
                    canSignUp: true,
                },
            ],
            usStates: [
                {
                    id: 's1',
                    name: 'Alaska',
                    postalAbbreviation: 'AK',
                    canSignUp: true,
                },
            ],
        })

        expect(settings.countries[0].iso3166alpha2).toBe('GB')
        expect(settings.usStates[0].postalAbbreviation).toBe('AK')
    })

    it('maps a known card provider and nulls an absent or unknown one', () => {
        const country = (id: string, cardProvider?: string | null) => ({
            id,
            iso3166alpha2: id,
            name: id,
            callingCode: '1',
            canSignUp: true,
            cardProvider,
        })

        const settings = transformRegistrationSettings({
            countries: [
                country('PT', 'monavate'),
                country('GB'),
                country('US', 'someone_new'),
            ],
        })

        expect(settings.countries.map(entry => entry.cardProvider)).toEqual([
            CardProvider.Monavate,
            null,
            null,
        ])
    })

    it('passes the option lists through', () => {
        const occupation = { key: 'other_specify_occupation', name: 'Other' }

        const settings = transformRegistrationSettings({
            occupations: [occupation],
            employmentStatuses: [{ key: 'employed', name: 'Employed' }],
        })

        expect(settings.occupations).toEqual([occupation])
        expect(settings.employmentStatuses).toEqual([
            { key: 'employed', name: 'Employed' },
        ])
    })

    it('defaults missing lists to empty arrays', () => {
        const settings = transformRegistrationSettings({})

        expect(settings.countries).toEqual([])
        expect(settings.usStates).toEqual([])
        expect(settings.occupations).toEqual([])
        expect(settings.sourcesOfWealth).toEqual([])
        expect(settings.businessSectors).toEqual([])
        expect(settings.employmentSectors).toEqual([])
        expect(settings.employmentStatuses).toEqual([])
    })

    it('maps the per-jurisdiction T&C links', () => {
        const settings = transformRegistrationSettings({
            links: {
                us: { termsAndConditions: 'https://baanx/us-terms.pdf' },
                intl: { termsAndConditions: 'https://baanx/intl-terms.pdf' },
            },
        })

        expect(settings.termsAndConditionsUrls).toEqual({
            us: 'https://baanx/us-terms.pdf',
            intl: 'https://baanx/intl-terms.pdf',
        })
    })

    it('defaults the T&C links to null when the links block is absent', () => {
        const settings = transformRegistrationSettings({})

        expect(settings.termsAndConditionsUrls).toEqual({
            us: null,
            intl: null,
        })
    })
})
