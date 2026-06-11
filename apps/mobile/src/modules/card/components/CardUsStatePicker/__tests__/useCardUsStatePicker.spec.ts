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
import type { SupportedUsState } from '@perawallet/wallet-core-card'

const mockUseRegistrationSettingsQuery = vi.fn()
vi.mock('@perawallet/wallet-core-card', () => ({
    useRegistrationSettingsQuery: () => mockUseRegistrationSettingsQuery(),
}))

const mockResolve = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mockResolve, dismiss: vi.fn() }),
}))

import { useCardUsStatePicker } from '../useCardUsStatePicker'

const makeState = (
    postalAbbreviation: string,
    name: string,
    canSignUp = true,
): SupportedUsState => ({
    id: postalAbbreviation,
    postalAbbreviation,
    name,
    canSignUp,
})

const settingsResult = (usStates: SupportedUsState[]) => ({
    data: { countries: [], usStates },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
})

describe('useCardUsStatePicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('lists signup-eligible states sorted by name, hiding ineligible ones', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue(
            settingsResult([
                makeState('NY', 'New York'),
                makeState('CA', 'California'),
                makeState('AS', 'American Samoa', false),
                makeState('TX', 'Texas'),
            ]),
        )

        const { result } = renderHook(() => useCardUsStatePicker())

        expect(result.current.states.map(state => state.name)).toEqual([
            'California',
            'New York',
            'Texas',
        ])
    })

    it('filters by name, case-insensitively', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue(
            settingsResult([
                makeState('CA', 'California'),
                makeState('NY', 'New York'),
            ]),
        )

        const { result } = renderHook(() => useCardUsStatePicker())

        act(() => {
            result.current.setSearch('cali')
        })

        expect(result.current.states.map(state => state.name)).toEqual([
            'California',
        ])
    })

    it('resolves the sheet with the selected state', () => {
        const california = makeState('CA', 'California')
        mockUseRegistrationSettingsQuery.mockReturnValue(
            settingsResult([california]),
        )

        const { result } = renderHook(() => useCardUsStatePicker())

        act(() => {
            result.current.handleSelect(california)
        })

        expect(mockResolve).toHaveBeenCalledWith(california)
    })

    it('surfaces loading state with an empty list', () => {
        mockUseRegistrationSettingsQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() => useCardUsStatePicker())

        expect(result.current.isLoading).toBe(true)
        expect(result.current.states).toEqual([])
    })
})
