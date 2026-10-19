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
    findGroupedMembers,
    groupedHoldingItemKey,
    spansChains,
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
}

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
})

const USDC_GROUP: AssetGroup = {
    id: 'usdc',
    name: 'USD Coin',
    symbol: 'USDC',
    logoUrl: null,
    members: [
        { scope: ALGO_MAINNET, assetId: '31566704' },
        { scope: ETH_MAINNET, assetId: '0xA0b8' },
    ],
}

const build = (
    holdings: TestHolding[],
    {
        groups = [USDC_GROUP],
        expanded = [],
    }: { groups?: AssetGroup[]; expanded?: string[] } = {},
) =>
    buildGroupedHoldingItems({
        holdings,
        groups,
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

    it('keeps two same-symbol assets no group names as separate rows', () => {
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
        const groupWithTestnet: AssetGroup = {
            ...USDC_GROUP,
            members: [
                ...USDC_GROUP.members,
                { scope: ALGO_TESTNET, assetId: '31566704' },
            ],
        }

        const items = build([testnetUsdc, ethUsdc], {
            groups: [groupWithTestnet],
        })

        expect(describeItems(items)).toEqual(['row:31566704', 'row:0xA0b8'])
    })

    it('maps every holding to a plain row with no groups', () => {
        const items = build([algoUsdc, ethUsdc], { groups: [] })

        expect(items).toEqual([
            { kind: 'holding', holding: algoUsdc, isGroupMember: false },
            { kind: 'holding', holding: ethUsdc, isGroupMember: false },
        ])
    })

    it('picks the member worth the most in USD, even when it sorts second', () => {
        const smallAlgo = holding(ALGO_MAINNET, '31566704', '1000000')
        const bigEth = holding(ETH_MAINNET, '0xA0b8', '3000000000000000000', 18)

        expect(groupAt(build([smallAlgo, bigEth]), 0).largestMember).toBe(
            bigEth,
        )
    })

    it('ranks a member with no USD price below a priced one', () => {
        const unpricedBig = holding(
            ALGO_MAINNET,
            '31566704',
            '9000000',
            6,
            null,
        )
        const pricedSmall = holding(
            ETH_MAINNET,
            '0xA0b8',
            '1000000000000000000',
            18,
        )

        expect(
            groupAt(build([unpricedBig, pricedSmall]), 0).largestMember,
        ).toBe(pricedSmall)
    })

    it('keeps list order between members of equal value', () => {
        const first = holding(ALGO_MAINNET, '31566704', '1000000')
        const second = holding(ETH_MAINNET, '0xA0b8', '1000000000000000000', 18)

        expect(groupAt(build([first, second]), 0).largestMember).toBe(first)
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

describe('spansChains', () => {
    it('is true only for holdings on two or more chains', () => {
        expect(spansChains([])).toBe(false)
        expect(
            spansChains([
                holding(ALGO_MAINNET, '0', '1'),
                holding(ALGO_MAINNET, '31566704', '1'),
            ]),
        ).toBe(false)
        expect(
            spansChains([
                holding(ALGO_MAINNET, '0', '1'),
                holding(ETH_MAINNET, '0xA0b8', '1'),
            ]),
        ).toBe(true)
    })
})

describe('findGroupedMembers', () => {
    const algoUsdc = holding(ALGO_MAINNET, '31566704', '1')
    const ethUsdc = holding(ETH_MAINNET, '0xA0b8', '1')

    it("lists the held members of the asset's group", () => {
        expect(
            findGroupedMembers({
                holdings: [ethUsdc, holding(ALGO_MAINNET, '0', '1'), algoUsdc],
                groups: [USDC_GROUP],
                ref: { chainId: 'algorand', assetId: '31566704' },
            }),
        ).toEqual([ethUsdc, algoUsdc])
    })

    it('is empty when only one member is held', () => {
        expect(
            findGroupedMembers({
                holdings: [algoUsdc],
                groups: [USDC_GROUP],
                ref: { chainId: 'algorand', assetId: '31566704' },
            }),
        ).toEqual([])
    })

    it('is empty for an asset no group names', () => {
        expect(
            findGroupedMembers({
                holdings: [algoUsdc, ethUsdc],
                groups: [USDC_GROUP],
                ref: { chainId: 'algorand', assetId: '0' },
            }),
        ).toEqual([])
    })

    it('leaves out a held member on a test network', () => {
        const testnetUsdc = holding(ALGO_TESTNET, '31566704', '1')
        const groupWithTestnet: AssetGroup = {
            ...USDC_GROUP,
            members: [
                { scope: ALGO_TESTNET, assetId: '31566704' },
                USDC_GROUP.members[1]!,
            ],
        }

        expect(
            findGroupedMembers({
                holdings: [testnetUsdc, ethUsdc],
                groups: [groupWithTestnet],
                ref: { chainId: 'ethereum', assetId: '0xA0b8' },
            }),
        ).toEqual([])
    })
})
