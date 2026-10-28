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

const mockRequest = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))
vi.mock('../../components/CardOptionPicker', () => ({
    CardOptionPickerContent: () => null,
}))

import { useCardOptionField } from '../useCardOptionField'

const EMPLOYED = { key: 'employed', name: 'Employed' }

describe('useCardOptionField', () => {
    const onChange = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens the picker over its list and keeps the chosen option', async () => {
        mockRequest.mockResolvedValueOnce(EMPLOYED)
        const { result } = renderHook(() =>
            useCardOptionField({
                list: 'employmentStatuses',
                pickerTitle: 'Employment',
                onChange,
            }),
        )

        act(() => result.current.handleSelect())

        await waitFor(() => expect(result.current.selected).toEqual(EMPLOYED))
        expect(onChange).toHaveBeenCalledWith(EMPLOYED)
        expect(mockRequest.mock.calls[0][0].contents.props).toEqual({
            title: 'Employment',
            list: 'employmentStatuses',
        })
    })

    it('opens the picker over a fixed set of options the app owns', async () => {
        const bands = [
            { key: 'less_than_20k', name: 'Less than $20,000' },
            { key: 'more_than_100k', name: 'More than $100,000' },
        ]
        mockRequest.mockResolvedValueOnce(bands[1])
        const { result } = renderHook(() =>
            useCardOptionField({
                options: bands,
                pickerTitle: 'Income',
                onChange,
            }),
        )

        act(() => result.current.handleSelect())

        await waitFor(() => expect(result.current.selected).toEqual(bands[1]))
        expect(mockRequest.mock.calls[0][0].contents.props).toEqual({
            title: 'Income',
            options: bands,
        })
    })

    it('keeps the choice when the picker is dismissed', async () => {
        mockRequest.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() =>
            useCardOptionField({
                list: 'occupations',
                pickerTitle: 'Occupation',
                onChange,
            }),
        )

        act(() => result.current.handleSelect())
        await waitFor(() => expect(mockRequest).toHaveBeenCalled())

        expect(result.current.selected).toBeUndefined()
        expect(onChange).not.toHaveBeenCalled()
    })

    it('can be set without the picker', () => {
        const { result } = renderHook(() =>
            useCardOptionField({
                list: 'occupations',
                pickerTitle: 'Occupation',
                onChange,
            }),
        )

        act(() => result.current.setSelected(EMPLOYED))

        expect(result.current.selected).toEqual(EMPLOYED)
    })
})
