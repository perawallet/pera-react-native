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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        push: vi.fn(),
        replace: vi.fn(),
        goBack: vi.fn(),
        canGoBack: vi.fn(),
        reset: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return { ...actual, useAllAccounts: () => [] }
})

import {
    useAccountPickers,
    useCardPicker,
    usePortfolioPicker,
} from '../useAccountPickers'

describe('useCardPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps the browsing list shape', () => {
        const { result } = renderHook(() => useCardPicker())
        const { result: portfolio } = renderHook(() => usePortfolioPicker())

        expect(result.current.showSearch).toBe(portfolio.current.showSearch)
        expect(result.current.showPeraCardActivation).toBe(
            portfolio.current.showPeraCardActivation,
        )
    })

    // The screen underneath shows the card, not the picked account, so it has to
    // move; naming AccountDetails matters because 'Home' resolves to the card.
    it('returns to the wallet account on selection', () => {
        const { result } = renderHook(() => useCardPicker())

        result.current.onSelected?.({ address: 'ADDR_A' } as never)

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'AccountDetails' },
        })
    })

    it('leaves the portfolio picker without navigation, since it is already there', () => {
        const { result } = renderHook(() => usePortfolioPicker())

        expect(result.current.onSelected).toBeUndefined()
    })
})

// The drawer looks a picker up by the kind a screen published and calls its
// `onSelected`; a kind missing from this record is a screen whose selection
// silently does nothing.
describe('useAccountPickers', () => {
    it('offers the card kind, and only that kind navigates', () => {
        const { result } = renderHook(() => useAccountPickers())

        expect(Object.keys(result.current).sort()).toEqual([
            'card',
            'portfolio',
            'select',
        ])
        expect(result.current.card.onSelected).toBeDefined()
        expect(result.current.portfolio.onSelected).toBeUndefined()
        expect(result.current.select.onSelected).toBeUndefined()
    })
})
