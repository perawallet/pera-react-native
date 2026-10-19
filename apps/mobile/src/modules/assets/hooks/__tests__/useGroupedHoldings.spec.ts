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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    useAssetGroupsQuery,
    type AssetGroup,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { GroupableHoldingAdapter } from '../../utils/groupedHoldings'
import { useGroupedHoldings } from '../useGroupedHoldings'

const mockGroups = vi.hoisted(() => ({ current: [] as unknown[] }))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useAssetGroupsQuery: vi.fn(() => ({
        groups: mockGroups.current,
        isPending: false,
    })),
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

const ALGO: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETH: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

type Holding = { scope: ChainScope; assetId: string; amount: Decimal }

const adapter: GroupableHoldingAdapter<Holding> = {
    assetOf: holding => ({ assetId: holding.assetId }) as PeraAsset,
    displayAmountOf: holding => holding.amount,
    usdPriceOf: () => new Decimal(1),
}

const USDC_GROUP: AssetGroup = {
    id: 'usdc',
    name: 'USD Coin',
    symbol: 'USDC',
    logoUrl: null,
    members: [
        { scope: ALGO, assetId: '31566704' },
        { scope: ETH, assetId: '0xA0b8' },
    ],
}

const holdings: Holding[] = [
    { scope: ALGO, assetId: '31566704', amount: new Decimal(2) },
    { scope: ETH, assetId: '0xA0b8', amount: new Decimal(3) },
]

const render = (isEnabled = true) =>
    renderHook(() =>
        useGroupedHoldings({
            holdings,
            adapter,
            expandedGroupIds: new Set(),
            isEnabled,
        }),
    )

describe('useGroupedHoldings', () => {
    beforeEach(() => {
        mockGroups.current = []
        vi.mocked(useAssetGroupsQuery).mockClear()
    })

    it('folds the members the endpoint groups into one item', () => {
        mockGroups.current = [USDC_GROUP]

        const { result } = render()

        expect(result.current.items).toHaveLength(1)
        const [group] = result.current.items
        expect(group?.kind === 'group' && group.amount?.toString()).toBe('5')
    })

    it('lists every holding as a plain row when the endpoint gives no groups', () => {
        const { result } = render()

        expect(result.current.items).toEqual(
            holdings.map(holding => ({
                kind: 'holding',
                holding,
                isGroupMember: false,
            })),
        )
    })

    it('sends no request and folds nothing while disabled', () => {
        mockGroups.current = [USDC_GROUP]

        const { result } = render(false)

        expect(vi.mocked(useAssetGroupsQuery).mock.lastCall?.[0]).toEqual({
            enabled: false,
        })
        expect(
            result.current.items.every(item => item.kind === 'holding'),
        ).toBe(true)
    })
})
