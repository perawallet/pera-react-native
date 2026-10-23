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

const mockRequest = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))
vi.mock('@modules/card/components/CardCountryPicker', () => ({
    CardCountryPickerContent: () => null,
}))

import { usePreselectedCountryField } from '../usePreselectedCountryField'

const country = (iso3166alpha2: string): SupportedCountry => ({
    id: iso3166alpha2,
    iso3166alpha2,
    name: iso3166alpha2,
    callingCode: '1',
    canSignUp: true,
    cardProvider: null,
})
const GB = country('GB')
const FR = country('FR')
const COUNTRIES = [GB, FR]

describe('usePreselectedCountryField', () => {
    const onChange = vi.fn()
    beforeEach(() => vi.clearAllMocks())

    const renderField = (serverIso: string | null, residenceIso = 'GB') =>
        renderHook(() =>
            usePreselectedCountryField({
                serverIso,
                residenceIso,
                countries: COUNTRIES,
                pickerTitle: 'Pick',
                onChange,
            }),
        )

    it('preselects the residence when the record has none', async () => {
        const { result } = renderField(null)

        await waitFor(() => expect(result.current.selected).toEqual(GB))
        expect(result.current.isLocked).toBe(false)
        expect(onChange).toHaveBeenCalledWith(GB)
    })

    it("prefers the record's value and locks it", async () => {
        const { result } = renderField('FR')

        await waitFor(() => expect(result.current.selected).toEqual(FR))
        expect(result.current.isLocked).toBe(true)
    })

    it('stays editable when the record holds a country outside the list', async () => {
        const { result } = renderField('JP')

        await waitFor(() => expect(result.current.selected).toEqual(GB))
        expect(result.current.isLocked).toBe(false)
    })

    it('takes a pick from the sheet', async () => {
        mockRequest.mockResolvedValueOnce(FR)
        const { result } = renderField(null)
        await waitFor(() => expect(result.current.selected).toEqual(GB))

        act(() => result.current.handleSelect())

        await waitFor(() => expect(result.current.selected).toEqual(FR))
        expect(mockRequest.mock.calls[0][0].contents.props.title).toBe('Pick')
    })
})
