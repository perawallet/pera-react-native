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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupportedCountry } from '@perawallet/wallet-core-card'

const mockUseRegistrationSettingsQuery = vi.fn()
vi.mock('@perawallet/wallet-core-card', () => ({
    useRegistrationSettingsQuery: () => mockUseRegistrationSettingsQuery(),
}))

const mockResolve = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mockResolve, dismiss: vi.fn() }),
}))

import { useCardCountryPicker } from '../useCardCountryPicker'

const makeCountry = (
    over: Partial<SupportedCountry> & { iso3166alpha2: string; name: string },
): SupportedCountry => ({
    id: over.iso3166alpha2,
    callingCode: '0',
    canSignUp: true,
    ...over,
})

const settingsResult = (countries: SupportedCountry[]) => ({
    data: { countries, usStates: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
})

describe('useCardCountryPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('excludes non-eligible countries and sorts by name', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue(
            settingsResult([
                makeCountry({ iso3166alpha2: 'US', name: 'United States' }),
                makeCountry({ iso3166alpha2: 'AL', name: 'Albania' }),
                makeCountry({
                    iso3166alpha2: 'RU',
                    name: 'Russia',
                    canSignUp: false,
                }),
            ]),
        )

        const { result } = renderHook(() => useCardCountryPicker())

        expect(result.current.countries.map(country => country.name)).toEqual([
            'Albania',
            'United States',
        ])
    })

    it('filters by name, case-insensitively', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue(
            settingsResult([
                makeCountry({ iso3166alpha2: 'GB', name: 'United Kingdom' }),
                makeCountry({ iso3166alpha2: 'US', name: 'United States' }),
                makeCountry({ iso3166alpha2: 'FR', name: 'France' }),
            ]),
        )

        const { result } = renderHook(() => useCardCountryPicker())

        act(() => {
            result.current.setSearch('KING')
        })

        expect(result.current.countries.map(country => country.name)).toEqual([
            'United Kingdom',
        ])
    })

    it('resolves the sheet with the selected country', () => {
        const france = makeCountry({ iso3166alpha2: 'FR', name: 'France' })
        mockUseRegistrationSettingsQuery.mockReturnValue(
            settingsResult([france]),
        )

        const { result } = renderHook(() => useCardCountryPicker())

        act(() => {
            result.current.handleSelect(france)
        })

        expect(mockResolve).toHaveBeenCalledWith(france)
    })

    it('surfaces loading state with an empty list', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() => useCardCountryPicker())

        expect(result.current.isLoading).toBe(true)
        expect(result.current.countries).toEqual([])
    })
})
