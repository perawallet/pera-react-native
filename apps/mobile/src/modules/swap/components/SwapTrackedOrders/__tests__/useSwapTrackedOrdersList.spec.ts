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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useSwapTrackedOrders,
    useSwapTrackingStore,
    type SwapStatus,
    type SwapTrackedOrder,
} from '@perawallet/wallet-core-swaps'
import { useIsCrossChainSwapEnabled } from '@hooks/useIsCrossChainSwapEnabled'
import { useSwapTrackedOrdersList } from '../useSwapTrackedOrdersList'

vi.mock('@hooks/useIsCrossChainSwapEnabled', () => ({
    useIsCrossChainSwapEnabled: vi.fn(() => true),
}))
vi.mock('../../../hooks/useSwapAccountAddresses', () => ({
    useSwapAccountAddresses: () => [
        {
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            address: 'ALGO_ADDR',
        },
    ],
}))

const order = (orderId: string, status: SwapStatus): SwapTrackedOrder => ({
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
    status,
    createdAt: Date.now(),
    checkedAt: Date.now(),
})

const mockRemoveOrder = vi.fn()

describe('useSwapTrackedOrdersList', () => {
    beforeEach(() => {
        vi.mocked(useIsCrossChainSwapEnabled).mockReturnValue(true)
        vi.mocked(useSwapTrackingStore).mockImplementation(
            (selector: unknown) =>
                (selector as (state: unknown) => unknown)({
                    removeOrder: mockRemoveOrder,
                }),
        )
    })

    it('tells the user what happened to their funds for each failed outcome', () => {
        vi.mocked(useSwapTrackedOrders).mockReturnValue([
            order('1', 'failed'),
            order('2', 'refunded'),
            order('3', 'expired'),
        ])

        const { result } = renderHook(() => useSwapTrackedOrdersList())

        const texts = result.current.rows.map(row => row.statusText)
        expect(new Set(texts).size).toBe(3)
        expect(result.current.rows[0]).toMatchObject({
            pairLabel: 'ALGO → ETH',
            isSettled: true,
        })
        expect(vi.mocked(useSwapTrackedOrders)).toHaveBeenCalledWith([
            'ALGO_ADDR',
        ])
    })

    it('marks an order in flight as unsettled', () => {
        vi.mocked(useSwapTrackedOrders).mockReturnValue([
            order('1', 'in_progress'),
        ])

        const { result } = renderHook(() => useSwapTrackedOrdersList())

        expect(result.current.isVisible).toBe(true)
        expect(result.current.rows[0].isSettled).toBe(false)
    })

    it('is hidden while the flag is off', () => {
        vi.mocked(useIsCrossChainSwapEnabled).mockReturnValue(false)
        vi.mocked(useSwapTrackedOrders).mockReturnValue([
            order('1', 'completed'),
        ])

        const { result } = renderHook(() => useSwapTrackedOrdersList())

        expect(result.current.isVisible).toBe(false)
    })

    it('forgets an order the user dismisses', () => {
        vi.mocked(useSwapTrackedOrders).mockReturnValue([
            order('1', 'completed'),
        ])
        const { result } = renderHook(() => useSwapTrackedOrdersList())

        act(() => result.current.handleDismiss('1'))

        expect(mockRemoveOrder).toHaveBeenCalledWith('1')
    })
})
