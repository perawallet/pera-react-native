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
import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { AssetGroup, PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { GroupableHoldingAdapter } from '../../utils/groupedHoldings'
import { useGroupedHoldings } from '../useGroupedHoldings'

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

const USDC_GROUP: AssetGroup = { id: 'usdc', name: 'USD Coin', symbol: 'USDC' }

type Holding = { scope: ChainScope; assetId: string; amount: Decimal }

const groupOf = vi.fn(() => USDC_GROUP)

const adapter: GroupableHoldingAdapter<Holding> = {
    assetOf: holding => ({ assetId: holding.assetId }) as PeraAsset,
    displayAmountOf: holding => holding.amount,
    usdPriceOf: () => new Decimal(1),
    groupOf,
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
    it('folds the members of one group into one item', () => {
        const { result } = render()

        expect(result.current.items).toHaveLength(1)
        const [group] = result.current.items
        expect(group?.kind === 'group' && group.amount?.toString()).toBe('5')
    })

    it('asks no holding for its group and folds nothing while disabled', () => {
        groupOf.mockClear()

        const { result } = render(false)

        expect(groupOf).not.toHaveBeenCalled()
        expect(result.current.items).toEqual(
            holdings.map(holding => ({
                kind: 'holding',
                holding,
                isGroupMember: false,
            })),
        )
    })
})
