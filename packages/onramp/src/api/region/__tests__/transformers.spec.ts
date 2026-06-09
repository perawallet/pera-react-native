/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, expect, it } from 'vitest'

import { transformRampRegion } from '../transformers'
import type { RampRegionApiResponse } from '../schema'

const buildRegion = (
    overrides?: Partial<RampRegionApiResponse>,
): RampRegionApiResponse => ({
    country_code: 'US',
    country_name: 'United States',
    ...overrides,
})

describe('region transformers', () => {
    describe('transformRampRegion', () => {
        it('maps country_code to countryCode', () => {
            const result = transformRampRegion(buildRegion())

            expect(result.countryCode).toBe('US')
        })

        it('maps country_name to countryName', () => {
            const result = transformRampRegion(buildRegion())

            expect(result.countryName).toBe('United States')
        })

        it('preserves different country values', () => {
            const result = transformRampRegion(
                buildRegion({ country_code: 'DE', country_name: 'Germany' }),
            )

            expect(result.countryCode).toBe('DE')
            expect(result.countryName).toBe('Germany')
        })
    })
})
