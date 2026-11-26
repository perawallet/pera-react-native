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
import {
    useOpenSwapOrders,
    type SwapTrackedOrder,
} from '@perawallet/wallet-core-swaps'
import { usePendingSwaps } from '../usePendingSwaps'

const ADDRESSES = [
    {
        scope: { chainId: 'algorand', networkId: 'mainnet' },
        address: 'ALGO_ADDR',
    },
]

vi.mock('../../../hooks/useSwapAccountAddresses', () => ({
    useSwapAccountAddresses: () => ADDRESSES,
}))

const order = (orderId: string): SwapTrackedOrder => ({
    orderId,
    sourceScope: { chainId: 'algorand', networkId: 'mainnet' },
    destinationScope: { chainId: 'ethereum', networkId: 'mainnet' },
    sourceAddress: 'ALGO_ADDR',
    destinationAddress: '0xETH',
    assetIn: {
        ref: { chainId: 'algorand', networkId: 'mainnet', assetId: '0' },
        unitName: 'ALGO',
    },
    assetOut: {
        ref: { chainId: 'ethereum', networkId: 'mainnet', assetId: '0' },
        unitName: 'ETH',
    },
    status: 'in_progress',
    createdAt: Date.now(),
    checkedAt: Date.now(),
})

const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const

describe('usePendingSwaps', () => {
    it('shows an order still on its way to the shown network as a swap of its pair across both networks', () => {
        vi.mocked(useOpenSwapOrders).mockReturnValue([order('a'), order('b')])

        const { result } = renderHook(() => usePendingSwaps(ETHEREUM))

        expect(result.current.rows).toEqual([
            {
                orderId: 'a',
                title: 'transactions.list_item.swap',
                subtitle: 'transactions.list_item.swap_assets',
                leadingAssets: [
                    {
                        chainId: 'algorand',
                        asset: { assetId: '0', unitName: 'ALGO' },
                    },
                    {
                        chainId: 'ethereum',
                        asset: { assetId: '0', unitName: 'ETH' },
                    },
                ],
                chainIds: ['algorand', 'ethereum'],
            },
            expect.objectContaining({ orderId: 'b' }),
        ])
        expect(vi.mocked(useOpenSwapOrders)).toHaveBeenCalledWith(
            ADDRESSES,
            ETHEREUM,
        )
    })

    it.each([
        ['every network', null],
        ['the paying network', ALGORAND],
    ])(
        'shows nothing under %s, where the swap lists its own row',
        (_, scope) => {
            vi.mocked(useOpenSwapOrders).mockReturnValue([order('a')])

            const { result } = renderHook(() => usePendingSwaps(scope))

            expect(result.current.rows).toEqual([])
        },
    )
})
