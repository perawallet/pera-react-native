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
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useAccountAssetSelectionList } from '../useAccountAssetSelectionList'

const mockUseSelectedAccount = vi.hoisted(() => vi.fn())
const mockUseAccountBalancesQuery = vi.hoisted(() => vi.fn())
const mockUseAccountHoldingsAcrossChainsQuery = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: mockUseSelectedAccount,
    useAccountBalancesQuery: mockUseAccountBalancesQuery,
    useAccountHoldingsAcrossChainsQuery:
        mockUseAccountHoldingsAcrossChainsQuery,
    useAccountScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
    chainAccountOf: (
        account: { chains: Record<string, unknown> },
        chainId: string,
    ) => account.chains[chainId],
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    nativeAssetFor: (chainId: string) => ({
        assetId: chainId === 'algorand' ? '0' : 'native',
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            has: () => true,
            get: () => ({
                descriptor: { networks: [{ id: 'mainnet', tier: 'mainnet' }] },
            }),
        },
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        useDebouncedValue: (value: unknown) => value,
    }
})

const mockAssetBalances = [
    {
        assetId: '31566704',
        amount: '500',
        asset: { assetId: '31566704', name: 'USD Coin', unitName: 'USDC' },
    },
    {
        assetId: '887406851',
        amount: '200',
        asset: { assetId: '887406851', name: 'Wrapped SOL', unitName: 'wSOL' },
    },
    {
        assetId: '0',
        amount: '1000000',
        asset: { assetId: '0', name: 'Algo', unitName: 'ALGO' },
    },
]

