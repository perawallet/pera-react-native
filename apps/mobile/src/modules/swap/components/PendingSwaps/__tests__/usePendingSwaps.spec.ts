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

describe('usePendingSwaps', () => {
    it('shows each open order as an in-progress pair, in the order given', () => {
        vi.mocked(useOpenSwapOrders).mockReturnValue([order('a'), order('b')])

        const { result } = renderHook(() => usePendingSwaps(null))

        expect(result.current.rows).toEqual([
            {
                orderId: 'a',
                pairLabel: 'ALGO → ETH',
                statusText: 'swap.tracking.in_progress',
            },
            expect.objectContaining({ orderId: 'b' }),
        ])
    })

    it('narrows the orders to the shown network', () => {
        const scope = { chainId: 'ethereum', networkId: 'mainnet' } as const

        renderHook(() => usePendingSwaps(scope))

        expect(vi.mocked(useOpenSwapOrders)).toHaveBeenCalledWith(
            ADDRESSES,
            scope,
        )
    })
})
