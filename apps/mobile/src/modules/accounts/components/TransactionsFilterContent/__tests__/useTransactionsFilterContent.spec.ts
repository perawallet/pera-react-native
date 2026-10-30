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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTransactionsFilterContent } from '../useTransactionsFilterContent'
import { TransactionFilter } from '../types'

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mocks.resolve }),
}))

describe('useTransactionsFilterContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('resolves the filter the user picked', () => {
        const { result } = renderHook(() =>
            useTransactionsFilterContent({}),
        )

        act(() => result.current.handleFilterPress(TransactionFilter.Today))

        expect(mocks.resolve).toHaveBeenCalledWith({
            filter: TransactionFilter.Today,
        })
    })

    it('opens the custom range view instead of resolving', () => {
        const { result } = renderHook(() =>
            useTransactionsFilterContent({}),
        )

        act(() =>
            result.current.handleFilterPress(TransactionFilter.CustomRange),
        )

        expect(result.current.view).toBe('custom_range')
        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    it('keeps the custom range in order when the start moves past the end', () => {
        const from = new Date('2024-01-01')
        const to = new Date('2024-01-10')
        const { result } = renderHook(() =>
            useTransactionsFilterContent({
                initialCustomRange: { from, to },
            }),
        )

        act(() => result.current.handleDatePress('from'))
        act(() =>
            result.current.handleDateValueChange(
                {} as never,
                new Date('2024-02-01'),
            ),
        )

        expect(result.current.customRange.to.toISOString()).toBe(
            new Date('2024-02-01').toISOString(),
        )
    })
})
