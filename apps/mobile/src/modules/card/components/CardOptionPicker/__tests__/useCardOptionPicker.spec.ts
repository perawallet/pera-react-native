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
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUseRegistrationSettingsQuery = vi.fn()
vi.mock('@perawallet/wallet-core-card', () => ({
    useRegistrationSettingsQuery: () => mockUseRegistrationSettingsQuery(),
}))

const mockResolve = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mockResolve, dismiss: vi.fn() }),
}))

import { useCardOptionPicker } from '../useCardOptionPicker'

const EMPLOYED = { key: 'employed', name: 'Employed' }
const SELF_EMPLOYED = { key: 'selfEmployed', name: 'Self-employed' }
const PENSIONER = { key: 'pensioner', name: 'Pensioner' }

const settingsResult = () => ({
    data: {
        employmentStatuses: [EMPLOYED, SELF_EMPLOYED, PENSIONER],
        occupations: [{ key: 'other_specify_occupation', name: 'Other' }],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
})

describe('useCardOptionPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('lists the requested settings list in the order Baanx sent it', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue(settingsResult())

        const { result } = renderHook(() =>
            useCardOptionPicker('employmentStatuses'),
        )

        expect(result.current.options).toEqual([
            EMPLOYED,
            SELF_EMPLOYED,
            PENSIONER,
        ])
    })

    it('filters by name, case-insensitively', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue(settingsResult())

        const { result } = renderHook(() =>
            useCardOptionPicker('employmentStatuses'),
        )
        act(() => {
            result.current.setSearch('EMPLOY')
        })

        expect(result.current.options).toEqual([EMPLOYED, SELF_EMPLOYED])
    })

    it('resolves the sheet with the selected option', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue(settingsResult())

        const { result } = renderHook(() =>
            useCardOptionPicker('employmentStatuses'),
        )
        act(() => {
            result.current.handleSelect(PENSIONER)
        })

        expect(mockResolve).toHaveBeenCalledWith(PENSIONER)
    })

    it('returns an empty list while settings load', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() => useCardOptionPicker('occupations'))

        expect(result.current.isLoading).toBe(true)
        expect(result.current.options).toEqual([])
    })

    it('refetches the settings on retry', () => {
        const refetch = vi.fn()
        mockUseRegistrationSettingsQuery.mockReturnValue({
            ...settingsResult(),
            isError: true,
            refetch,
        })

        const { result } = renderHook(() => useCardOptionPicker('occupations'))
        act(() => {
            result.current.refetch()
        })

        expect(refetch).toHaveBeenCalled()
    })
})
