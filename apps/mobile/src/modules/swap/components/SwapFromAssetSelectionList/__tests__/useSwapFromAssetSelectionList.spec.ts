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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { ChainAssetBalance } from '@perawallet/wallet-core-accounts'
import {
    useSwapFromAssetSelectionList,
    type UseSwapFromAssetSelectionListResult,
} from '../useSwapFromAssetSelectionList'

const mocks = vi.hoisted(() => ({
    account: { id: 'first' } as { id: string } | null,
    holdingsByAccount: {} as Record<string, unknown[]>,
    sourceChainIds: [] as string[],
    isPending: false,
    isError: false,
    askedFor: [] as unknown[],
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapAccount: () => mocks.account,
    useSwapPayHoldings: (account: { id: string } | null) => {
        mocks.askedFor.push(account)
        return {
            holdings: account
                ? (mocks.holdingsByAccount[account.id] ?? [])
                : [],
            sourceChainIds: mocks.sourceChainIds,
            isPending: mocks.isPending,
            isError: mocks.isError,
        }
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    getChainDescriptor: (chainId: string) => ({
        family: chainId === 'algorand' ? 'algorand' : 'evm',
    }),
}))

vi.mock('@modules/chain-ui', () => ({
    chainUiFor: (family: string) => ({
        swapAssetSearchPlaceholder:
            family === 'algorand' ? 'placeholder.algorand' : 'placeholder.evm',
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    useDebouncedValue: (value: unknown) => value,
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const holding = (
    assetId: string,
    chainId: ChainId = 'algorand',
    name = `Asset ${assetId}`,
    unitName = `A${assetId}`,
): ChainAssetBalance =>
    ({
        assetId,
        asset: { name, unitName },
        scope: { chainId, networkId: 'mainnet' },
        amount: new Decimal(1),
    }) as unknown as ChainAssetBalance

describe('useSwapFromAssetSelectionList', () => {
    beforeEach(() => {
        mocks.account = { id: 'first' }
        mocks.holdingsByAccount = {}
        mocks.sourceChainIds = ['algorand', 'ethereum']
        mocks.isPending = false
        mocks.isError = false
        mocks.askedFor = []
    })

    const setHoldings = (holdings: unknown[]) => {
        mocks.holdingsByAccount = { first: holdings }
    }

    it('lists every source chain and names each row on All', () => {
        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )

        expect(result.current.visibleChainIds).toEqual(['algorand', 'ethereum'])
        expect(result.current.chainOptions).toHaveLength(3)
        expect(result.current.isChainShown).toBe(true)
    })

    it('stops naming rows once a chain is picked, and lists only its holdings', () => {
        setHoldings([holding('1'), holding('native', 'ethereum')])
        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )

        act(() => result.current.handleSelectChain('ethereum'))

        expect(result.current.visibleChainIds).toEqual(['ethereum'])
        expect(result.current.isChainShown).toBe(false)
        expect(result.current.holdings.map(h => h.assetId)).toEqual(['native'])
    })

    it('has no chips when the account pays from one chain', () => {
        mocks.sourceChainIds = ['algorand']

        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )

        expect(result.current.chainOptions).toEqual([])
    })

    it('keeps the swap chain first among the chains offered', () => {
        mocks.sourceChainIds = ['ethereum', 'algorand', 'base']

        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )

        expect(result.current.visibleChainIds).toEqual([
            'algorand',
            'ethereum',
            'base',
        ])
    })

    it("omits the swap chain when the account can't pay from it", () => {
        mocks.sourceChainIds = ['ethereum', 'base']

        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )

        expect(result.current.visibleChainIds).toEqual(['ethereum', 'base'])
    })

    it('keeps the chain chips stable across renders', () => {
        const { result, rerender } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )
        const { chainOptions } = result.current

        rerender()

        expect(result.current.chainOptions).toBe(chainOptions)
    })

    it('follows the picked chip with the placeholder of its network', () => {
        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )
        expect(result.current.searchPlaceholder).toBe(
            'swap.asset_selection.search_placeholder_all',
        )

        act(() => result.current.handleSelectChain('ethereum'))
        expect(result.current.searchPlaceholder).toBe('placeholder.evm')
    })

    it('leaves out the asset the swap receives and puts the native coin first', () => {
        setHoldings([holding('1'), holding('2'), holding('0')])

        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE, {
                chainId: 'algorand',
                assetId: '2',
            }),
        )

        expect(result.current.holdings.map(h => h.assetId)).toEqual(['0', '1'])
    })

    it('reads the swap account', () => {
        renderHook(() => useSwapFromAssetSelectionList(SCOPE))

        expect(mocks.askedFor.at(-1)).toBe(mocks.account)
    })

    it("lists only the new account's rows once the swap account changes", () => {
        mocks.holdingsByAccount = {
            first: [holding('a-only')],
            second: [holding('b-only')],
        }
        const { result, rerender } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )
        expect(result.current.holdings.map(h => h.assetId)).toEqual(['a-only'])

        mocks.account = { id: 'second' }
        rerender()

        expect(result.current.holdings.map(h => h.assetId)).toEqual(['b-only'])
    })

    describe('emptyState', () => {
        it('is search while a search term is set', () => {
            const { result } = renderHook(() =>
                useSwapFromAssetSelectionList(SCOPE),
            )

            act(() => result.current.setSearchFilter('nothing'))

            expect(result.current.emptyState).toBe('search')
        })

        it('is null when a read failed', () => {
            mocks.isError = true

            const { result } = renderHook(() =>
                useSwapFromAssetSelectionList(SCOPE),
            )

            expect(result.current.emptyState).toBeNull()
        })

        it('is network when a chip is picked, or when only one chain can pay', () => {
            const { result } = renderHook(() =>
                useSwapFromAssetSelectionList(SCOPE),
            )
            act(() => result.current.handleSelectChain('ethereum'))
            expect(result.current.emptyState).toBe('network')

            mocks.sourceChainIds = ['algorand']
            const single = renderHook(() =>
                useSwapFromAssetSelectionList(SCOPE),
            )
            expect(single.result.current.emptyState).toBe('network')
        })

        it('is account on All with chips', () => {
            const { result } = renderHook(() =>
                useSwapFromAssetSelectionList(SCOPE),
            )

            expect(result.current.emptyState).toBe('account')
        })
    })

    describe('searching across networks', () => {
        const ETHEREUM_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

        const holdingsOnEveryNetwork = () => [
            holding('native', 'ethereum', 'Ether', 'ETH'),
            holding('native', 'base', 'Ether', 'ETH'),
            holding(ETHEREUM_USDC, 'ethereum', 'USD Coin', 'USDC'),
            holding('386195940', 'algorand', 'goETH', 'goETH'),
            holding('31566704', 'algorand', 'USDC', 'USDC'),
        ]

        const foundBy = (
            result: { current: UseSwapFromAssetSelectionListResult },
            term: string,
        ) => {
            act(() => result.current.setSearchFilter(term))
            return result.current.holdings
                .map(h => `${h.scope.chainId}:${h.asset?.unitName}`)
                .sort()
        }

        beforeEach(() => {
            setHoldings(holdingsOnEveryNetwork())
            mocks.sourceChainIds = ['algorand', 'ethereum', 'base']
        })

        it('finds EVM assets by symbol on every network', () => {
            const { result } = renderHook(() =>
                useSwapFromAssetSelectionList(SCOPE),
            )

            expect(foundBy(result, 'eth')).toEqual([
                'algorand:goETH',
                'base:ETH',
                'ethereum:ETH',
            ])
            expect(foundBy(result, ' ETH ')).toEqual([
                'algorand:goETH',
                'base:ETH',
                'ethereum:ETH',
            ])
        })

        it('finds EVM assets by name', () => {
            const { result } = renderHook(() =>
                useSwapFromAssetSelectionList(SCOPE),
            )

            expect(foundBy(result, 'usd coin')).toEqual(['ethereum:USDC'])
            expect(foundBy(result, 'ether')).toEqual([
                'base:ETH',
                'ethereum:ETH',
            ])
        })

        it('searches only the picked network', () => {
            const { result } = renderHook(() =>
                useSwapFromAssetSelectionList(SCOPE),
            )

            act(() => result.current.handleSelectChain('base'))

            expect(foundBy(result, 'eth')).toEqual(['base:ETH'])
        })
    })
})
