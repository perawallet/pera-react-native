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
import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { SwapTrackedOrder } from '../../models'
import { useSwapTrackingStore } from '../../store'
import { useSwapTrackedOrders } from '../useSwapTrackedOrders'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const order = (
    orderId: string,
    sourceAddress: string,
    createdAt: number,
): SwapTrackedOrder => ({
    orderId,
    sourceScope: SCOPE,
    destinationScope: { chainId: 'ethereum', networkId: 'mainnet' },
    sourceAddress,
    destinationAddress: '0xETH',
    assetIn: { ref: { ...SCOPE, assetId: '0' }, unitName: 'ALGO' },
    assetOut: {
        ref: { chainId: 'ethereum', networkId: 'mainnet', assetId: 'native' },
        unitName: 'ETH',
    },
    status: 'pending',
    createdAt,
    checkedAt: createdAt,
})

describe('swaps/useSwapTrackedOrders', () => {
    beforeEach(() => {
        useSwapTrackingStore.getState().resetState()
    })

    test("lists the orders the given addresses paid for, newest first", () => {
        const state = useSwapTrackingStore.getState()
        state.trackOrder(order('old', 'MINE', 1))
        state.trackOrder(order('other', 'THEIRS', 3))
        state.trackOrder(order('new', 'MINE', 2))

        const { result } = renderHook(() => useSwapTrackedOrders(['MINE']))

        expect(result.current.map(item => item.orderId)).toEqual([
            'new',
            'old',
        ])
    })

    test('lists nothing for no addresses', () => {
        useSwapTrackingStore.getState().trackOrder(order('a', 'MINE', 1))

        const { result } = renderHook(() => useSwapTrackedOrders([]))

        expect(result.current).toEqual([])
    })
})
