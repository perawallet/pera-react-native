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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type CardTransaction } from '@perawallet/wallet-core-card'

const mockState = vi.hoisted(() => ({
    selectedFundingType: null as string | null,
    transactions: [] as CardTransaction[],
    isLoading: false,
}))
const mockInfoToast = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate }),
    }
})

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: (
            selector: (state: {
                selectedFundingType: string | null
            }) => unknown,
        ) => selector({ selectedFundingType: mockState.selectedFundingType }),
        useCardTransactionsQuery: () => ({
            transactions: mockState.transactions,
            isLoading: mockState.isLoading,
        }),
    }
})

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: mockInfoToast,
        errorToast: vi.fn(),
        successToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

import { usePeraCardOverview } from '../usePeraCardOverview'

const tx = (id: string, dateTime: string): CardTransaction =>
    ({ id, dateTime }) as unknown as CardTransaction

describe('usePeraCardOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState.selectedFundingType = null
        mockState.transactions = []
        mockState.isLoading = false
    })

    it('defaults to manual funding with stubbed zero balance/credits', () => {
        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.isAutoFunding).toBe(false)
        expect(result.current.currency).toBe('USDC')
        expect(result.current.balance.toString()).toBe('0')
        expect(result.current.credits.cashbacks.toString()).toBe('0')
        expect(result.current.credits.refunds.toString()).toBe('0')
    })

    it('reports auto funding when the selected type is AUTO', () => {
        mockState.selectedFundingType = 'AUTO'

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.isAutoFunding).toBe(true)
    })

    it('groups transactions by month, newest first', () => {
        mockState.transactions = [
            tx('a', '2026-06-10T10:00:00Z'),
            tx('b', '2026-07-15T10:00:00Z'),
        ]

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.transactionSections.map(s => s.key)).toEqual([
            '2026-07',
            '2026-06',
        ])
    })

    it('navigates to the Add Funds screen', () => {
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onAddFunds()

        expect(mockNavigate).toHaveBeenCalledWith('CardAddFunds')
    })

    it('unwired action handlers surface the coming-soon toast', () => {
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onWithdraw()
        result.current.onGetUsdc()

        expect(mockInfoToast).toHaveBeenCalled()
    })
})
