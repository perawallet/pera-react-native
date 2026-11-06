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
import {
    ALGO_ROUTER_ID,
    USDC_ROUTER_ID,
    makeAlgoToken,
    makeFiatToken,
    makeRampToken,
} from '@test-utils/rampFixtures'

// USDC is listed first so the alphabetical-by-name sort must reorder it
// after ALGO ('Algorand' < 'USD Coin') in the result below.
const DESTINATIONS = [makeRampToken(), makeAlgoToken()]
const SOURCES = [makeFiatToken('USD')]

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
const mockUseRampDestinationsQuery = vi.hoisted(() => vi.fn())
const mockUseRampSourcesQuery = vi.hoisted(() => vi.fn())
const mockDestinationChains = vi.hoisted(() => ({
    current: [] as string[],
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mockResolve }),
}))

vi.mock('@perawallet/wallet-core-onramp', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-onramp')
    >()),
    useRampDestinationsQuery: mockUseRampDestinationsQuery,
    useRampSourcesQuery: mockUseRampSourcesQuery,
    useOnramp: () => ({ selectedDestinationTokenId: ALGO_ROUTER_ID }),
    useOnrampDestinationChains: () => mockDestinationChains.current,
}))

const SCOPES = {
    algorand: { chainId: 'algorand', networkId: 'mainnet' },
    ethereum: { chainId: 'ethereum', networkId: 'mainnet' },
} as const

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScope: (chainId: keyof typeof SCOPES) => SCOPES[chainId],
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

const renderDestinations = () =>
    renderHook(() =>
        useOnrampPairSelectionContent({ variant: 'destination', scope: SCOPE }),
    )

describe('useOnrampPairSelectionContent', () => {
    beforeEach(() => {
        registerAlgorandRampAdapter()
        vi.clearAllMocks()
        mockDestinationChains.current = ['algorand']
        mockUseRampDestinationsQuery.mockReturnValue({
            data: DESTINATIONS,
            isLoading: false,
        })
        mockUseRampSourcesQuery.mockReturnValue({
            data: SOURCES,
            isLoading: false,
        })
        mockUseAssetsQuery.mockReturnValue({ data: new Map() })
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map(),
        })
    })

    it('lists the destinations, sorted by name', () => {
        const { result } = renderDestinations()

        expect(result.current.items.map(i => i.token.id)).toEqual([
            ALGO_ROUTER_ID,
            USDC_ROUTER_ID,
        ])
    })

    it("lists the selected destination's sources for the source variant", () => {
        const { result } = renderHook(() =>
            useOnrampPairSelectionContent({ variant: 'source', scope: SCOPE }),
        )

        expect(result.current.items.map(i => i.token.id)).toEqual([
            SOURCES[0].id,
        ])
        expect(mockUseRampSourcesQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                destinationId: ALGO_ROUTER_ID,
                enabled: true,
            }),
        )
    })

    it('reads only the list its variant shows', () => {
        renderDestinations()

        expect(mockUseRampDestinationsQuery).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: true }),
        )
        expect(mockUseRampSourcesQuery).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false }),
        )
    })

    it('filters by name or symbol (case-insensitive)', () => {
        const { result } = renderDestinations()

        act(() => {
            result.current.setSearchFilter('usd')
        })

        expect(result.current.items.map(i => i.token.id)).toEqual([
            USDC_ROUTER_ID,
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

        const { result } = renderDestinations()

        const algo = result.current.items.find(
            i => i.token.id === ALGO_ROUTER_ID,
        )
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

        const { result } = renderDestinations()

        const usdc = result.current.items.find(
            i => i.token.id === USDC_ROUTER_ID,
        )
        expect(usdc?.balance?.toString()).toBe('25')
    })

    it("reads each token's asset for the network", () => {
        const usdcAsset = { assetId: USDC_MAINNET_ASSET_ID, name: 'USDC' }
        mockUseAssetsQuery.mockReturnValue({
            data: new Map([[USDC_MAINNET_ASSET_ID, usdcAsset]]),
        })

        const { result } = renderDestinations()

        expect(mockUseAssetsQuery).toHaveBeenCalledWith(
            SCOPE,
            [USDC_MAINNET_ASSET_ID, '0'],
            { fetchMissing: true },
        )
        const usdc = result.current.items.find(
            i => i.token.id === USDC_ROUTER_ID,
        )
        expect(usdc?.asset).toBe(usdcAsset)
    })

    it('returns null balance for tokens with no holding', () => {
        const { result } = renderDestinations()

        result.current.items.forEach(item => {
            expect(item.balance).toBeNull()
        })
    })

    it('resolves the selected token id', () => {
        const { result } = renderDestinations()

        act(() => {
            result.current.handleTokenSelected(DESTINATIONS[1])
        })

        expect(mockResolve).toHaveBeenCalledWith({
            chainId: 'algorand',
            tokenId: ALGO_ROUTER_ID,
        })
    })

    it('keeps the asset ids it fetches the same while the user searches', () => {
        const { result } = renderDestinations()
        const idsBefore = mockUseAssetsQuery.mock.calls.at(-1)?.[1]

        act(() => {
            result.current.setSearchFilter('usd')
        })

        expect(mockUseAssetsQuery.mock.calls.at(-1)?.[1]).toEqual(idsBefore)
    })

    describe('the chain chips', () => {
        it('offers none to an account on one chain', () => {
            const { result } = renderDestinations()

            expect(result.current.chainOptions).toEqual([])
        })

        it('offers one chip per fundable chain to an account on two', () => {
            mockDestinationChains.current = ['algorand', 'ethereum']

            const { result } = renderDestinations()

            expect(result.current.chainOptions.map(o => o.value)).toEqual([
                'algorand',
                'ethereum',
            ])
            expect(result.current.selectedChainId).toBe('algorand')
        })

        it("puts Fund's own chain first when the account cannot sign on it", () => {
            mockDestinationChains.current = ['ethereum']

            const { result } = renderDestinations()

            expect(result.current.chainOptions.map(o => o.value)).toEqual([
                'algorand',
                'ethereum',
            ])
        })

        it("lists the picked chip's chain, and a pick carries that chain", () => {
            mockDestinationChains.current = ['algorand', 'ethereum']
            const { result } = renderDestinations()

            act(() => {
                result.current.handleSelectChain('ethereum')
            })

            expect(result.current.listScope).toEqual(SCOPES.ethereum)
            expect(mockUseRampDestinationsQuery).toHaveBeenLastCalledWith(
                expect.objectContaining({ scope: SCOPES.ethereum }),
            )

            act(() => {
                result.current.handleTokenSelected(DESTINATIONS[1])
            })

            expect(mockResolve).toHaveBeenCalledWith({
                chainId: 'ethereum',
                tokenId: ALGO_ROUTER_ID,
            })
        })

        it('offers no chips for the source variant', () => {
            mockDestinationChains.current = ['algorand', 'ethereum']

            const { result } = renderHook(() =>
                useOnrampPairSelectionContent({
                    variant: 'source',
                    scope: SCOPE,
                }),
            )

            expect(result.current.chainOptions).toEqual([])
        })
    })

    it('exposes isLoading from the query', () => {
        mockUseRampDestinationsQuery.mockReturnValue({
            data: [],
            isLoading: true,
        })

        const { result } = renderDestinations()

        expect(result.current.isLoading).toBe(true)
        expect(result.current.items).toEqual([])
    })
})
