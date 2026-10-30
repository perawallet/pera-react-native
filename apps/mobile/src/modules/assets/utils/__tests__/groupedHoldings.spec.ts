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

import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { AssetGroup, PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    buildGroupedHoldingItems,
    groupedHoldingItemKey,
    type GroupableHoldingAdapter,
    type GroupedHoldingItem,
} from '../groupedHoldings'

const DESCRIPTOR = {
    networks: [
        { id: 'mainnet', tier: 'mainnet' },
        { id: 'testnet', tier: 'testnet' },
    ],
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: { has: () => true, get: () => ({ descriptor: DESCRIPTOR }) },
    }),
}))

const ALGO_MAINNET: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ALGO_TESTNET: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const ETH_MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

type TestHolding = {
    scope: ChainScope
    assetId: string
    /** Base units. */
    amount: Decimal
    /** Null stands in for metadata that hasn't synced. */
    decimals: Nullable<number>
    usdPrice: Nullable<Decimal>
    group: Nullable<AssetGroup>
}

const adapter: GroupableHoldingAdapter<TestHolding> = {
    assetOf: holding =>
        holding.decimals === null
            ? null
            : ({
                  assetId: holding.assetId,
                  decimals: holding.decimals,
              } as PeraAsset),
    displayAmountOf: (holding, asset) =>
        baseUnitsToDisplayUnits(holding.amount, asset.decimals),
    usdPriceOf: holding => holding.usdPrice,
    groupOf: holding => holding.group,
}

const USDC_GROUP: AssetGroup = { id: 'usdc', name: 'USD Coin', symbol: 'USDC' }

const USDC_MEMBER_IDS = new Set(['31566704', '0xA0b8'])

const holding = (
    scope: ChainScope,
    assetId: string,
    amount: string,
    decimals: Nullable<number> = 6,
    usdPrice: Nullable<Decimal> = new Decimal(1),
): TestHolding => ({
    scope,
    assetId,
    amount: new Decimal(amount),
    decimals,
    usdPrice,
    group: USDC_MEMBER_IDS.has(assetId) ? USDC_GROUP : null,
})

const build = (
    holdings: TestHolding[],
    { expanded = [] }: { expanded?: string[] } = {},
) =>
    buildGroupedHoldingItems({
        holdings,
        expandedGroupIds: new Set(expanded),
        adapter,
    })

const describeItems = (items: GroupedHoldingItem<TestHolding>[]) =>
    items.map(item =>
        item.kind === 'group'
            ? `group:${item.group.id}`
            : `${item.isGroupMember ? 'member' : 'row'}:${item.holding.assetId}`,
    )

const groupAt = (items: GroupedHoldingItem<TestHolding>[], index: number) => {
    const item = items[index]
    if (item?.kind !== 'group') throw new Error(`no group at ${index}`)
    return item
}

describe('buildGroupedHoldingItems', () => {
    const algoUsdc = holding(ALGO_MAINNET, '31566704', '2500000')
    const ethUsdc = holding(ETH_MAINNET, '0xA0b8', '1500000000000000000', 18)
    const algo = holding(ALGO_MAINNET, '0', '1000000')

    it("folds a group's members into one item at the first member's position", () => {
        const items = build([algo, algoUsdc, ethUsdc])

        expect(describeItems(items)).toEqual(['row:0', 'group:usdc'])
        expect(groupAt(items, 1).members.map(m => m.holding)).toEqual([
            algoUsdc,
            ethUsdc,
        ])
    })

    it('sums members in display units across different decimals, and the parts add up to it', () => {
        const group = groupAt(build([algoUsdc, ethUsdc]), 0)

        expect(group.amount).toBeInstanceOf(Decimal)
        expect(group.amount?.toString()).toBe('4')
        const parts = group.members.reduce(
            (total, member) => total.plus(member.displayAmount ?? 0),
            new Decimal(0),
        )
        expect(parts.equals(group.amount ?? -1)).toBe(true)
    })

    it("totals USD at each network's own price, so a depeg on one network shows", () => {
        const depegged = holding(
            ETH_MAINNET,
            '0xA0b8',
            '1500000000000000000',
            18,
            new Decimal('0.9'),
        )

        const group = groupAt(build([algoUsdc, depegged]), 0)

        // 2.5 at $1 plus 1.5 at $0.90; the amount stays 4.
        expect(group.amount?.toString()).toBe('4')
        expect(group.usdValue?.toString()).toBe('3.85')
    })

    it("leaves the USD total unknown while a member's price is", () => {
        const unpriced = holding(ETH_MAINNET, '0xA0b8', '1', 18, null)

        const group = groupAt(build([algoUsdc, unpriced]), 0)

        expect(group.usdValue).toBeNull()
        expect(group.amount).not.toBeNull()
    })

    it('totals USD past an unpriced member that holds none', () => {
        const emptyUnpriced = holding(ETH_MAINNET, '0xA0b8', '0', 18, null)

        const group = groupAt(build([algoUsdc, emptyUnpriced]), 0)

        expect(group.usdValue?.toString()).toBe('2.5')
    })

    it("leaves the sum unknown while a member's metadata hasn't synced", () => {
        const unsynced = holding(ETH_MAINNET, '0xA0b8', '1', null)

        const group = groupAt(build([algoUsdc, unsynced]), 0)

        expect(group.amount).toBeNull()
        expect(group.members[1]?.asset).toBeNull()
    })

    it('follows an expanded group with its members', () => {
        const items = build([algoUsdc, algo, ethUsdc], { expanded: ['usdc'] })

        expect(describeItems(items)).toEqual([
            'group:usdc',
            'member:31566704',
            'member:0xA0b8',
            'row:0',
        ])
        expect(groupAt(items, 0).isExpanded).toBe(true)
    })

    it('keeps two same-symbol assets in no group as separate rows', () => {
        const lookalike = holding(ETH_MAINNET, '0xFAKE', '1000000')

        expect(describeItems(build([algoUsdc, lookalike]))).toEqual([
            'row:31566704',
            'row:0xFAKE',
        ])
    })

    it('keeps a lone present member as a plain row', () => {
        expect(describeItems(build([algoUsdc, algo]))).toEqual([
            'row:31566704',
            'row:0',
        ])
    })

    it('never folds a test-network holding with a mainnet one', () => {
        const testnetUsdc = holding(ALGO_TESTNET, '31566704', '1')

        const items = build([testnetUsdc, ethUsdc])

        expect(describeItems(items)).toEqual(['row:31566704', 'row:0xA0b8'])
    })

    it('maps every holding to a plain row when none is in a group', () => {
        const ungrouped = [
            { ...algoUsdc, group: null },
            { ...ethUsdc, group: null },
        ]

        expect(build(ungrouped)).toEqual([
            { kind: 'holding', holding: ungrouped[0], isGroupMember: false },
            { kind: 'holding', holding: ungrouped[1], isGroupMember: false },
        ])
    })
})

describe('groupedHoldingItemKey', () => {
    it('gives every item of an expanded list a distinct key', () => {
        const items = build(
            [
                holding(ALGO_MAINNET, '31566704', '1'),
                holding(ETH_MAINNET, '0xA0b8', '1'),
                holding(ALGO_MAINNET, '0xA0b8', '1'),
            ],
            { expanded: ['usdc'] },
        )

        const keys = items.map(groupedHoldingItemKey)
        expect(new Set(keys).size).toBe(keys.length)
    })
})
