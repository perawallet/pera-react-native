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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { SupportedCountry } from '@perawallet/wallet-core-card'

import { getCountryName } from '../getCountryName'

const country = (iso3166alpha2: string, name: string): SupportedCountry => ({
    id: iso3166alpha2,
    iso3166alpha2,
    name,
    callingCode: '1',
    canSignUp: true,
})

const COUNTRIES = [country('US', 'United States'), country('DE', 'Germany')]

describe('getCountryName', () => {
    it('returns the display name for a known ISO code', () => {
        expect(getCountryName('DE', COUNTRIES)).toBe('Germany')
    })

    it('returns undefined for a code not in the list', () => {
        expect(getCountryName('ZZ', COUNTRIES)).toBeUndefined()
    })

    it('returns undefined when the code is missing or the list is empty', () => {
        expect(getCountryName(undefined, COUNTRIES)).toBeUndefined()
        expect(getCountryName('DE', [])).toBeUndefined()
    })
})
