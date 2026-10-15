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
    network: { id: 'ALGORAND', name: 'Algorand', logo: null },
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

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const SELECTED = {
    id: 'selected',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'ADDR' } },
}
const USDC_MAINNET_ASSET_ID = '31566704'

const mockResolve = vi.fn()
const mockUseAssetsQuery = vi.hoisted(() => vi.fn())
const mockUseAccountBalancesQuery = vi.hoisted(() => vi.fn())
const mockUseRampPairsQuery = vi.hoisted(() => vi.fn())

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mockResolve }),
}))

vi.mock(import('@perawallet/wallet-core-onramp'), async importOriginal => ({
    ...(await importOriginal()),
    useRampPairsQuery: mockUseRampPairsQuery,
}))

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: () => ({
        account: SELECTED,
        scope: SCOPE,
        address: 'ADDR',
    }),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useAssetsQuery: mockUseAssetsQuery,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    addressOn: (
        account: { chains: Record<string, { address: string }> },
        scope: { chainId: string },
    ) => account.chains[scope.chainId]?.address,
    useAccountBalancesQuery: mockUseAccountBalancesQuery,
}))

import { registerAlgorandRampAdapter } from '@test-utils/rampChainAdapter'
import { useOnrampPairSelectionContent } from '../useOnrampPairSelectionContent'

describe('useOnrampPairSelectionContent', () => {
    beforeEach(() => {
        registerAlgorandRampAdapter()
        vi.clearAllMocks()
        mockUseRampPairsQuery.mockReturnValue({ data: PAIRS, isLoading: false })
        mockUseAssetsQuery.mockReturnValue({ data: new Map() })
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map(),
        })
    })

    it('dedupes to one row per destination token', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({
                variant: 'destination',
                scope: SCOPE,
            }),
        )

        expect(result.current.items.map(i => i.token.id)).toEqual([
            'ALGO',
            'USDC_ALGORAND',
        ])
    })

    it('dedupes to one row per source token', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({ variant: 'source', scope: SCOPE }),
        )

        expect(result.current.items.map(i => i.token.id)).toEqual(['usd'])
    })

    it('filters by name or symbol (case-insensitive)', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({
                variant: 'destination',
                scope: SCOPE,
            }),
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
            useOnrampPairSelectionContent({
                variant: 'destination',
                scope: SCOPE,
            }),
        )

        const algo = result.current.items.find(i => i.token.id === 'ALGO')
        expect(algo?.balance?.toString()).toBe('1000000')
    })

    it("looks up USDC's balance under its asset id on the network", () => {
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map([
                [
                    'ADDR',
                    {
                        assetBalances: [
                            {
                                assetId: USDC_MAINNET_ASSET_ID,
                                amount: new Decimal('25'),
                            },
                        ],
                    },
                ],
            ]),
        })

        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({
                variant: 'destination',
                scope: SCOPE,
            }),
        )

        const usdc = result.current.items.find(
            i => i.token.id === 'USDC_ALGORAND',
        )
        expect(usdc?.balance?.toString()).toBe('25')
    })

    it("reads each token's asset for the network", () => {
        const usdcAsset = { assetId: USDC_MAINNET_ASSET_ID, name: 'USDC' }
        mockUseAssetsQuery.mockReturnValue({
            data: new Map([[USDC_MAINNET_ASSET_ID, usdcAsset]]),
        })

        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({
                variant: 'destination',
                scope: SCOPE,
            }),
        )

        expect(mockUseAssetsQuery).toHaveBeenCalledWith(
            SCOPE,
            ['0', USDC_MAINNET_ASSET_ID],
            { fetchMissing: true },
        )
        const usdc = result.current.items.find(
            i => i.token.id === 'USDC_ALGORAND',
        )
        expect(usdc?.asset).toBe(usdcAsset)
    })

    it('returns null balance for tokens with no holding', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({
                variant: 'destination',
                scope: SCOPE,
            }),
        )

        result.current.items.forEach(item => {
            expect(item.balance).toBeNull()
        })
    })

    it('resolves the selected token id', () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({
                variant: 'destination',
                scope: SCOPE,
            }),
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
            useOnrampPairSelectionContent({
                variant: 'destination',
                scope: SCOPE,
            }),
        )

        expect(result.current.isLoading).toBe(true)
        expect(result.current.items).toEqual([])
    })
})
