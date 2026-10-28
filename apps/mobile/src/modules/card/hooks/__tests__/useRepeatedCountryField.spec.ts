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
vi.mock('../../components/CardCountryPicker', () => ({
    CardCountryPickerContent: () => null,
}))

import { useRepeatedCountryField } from '../useRepeatedCountryField'

const country = (iso3166alpha2: string): SupportedCountry => ({
    id: iso3166alpha2,
    iso3166alpha2,
    name: iso3166alpha2,
    callingCode: '1',
    canSignUp: true,
    cardProvider: null,
})
const PT = country('PT')
const ES = country('ES')
const FR = country('FR')

describe('useRepeatedCountryField', () => {
    const onChange = vi.fn()
    const renderField = (max = 2) =>
        renderHook(() =>
            useRepeatedCountryField({ max, pickerTitle: 'Pick', onChange }),
        )

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('adds a picked country, up to the maximum', async () => {
        const { result } = renderField()

        mockRequest.mockResolvedValueOnce(PT)
        act(() => result.current.handleAdd())
        await waitFor(() => expect(result.current.countries).toEqual([PT]))
        expect(result.current.canAdd).toBe(true)

        mockRequest.mockResolvedValueOnce(ES)
        act(() => result.current.handleAdd())
        await waitFor(() => expect(result.current.countries).toEqual([PT, ES]))

        expect(result.current.canAdd).toBe(false)
        expect(onChange).toHaveBeenLastCalledWith([PT, ES])
        expect(mockRequest.mock.calls[0][0].contents.props.title).toBe('Pick')
    })

    it('replaces the country at an index', async () => {
        const { result } = renderField()
        act(() => result.current.setCountries([PT, ES]))

        mockRequest.mockResolvedValueOnce(FR)
        act(() => result.current.handleChange(1))

        await waitFor(() => expect(result.current.countries).toEqual([PT, FR]))
    })

    it('removes the country at an index', () => {
        const { result } = renderField()
        act(() => result.current.setCountries([PT, ES]))

        act(() => result.current.handleRemove(0))

        expect(result.current.countries).toEqual([ES])
        expect(onChange).toHaveBeenLastCalledWith([ES])
    })

    it('keeps the list when the picker is dismissed', async () => {
        const { result } = renderField()
        act(() => result.current.setCountries([PT]))

        mockRequest.mockResolvedValueOnce(undefined)
        act(() => result.current.handleAdd())
        await waitFor(() => expect(mockRequest).toHaveBeenCalled())

        expect(result.current.countries).toEqual([PT])
    })
})
