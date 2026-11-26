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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type {
    SwapStatus,
    SwapTrackedOrder,
} from '@perawallet/wallet-core-swaps'
import { useSwapSettledToasts } from '../useSwapSettledToasts'

type Orders = Record<string, SwapTrackedOrder>
type Listener = (state: { orders: Orders }, prev: { orders: Orders }) => void

const mocks = vi.hoisted(() => ({
    showToast: vi.fn(),
    listeners: [] as Listener[],
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapTrackingStore: {
        subscribe: (listener: Listener) => {
            mocks.listeners.push(listener)
            return () => {
                mocks.listeners.splice(mocks.listeners.indexOf(listener), 1)
            }
        },
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ ethereum: 'Ethereum', base: 'Base' })[chainId],
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

const order = (status: SwapStatus): SwapTrackedOrder => ({
    orderId: 'o1',
    sourceScope: { chainId: 'ethereum', networkId: 'mainnet' },
    destinationScope: { chainId: 'base', networkId: 'mainnet' },
    sourceAddress: '0xa',
    destinationAddress: '0xa',
    assetIn: {
        ref: { chainId: 'ethereum', networkId: 'mainnet', assetId: 'native' },
        unitName: 'ETH',
    },
    assetOut: {
        ref: { chainId: 'base', networkId: 'mainnet', assetId: 'native' },
        unitName: 'ETH',
    },
    status,
    createdAt: 1,
    checkedAt: 1,
})

const emit = (before: Orders, after: Orders) =>
    mocks.listeners.forEach(listener =>
        listener({ orders: after }, { orders: before }),
    )

describe('useSwapSettledToasts', () => {
    beforeEach(() => {
        mocks.showToast.mockClear()
        mocks.listeners.length = 0
    })

    it('toasts a swap that settles, naming both chains', () => {
        renderHook(() => useSwapSettledToasts())

        emit({ o1: order('in_progress') }, { o1: order('completed') })

        expect(mocks.showToast).toHaveBeenCalledWith({
            type: 'success',
            title: 'ETH (Ethereum) → ETH (Base)',
            body: 'swap.tracking.completed',
        })
    })

    it('stays quiet for orders restored at launch and for an open status', () => {
        renderHook(() => useSwapSettledToasts())

        emit({}, { o1: order('completed') })
        emit({ o1: order('pending') }, { o1: order('in_progress') })

        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('stops listening on unmount', () => {
        const { unmount } = renderHook(() => useSwapSettledToasts())
        unmount()

        expect(mocks.listeners).toHaveLength(0)
    })
})
