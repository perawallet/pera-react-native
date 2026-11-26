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
import { useSwapTrackedOrdersList } from '../useSwapTrackedOrdersList'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: unknown) =>
            `${key}|${JSON.stringify(params ?? {})}`,
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    chainDisplayNameOf: (chainId: string) =>
        ({
            base: 'Base',
            arbitrum: 'Arbitrum One',
            algorand: 'Algorand',
            ethereum: 'Ethereum',
        })[chainId],
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
            pairLabel: 'ALGO (Algorand) → ETH (Ethereum)',
            isSettled: true,
        })
        expect(vi.mocked(useSwapTrackedOrders)).toHaveBeenCalledWith([
            'ALGO_ADDR',
        ])
    })

    it('names both networks when a swap crosses chains between same-symbol tokens', () => {
        const base = { chainId: 'base', networkId: 'mainnet' } as const
        const arbitrum = { chainId: 'arbitrum', networkId: 'mainnet' } as const
        vi.mocked(useSwapTrackedOrders).mockReturnValue([
            {
                ...order('1', 'completed'),
                sourceScope: base,
                destinationScope: arbitrum,
                assetIn: {
                    ref: { ...base, assetId: 'native' },
                    unitName: 'ETH',
                    logo: 'https://in',
                },
                assetOut: {
                    ref: { ...arbitrum, assetId: 'native' },
                    unitName: 'ETH',
                    logo: 'https://out',
                },
            },
        ])

        const { result } = renderHook(() => useSwapTrackedOrdersList())

        const [row] = result.current.rows
        expect(row.pairLabel).toBe('ETH (Base) → ETH (Arbitrum One)')
        expect(row.statusText).toContain('"network":"Arbitrum One"')
        expect(row.assetIn).toMatchObject({
            ref: { chainId: 'base' },
            logo: 'https://in',
        })
        expect(row.assetOut).toMatchObject({
            ref: { chainId: 'arbitrum' },
            logo: 'https://out',
        })
    })

    it('keeps the compact label for a same-chain order and still names its network in the completion text', () => {
        const base = { chainId: 'base', networkId: 'mainnet' } as const
        vi.mocked(useSwapTrackedOrders).mockReturnValue([
            {
                ...order('1', 'completed'),
                sourceScope: base,
                destinationScope: base,
                assetIn: {
                    ref: { ...base, assetId: '0xUSDC' },
                    unitName: 'USDC',
                },
                assetOut: {
                    ref: { ...base, assetId: 'native' },
                    unitName: 'ETH',
                },
            },
        ])

        const { result } = renderHook(() => useSwapTrackedOrdersList())

        expect(result.current.rows[0].pairLabel).toBe('USDC → ETH')
        expect(result.current.rows[0].statusText).toContain('"network":"Base"')
    })

    it('marks an order in flight as unsettled', () => {
        vi.mocked(useSwapTrackedOrders).mockReturnValue([
            order('1', 'in_progress'),
        ])

        const { result } = renderHook(() => useSwapTrackedOrdersList())

        expect(result.current.isVisible).toBe(true)
        expect(result.current.rows[0].isSettled).toBe(false)
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
