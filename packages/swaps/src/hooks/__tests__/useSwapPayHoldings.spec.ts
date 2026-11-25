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
import type {
    AccountChainAssetBalance,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSwapPayHoldings } from '../useSwapPayHoldings'

const mocks = vi.hoisted(() => ({
    sourceChains: {} as Record<string, string[]>,
    holdings: [] as unknown[],
    pendingAccountIds: [] as string[],
    hidden: {} as Record<string, string[]>,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    // Only the rows of the accounts asked for, so a read across accounts leaks into the result.
    useAccountsHoldingsAcrossChainsQuery: (accounts: { id: string }[]) => {
        const ids = accounts.map(({ id }) => id)
        return {
            assetBalances: (
                mocks.holdings as AccountChainAssetBalance[]
            ).filter(row => ids.includes(row.accountId)),
            isPending: ids.some(id => mocks.pendingAccountIds.includes(id)),
            isError: false,
        }
    },
    useHiddenTokensStore: (select: (state: unknown) => unknown) =>
        select({ hiddenTokens: {} }),
    canHideHolding: () => true,
    hiddenAssetIdsOf: (_tokens: unknown, address: string) =>
        mocks.hidden[address] ?? [],
}))

vi.mock('../useSwapSourceChainsResolver', () => {
    const resolver = (account: { id: string }) =>
        mocks.sourceChains[account.id] ?? []
    return { useSwapSourceChainsResolver: () => resolver }
})

vi.mock('../../utils/isSwappableAsset', () => ({
    isSwappableAsset: (asset?: { isCollectible?: boolean }) =>
        !!asset && !asset.isCollectible,
}))

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

const account = (id: string) => ({ id }) as WalletAccount
const FIRST = account('first')
const SECOND = account('second')

const holding = (
    accountId: string,
    assetId: string,
    amount: number,
    scope: { chainId: ChainId; networkId: string } = ALGO,
    asset: object = { name: assetId },
    restriction: unknown = null,
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
        restriction,
    }) as AccountChainAssetBalance

describe('swaps/useSwapPayHoldings', () => {
    beforeEach(() => {
        mocks.sourceChains = { first: ['algorand'], second: ['algorand'] }
        mocks.holdings = []
        mocks.pendingAccountIds = []
        mocks.hidden = {}
    })

    test("lists only the account's own rows at its own amount, without another account's holdings", () => {
        mocks.holdings = [
            holding('first', 'usdc', 2),
            holding('second', 'usdc', 5),
            holding('second', 'native', 9),
            holding('second', 'asa', 3),
        ]

        const { result } = renderHook(() => useSwapPayHoldings(FIRST))

        expect(result.current.holdings).toHaveLength(1)
        expect(result.current.holdings[0].assetId).toBe('usdc')
        expect(result.current.holdings[0].amount).toEqual(new Decimal(2))
        expect(result.current.holdings[0]).not.toHaveProperty('accountId')
        expect(result.current.holdings[0]).not.toHaveProperty('address')
    })

    test('lists nothing for an account with no holdings while another account holds ALGO and ASAs', () => {
        mocks.holdings = [
            holding('first', 'native', 0),
            holding('second', 'native', 2.35),
            holding('second', 'asa', 4),
        ]

        const { result } = renderHook(() => useSwapPayHoldings(FIRST))

        expect(result.current.holdings).toEqual([])
    })

    test("leaves out a holding on a chain the account can't pay from, a hidden token, a collectible and a zero-amount asset", () => {
        mocks.hidden = { 'second-address': ['hidden'] }
        mocks.holdings = [
            holding('second', 'native', 1, ETH),
            holding('second', 'hidden', 1),
            holding('second', 'nft', 1, ALGO, { isCollectible: true }),
            holding('second', 'opted-in', 0),
            holding('second', 'kept', 1),
        ]

        const { result } = renderHook(() => useSwapPayHoldings(SECOND))

        expect(result.current.holdings.map(h => h.assetId)).toEqual(['kept'])
    })

    test("names the account's source chains only, and nothing for a null account or one that can't sign", () => {
        mocks.sourceChains = {
            first: ['algorand', 'ethereum'],
            second: ['base'],
            watch: [],
        }
        mocks.holdings = [holding('second', 'usdc', 1, ALGO)]

        const first = renderHook(() => useSwapPayHoldings(FIRST))
        const none = renderHook(() => useSwapPayHoldings(null))
        const watch = renderHook(() => useSwapPayHoldings(account('watch')))

        expect(first.result.current.sourceChainIds).toEqual([
            'algorand',
            'ethereum',
        ])
        expect(none.result.current).toMatchObject({
            holdings: [],
            sourceChainIds: [],
        })
        expect(watch.result.current).toMatchObject({
            holdings: [],
            sourceChainIds: [],
        })
    })

    test("lists only the new account's rows after the account changes, and nothing while its read is pending", () => {
        mocks.holdings = [
            holding('first', 'a-only', 1),
            holding('second', 'b-only', 1),
        ]
        const { result, rerender } = renderHook(
            ({ who }) => useSwapPayHoldings(who),
            { initialProps: { who: FIRST } },
        )
        expect(result.current.holdings.map(h => h.assetId)).toEqual(['a-only'])

        rerender({ who: SECOND })
        expect(result.current.holdings.map(h => h.assetId)).toEqual(['b-only'])

        mocks.pendingAccountIds = ['first']
        rerender({ who: FIRST })
        expect(result.current.holdings).toEqual([])
        expect(result.current.isPending).toBe(true)
    })

    test('keeps a transfer-blocked holding with a balance, with its restriction', () => {
        const restriction = { reason: 'frozen' }
        mocks.holdings = [
            holding('first', 'frozen', 3, ALGO, { name: 'frozen' }, restriction),
        ]

        const { result } = renderHook(() => useSwapPayHoldings(FIRST))

        expect(result.current.holdings).toHaveLength(1)
        expect(result.current.holdings[0].restriction).toBe(restriction)
    })
})
