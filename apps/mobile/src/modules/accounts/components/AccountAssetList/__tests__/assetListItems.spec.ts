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
import type { AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import type { AssetGroup } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    assetListItemKey,
    buildAssetListItems,
    type AssetListItem,
} from '../assetListItems'

// The row's own decimals stand in for the materialized asset.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    assetFromHoldingLiteRow: (row: { decimals: number | null }) =>
        row.decimals === null ? null : { decimals: row.decimals },
}))

const ALGO_MAINNET: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ALGO_TESTNET: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const ETH_MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const row = (
    scope: ChainScope,
    assetId: string,
    amount: string,
    decimals: number | null = 6,
): AccountHoldingsLiteRow => ({
    scope,
    assetId,
    amount: new Decimal(amount),
    decimals,
    totalSupply: decimals === null ? null : '1000000000000',
    chainData: null,
    name: 'USD Coin',
    unitName: 'USDC',
    url: null,
    metadata: null,
    peraMetadataJson: null,
    isFavorited: false,
    usdPrice: new Decimal(1),
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

const isMainnet = (scope: ChainScope) => scope.networkId === 'mainnet'

const describeItems = (items: AssetListItem[]) =>
    items.map(item =>
        item.kind === 'group'
            ? `group:${item.group.id}`
            : `${item.isGroupMember ? 'member' : 'row'}:${item.row.assetId}`,
    )

describe('buildAssetListItems', () => {
    const algoUsdc = row(ALGO_MAINNET, '31566704', '2500000')
    const ethUsdc = row(ETH_MAINNET, '0xA0b8', '1500000000000000000', 18)
    const algo = row(ALGO_MAINNET, '0', '1000000')

    it("folds a group's members into one item at the first member's position", () => {
        const items = buildAssetListItems({
            rows: [algo, algoUsdc, ethUsdc],
            groups: [USDC_GROUP],
            expandedGroupIds: new Set(),
            isGroupable: isMainnet,
        })

        expect(describeItems(items)).toEqual(['row:0', 'group:usdc'])
        const group = items[1]
        expect(group?.kind === 'group' && group.members).toEqual([
            algoUsdc,
            ethUsdc,
        ])
    })

    it('sums members in display units across different decimals', () => {
        const [group] = buildAssetListItems({
            rows: [algoUsdc, ethUsdc],
            groups: [USDC_GROUP],
            expandedGroupIds: new Set(),
            isGroupable: isMainnet,
        })

        expect(group?.kind === 'group' && group.amount?.toString()).toBe('4')
    })

    it("leaves the sum unknown while a member's metadata hasn't synced", () => {
        const unsynced = row(ETH_MAINNET, '0xA0b8', '1', null)

        const [group] = buildAssetListItems({
            rows: [algoUsdc, unsynced],
            groups: [USDC_GROUP],
            expandedGroupIds: new Set(),
            isGroupable: isMainnet,
        })

        expect(group?.kind === 'group' && group.amount).toBeNull()
    })

    it('follows an expanded group with its members', () => {
        const items = buildAssetListItems({
            rows: [algoUsdc, algo, ethUsdc],
            groups: [USDC_GROUP],
            expandedGroupIds: new Set(['usdc']),
            isGroupable: isMainnet,
        })

        expect(describeItems(items)).toEqual([
            'group:usdc',
            'member:31566704',
            'member:0xA0b8',
            'row:0',
        ])
    })

    it('keeps two same-symbol assets no group names as separate rows', () => {
        const lookalike = row(ETH_MAINNET, '0xFAKE', '1000000')

        const items = buildAssetListItems({
            rows: [algoUsdc, lookalike],
            groups: [USDC_GROUP],
            expandedGroupIds: new Set(),
            isGroupable: isMainnet,
        })

        expect(describeItems(items)).toEqual(['row:31566704', 'row:0xFAKE'])
    })

    it('keeps a lone present member as a plain row', () => {
        const items = buildAssetListItems({
            rows: [algoUsdc, algo],
            groups: [USDC_GROUP],
            expandedGroupIds: new Set(),
            isGroupable: isMainnet,
        })

        expect(describeItems(items)).toEqual(['row:31566704', 'row:0'])
    })

    it('never folds a row the predicate rejects', () => {
        const testnetUsdc = row(ALGO_TESTNET, '31566704', '1')
        const groupWithTestnet: AssetGroup = {
            ...USDC_GROUP,
            members: [
                ...USDC_GROUP.members,
                { scope: ALGO_TESTNET, assetId: '31566704' },
            ],
        }

        const items = buildAssetListItems({
            rows: [testnetUsdc, ethUsdc],
            groups: [groupWithTestnet],
            expandedGroupIds: new Set(),
            isGroupable: isMainnet,
        })

        expect(describeItems(items)).toEqual(['row:31566704', 'row:0xA0b8'])
    })

    it('leaves rows as they are with no groups', () => {
        const items = buildAssetListItems({
            rows: [algoUsdc, ethUsdc],
            groups: [],
            expandedGroupIds: new Set(),
            isGroupable: isMainnet,
        })

        expect(describeItems(items)).toEqual(['row:31566704', 'row:0xA0b8'])
    })
})

describe('assetListItemKey', () => {
    it('gives every item of an expanded list a distinct key', () => {
        const items = buildAssetListItems({
            rows: [
                row(ALGO_MAINNET, '31566704', '1'),
                row(ETH_MAINNET, '0xA0b8', '1'),
                row(ALGO_MAINNET, '0xA0b8', '1'),
            ],
            groups: [USDC_GROUP],
            expandedGroupIds: new Set(['usdc']),
            isGroupable: isMainnet,
        })

        const keys = items.map(assetListItemKey)
        expect(new Set(keys).size).toBe(keys.length)
    })
})