describe('useAccountAssetSelectionList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseSelectedAccount.mockReturnValue({
            chains: { algorand: { address: 'TEST_ADDRESS' } },
        })
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map([
                ['TEST_ADDRESS', { assetBalances: mockAssetBalances }],
            ]),
        })
        mockUseAccountHoldingsAcrossChainsQuery.mockReturnValue({
            assetBalances: [],
            isPending: false,
        })
    })

    it('returns all assets with Algo first', () => {
        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        expect(result.current.filteredBalanceData).toHaveLength(3)
        expect(result.current.filteredBalanceData[0].assetId).toBe('0')
    })

    it('filters by asset name', () => {
        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        act(() => {
            result.current.setSearchFilter('USD Coin')
        })

        expect(result.current.filteredBalanceData).toHaveLength(1)
        expect(result.current.filteredBalanceData[0].assetId).toBe('31566704')
    })

    it('filters by unit name', () => {
        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        act(() => {
            result.current.setSearchFilter('wSOL')
        })

        expect(result.current.filteredBalanceData).toHaveLength(1)
        expect(result.current.filteredBalanceData[0].assetId).toBe('887406851')
    })

    it('filters by asset ID', () => {
        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        act(() => {
            result.current.setSearchFilter('887406851')
        })

        expect(result.current.filteredBalanceData).toHaveLength(1)
        expect(result.current.filteredBalanceData[0].assetId).toBe('887406851')
    })

    it('returns empty array when no account selected', () => {
        mockUseSelectedAccount.mockReturnValue(null)
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map(),
        })

        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        expect(result.current.filteredBalanceData).toHaveLength(0)
    })

    it('excludes asset when excludeAssetId is provided', () => {
        const { result } = renderHook(() =>
            useAccountAssetSelectionList({ excludeAssetId: '0' }),
        )

        expect(result.current.filteredBalanceData).toHaveLength(2)
        expect(
            result.current.filteredBalanceData.every(
                item => item.assetId !== '0',
            ),
        ).toBe(true)
    })

    it('applies filterAsset predicate', () => {
        const { result } = renderHook(() =>
            useAccountAssetSelectionList({
                filterAsset: item => item.assetId === '31566704',
            }),
        )

        expect(result.current.filteredBalanceData).toHaveLength(1)
        expect(result.current.filteredBalanceData[0].assetId).toBe('31566704')
    })

    it('clears search when isVisible becomes false', () => {
        const { result, rerender } = renderHook(
            ({ isVisible }) => useAccountAssetSelectionList({ isVisible }),
            { initialProps: { isVisible: true as Optional<boolean> } },
        )

        act(() => {
            result.current.setSearchFilter('Algo')
        })

        expect(result.current.filteredBalanceData).toHaveLength(1)

        rerender({ isVisible: false })

        expect(result.current.searchFilter).toBe('')
        expect(result.current.filteredBalanceData).toHaveLength(3)
    })

    it("tags each of the account's own-chain holdings with that chain's scope", () => {
        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        expect(
            result.current.filteredBalanceData.every(
                item => item.scope.chainId === 'algorand',
            ),
        ).toBe(true)
        expect(mockUseAccountHoldingsAcrossChainsQuery).toHaveBeenCalledWith(
            null,
        )
    })

    it("lists holdings on every chain when asked, each chain's native asset first", () => {
        const account = {
            chains: {
                algorand: { address: 'TEST_ADDRESS' },
                ethereum: { address: '0xabc' },
            },
        }
        mockUseSelectedAccount.mockReturnValue(account)
        const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' }
        const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' }
        mockUseAccountHoldingsAcrossChainsQuery.mockReturnValue({
            assetBalances: [
                { assetId: '0xTOKEN', amount: '5', scope: ETHEREUM },
                { assetId: '31566704', amount: '500', scope: ALGORAND },
                { assetId: 'native', amount: '1', scope: ETHEREUM },
                { assetId: '0', amount: '1000000', scope: ALGORAND },
            ],
            isPending: false,
        })

        const { result } = renderHook(() =>
            useAccountAssetSelectionList({ isAcrossChains: true }),
        )

        expect(mockUseAccountHoldingsAcrossChainsQuery).toHaveBeenCalledWith(
            account,
        )
        expect(mockUseAccountBalancesQuery).toHaveBeenCalledWith(
            [],
            expect.anything(),
        )
        expect(
            result.current.filteredBalanceData.map(
                item => `${item.scope.chainId}:${item.assetId}`,
            ),
        ).toEqual([
            'ethereum:native',
            'algorand:0',
            'ethereum:0xTOKEN',
            'algorand:31566704',
        ])
    })

    describe('grouping', () => {
        const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' }
        const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' }
        const USDC_GROUP = { id: 'usdc', name: 'USD Coin', symbol: 'USDC' }
        const usdc = (
            scope: typeof ALGORAND,
            assetId: string,
            amount: string,
            group: Nullable<typeof USDC_GROUP> = USDC_GROUP,
        ) => ({
            assetId,
            scope,
            amount: new Decimal(amount),
            usdPrice: new Decimal(1),
            fiatValue: new Decimal(amount),
            restriction: null,
            asset: {
                assetId,
                name: 'USD Coin',
                unitName: 'USDC',
                decimals: 6,
                peraMetadata: { crossChainAssetGroup: group },
            },
        })
        const algoUsdc = usdc(ALGORAND, '31566704', '2.5')
        const ethUsdc = usdc(ETHEREUM, '0xa0b8', '1.5')

        const renderAcrossChains = (
            params: Parameters<typeof useAccountAssetSelectionList>[0] = {},
            assetBalances = [algoUsdc, ethUsdc],
        ) => {
            mockUseSelectedAccount.mockReturnValue({
                chains: {
                    algorand: { address: 'TEST_ADDRESS' },
                    ethereum: { address: '0xabc' },
                },
            })
            mockUseAccountHoldingsAcrossChainsQuery.mockReturnValue({
                assetBalances,
                isPending: false,
            })
            return renderHook(
                ({ isVisible }) =>
                    useAccountAssetSelectionList({
                        isAcrossChains: true,
                        isVisible,
                        ...params,
                    }),
                { initialProps: { isVisible: true as Optional<boolean> } },
            )
        }

        it('folds one asset held on two chains into a group whose members are the selectable rows', () => {
            const { result } = renderAcrossChains()

            expect(result.current.items.map(item => item.kind)).toEqual([
                'group',
            ])

            act(() => result.current.toggleGroupExpanded('usdc'))

            expect(
                result.current.items.map(item =>
                    item.kind === 'group'
                        ? `group:${item.group.id}`
                        : `${item.isGroupMember ? 'member' : 'row'}:${item.holding.scope.chainId}`,
                ),
            ).toEqual(['group:usdc', 'member:algorand', 'member:ethereum'])
        })

        it('lists a lone search match of a group as a plain row', () => {
            const { result } = renderAcrossChains()

            act(() => result.current.setSearchFilter('0xa0b8'))

            expect(result.current.items).toEqual([
                { kind: 'holding', holding: ethUsdc, isGroupMember: false },
            ])
        })

        it('drops to a plain row when the filter leaves one member', () => {
            const { result } = renderAcrossChains({
                filterAsset: item => item.assetId !== '31566704',
            })

            expect(result.current.items.map(item => item.kind)).toEqual([
                'holding',
            ])
        })

        it('folds nothing when the list holds one chain', () => {
            const { result } = renderAcrossChains({}, [
                algoUsdc,
                usdc(ALGORAND, '0xa0b8', '1.5'),
            ])

            expect(result.current.items.map(item => item.kind)).toEqual([
                'holding',
                'holding',
            ])
        })

        it('lists every holding as before when none is in a group', () => {
            const { result } = renderAcrossChains({}, [
                usdc(ALGORAND, '31566704', '2.5', null),
                usdc(ETHEREUM, '0xa0b8', '1.5', null),
            ])
            act(() => result.current.setSearchFilter('USD'))

            expect(result.current.items).toEqual(
                result.current.filteredBalanceData.map(holding => ({
                    kind: 'holding',
                    holding,
                    isGroupMember: false,
                })),
            )
            expect(result.current.items).toHaveLength(2)
        })

        it('collapses its groups when the picker is hidden', () => {
            const { result, rerender } = renderAcrossChains()
            act(() => result.current.toggleGroupExpanded('usdc'))
            expect(result.current.items).toHaveLength(3)

            rerender({ isVisible: false })

            expect(result.current.items).toHaveLength(1)
        })
    })
})
