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

// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { AccountChainAssetBalance } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSwapPayHoldings } from '../useSwapPayHoldings'

const mocks = vi.hoisted(() => ({
    sourceChains: {} as Record<string, string[]>,
    holdings: [] as unknown[],
    isPending: false,
    hidden: {} as Record<string, string[]>,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountsHoldingsAcrossChainsQuery: () => ({
        assetBalances: mocks.holdings,
        isPending: mocks.isPending,
        isError: false,
    }),
    useHiddenTokensStore: (select: (state: unknown) => unknown) =>
        select({ hiddenTokens: {} }),
    canHideHolding: () => true,
    hiddenAssetIdsOf: (_tokens: unknown, address: string) =>
        mocks.hidden[address] ?? [],
}))

vi.mock('../useSwapScope', () => ({
    useSwapSigningAccounts: () =>
        Object.keys(mocks.sourceChains).map(id => ({ id })),
}))

vi.mock('../useSwapSourceChainsResolver', () => ({
    useSwapSourceChainsResolver: () => (account: { id: string }) =>
        mocks.sourceChains[account.id] ?? [],
}))

vi.mock('../../utils/isSwappableAsset', () => ({
    isSwappableAsset: (asset?: { isCollectible?: boolean }) =>
        !!asset && !asset.isCollectible,
}))

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

const holding = (
    accountId: string,
    assetId: string,
    amount: number,
    scope: { chainId: ChainId; networkId: string } = ALGO,
    asset: object = { name: assetId },
): AccountChainAssetBalance =>
    ({
        accountId,
        address: `${accountId}-address`,
        assetId,
        asset,
        scope,
        amount: new Decimal(amount),
        nativeValue: new Decimal(amount),
        fiatValue: new Decimal(amount),
        restriction: null,
    }) as AccountChainAssetBalance

describe('swaps/useSwapPayHoldings', () => {
    beforeEach(() => {
        mocks.sourceChains = { first: ['algorand'], second: ['algorand'] }
        mocks.holdings = []
        mocks.isPending = false
        mocks.hidden = {}
    })

    test('lists an asset several accounts hold once, totalled, largest holder first', () => {
        mocks.holdings = [
            holding('first', 'usdc', 2),
            holding('second', 'usdc', 5),
        ]

        const { result } = renderHook(() => useSwapPayHoldings())

        expect(result.current.holdings).toHaveLength(1)
        expect(result.current.holdings[0].amount).toEqual(new Decimal(7))
        expect(
            result.current.holdings[0].holders.map(h => h.accountId),
        ).toEqual(['second', 'first'])
    })

    test("leaves out a holding on a chain its account can't pay from, a hidden token and a collectible", () => {
        mocks.hidden = { 'second-address': ['hidden'] }
        mocks.holdings = [
            holding('first', 'native', 1, ETH),
            holding('second', 'hidden', 1),
            holding('second', 'nft', 1, ALGO, { isCollectible: true }),
            holding('second', 'kept', 1),
        ]

        const { result } = renderHook(() => useSwapPayHoldings())

        expect(result.current.holdings.map(h => h.assetId)).toEqual(['kept'])
    })

    test('names every chain some account can pay from, once', () => {
        mocks.sourceChains = {
            first: ['algorand', 'ethereum'],
            second: ['ethereum', 'base'],
        }

        const { result } = renderHook(() => useSwapPayHoldings())

        expect(result.current.sourceChainIds).toEqual([
            'algorand',
            'ethereum',
            'base',
        ])
    })

    test("lists nothing until every account's holdings are read", () => {
        mocks.holdings = [holding('first', 'usdc', 1)]
        mocks.isPending = true

        const { result } = renderHook(() => useSwapPayHoldings())

        expect(result.current.holdings).toEqual([])
        expect(result.current.isPending).toBe(true)
    })
})
