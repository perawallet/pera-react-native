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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import type { RampPair, RampToken } from '@perawallet/wallet-core-onramp'

const makeToken = (id: string, name: string, symbol: string): RampToken => ({
    id,
    symbol,
    name,
    fractionDecimals: 6,
    logo: null,
    network: { id: 'algorand', name: 'Algorand', logo: null },
    priceInUsd: null,
})

// USDC pair is listed first so the alphabetical-by-name sort must reorder it
// after ALGO ('Algorand' < 'USD Coin') in the deduped result below.
const PAIRS: RampPair[] = [
    {
        id: 'pair-usdc',
        sourceToken: makeToken('usd', 'US Dollar', 'USD'),
        destinationToken: makeToken('USDC_ALGORAND', 'USD Coin', 'USDC'),
        provider: { id: 'meld', paymentTypes: ['card'], limits: null },
    },
    {
        id: 'pair-algo',
        sourceToken: makeToken('usd', 'US Dollar', 'USD'),
        destinationToken: makeToken('ALGO', 'Algorand', 'ALGO'),
        provider: { id: 'meld', paymentTypes: ['card'], limits: null },
    },
]

const mockResolve = vi.fn()
const mockUseSelectedAccount = vi.hoisted(() => vi.fn())
const mockUseAccountBalancesQuery = vi.hoisted(() => vi.fn())
const mockUseRampPairsQuery = vi.hoisted(() => vi.fn())

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mockResolve }),
}))

vi.mock('@perawallet/wallet-core-onramp', () => ({
    useRampPairsQuery: mockUseRampPairsQuery,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: mockUseSelectedAccount,
    useAccountBalancesQuery: mockUseAccountBalancesQuery,
}))

import { useOnrampPairSelectionContent } from '../useOnrampPairSelectionContent'

describe('useOnrampPairSelectionContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseRampPairsQuery.mockReturnValue({ data: PAIRS, isLoading: false })
        mockUseSelectedAccount.mockReturnValue({ address: 'ADDR' })
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map(),
        })
    })

    it('dedupes to one row per destination token', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({ variant: 'destination' }),
        )

        expect(result.current.items.map(i => i.token.id)).toEqual([
            'ALGO',
            'USDC_ALGORAND',
        ])
    })

    it('dedupes to one row per source token', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({ variant: 'source' }),
        )

        expect(result.current.items.map(i => i.token.id)).toEqual(['usd'])
    })

    it('filters by name or symbol (case-insensitive)', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({ variant: 'destination' }),
        )

        act(() => {
            result.current.setSearchFilter('usd')
        })

        expect(result.current.items.map(i => i.token.id)).toEqual([
            'USDC_ALGORAND',
        ])
    })

    it('looks up ALGO balance under asset id 0', () => {
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map([
                [
                    'ADDR',
                    {
                        assetBalances: [
                            { assetId: '0', amount: new Decimal('1000000') },
                        ],
                    },
                ],
            ]),
        })

        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({ variant: 'destination' }),
        )

        const algo = result.current.items.find(i => i.token.id === 'ALGO')
        expect(algo?.balance?.toString()).toBe('1000000')
    })

    it('returns null balance for tokens with no holding', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({ variant: 'destination' }),
        )

        result.current.items.forEach(item => {
            expect(item.balance).toBeNull()
        })
    })

    it('resolves the selected token id', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({ variant: 'destination' }),
        )

        const algoPair = PAIRS.find(
            pair => pair.destinationToken.id === 'ALGO',
        )!
        act(() => {
            result.current.handleTokenSelected(algoPair.destinationToken)
        })

        expect(mockResolve).toHaveBeenCalledWith('ALGO')
    })

    it('exposes isLoading from the query', () => {
        mockUseRampPairsQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
        })

        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({ variant: 'destination' }),
        )

        expect(result.current.isLoading).toBe(true)
        expect(result.current.items).toEqual([])
    })
})
