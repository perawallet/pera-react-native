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
import { beforeEach, describe, expect, test } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { SwapAccountAddress, SwapTrackedOrder } from '../../models'
import { useSwapTrackingStore } from '../../store'
import { useOpenSwapOrders } from '../useOpenSwapOrders'

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ACCOUNT: SwapAccountAddress[] = [
    { scope: ALGO, address: 'MINE' },
    { scope: ETH, address: '0xmine' },
]

const SIGNER = {
    id: 'signer',
    chains: {
        algorand: { address: 'MINE' },
        ethereum: { address: '0xmine' },
    },
} as unknown as WalletAccount
const SIBLING = {
    id: 'sibling',
    chains: { algorand: { address: 'SIBLING' } },
} as unknown as WalletAccount

const order = (
    overrides: Partial<SwapTrackedOrder> & { orderId: string },
): SwapTrackedOrder => ({
    sourceScope: ALGO,
    destinationScope: ETH,
    sourceAddress: 'MINE',
    destinationAddress: '0xother',
    assetIn: { ref: { ...ALGO, assetId: '0' }, unitName: 'ALGO' },
    assetOut: { ref: { ...ETH, assetId: 'native' }, unitName: 'ETH' },
    status: 'in_progress',
    createdAt: Date.now(),
    checkedAt: Date.now(),
    ...overrides,
})

const track = (...orders: SwapTrackedOrder[]) =>
    orders.forEach(o => useSwapTrackingStore.getState().trackOrder(o))

describe('swaps/useOpenSwapOrders', () => {
    beforeEach(() => {
        useSwapTrackingStore.getState().resetState()
        useAccountsStore.setState({ accounts: [SIGNER, SIBLING] })
    })

    test('lists the account’s orders still in flight, newest first', () => {
        track(
            order({
                orderId: 'old',
                status: 'pending',
                createdAt: Date.now() - 60_000,
            }),
            order({ orderId: 'new' }),
            order({ orderId: 'done', status: 'completed' }),
            order({ orderId: 'expired', status: 'expired' }),
            order({ orderId: 'cancelled', status: 'cancelled' }),
        )

        const { result } = renderHook(() => useOpenSwapOrders(ACCOUNT, null))

        expect(result.current.map(o => o.orderId)).toEqual(['new', 'old'])
    })

    test('lists an order the account receives from another account in the wallet', () => {
        track(
            order({
                orderId: 'incoming',
                sourceAddress: 'SIBLING',
                destinationAddress: '0xmine',
            }),
        )

        const { result } = renderHook(() => useOpenSwapOrders(ACCOUNT, null))

        expect(result.current.map(o => o.orderId)).toEqual(['incoming'])
    })

    test('leaves out other accounts’ orders and other networks', () => {
        track(
            order({
                orderId: 'theirs',
                sourceAddress: 'SOMEONE_ELSE',
                destinationAddress: '0xsomeone',
            }),
            order({
                orderId: 'testnet',
                sourceScope: { chainId: 'algorand', networkId: 'testnet' },
            }),
        )

        const { result } = renderHook(() => useOpenSwapOrders(ACCOUNT, null))

        expect(result.current).toEqual([])
    })

    test('leaves out an order whose paying account left the wallet', () => {
        track(
            order({
                orderId: 'orphaned',
                sourceAddress: 'SIBLING',
                destinationAddress: '0xmine',
            }),
        )
        useAccountsStore.setState({ accounts: [SIGNER] })

        const { result } = renderHook(() => useOpenSwapOrders(ACCOUNT, null))

        expect(result.current).toEqual([])
    })

    test('keeps an order with either side on the shown network', () => {
        track(order({ orderId: 'algo-to-eth' }))

        const onEth = renderHook(() => useOpenSwapOrders(ACCOUNT, ETH))
        const onBase = renderHook(() =>
            useOpenSwapOrders(ACCOUNT, {
                chainId: 'base',
                networkId: 'mainnet',
            }),
        )

        expect(onEth.result.current).toHaveLength(1)
        expect(onBase.result.current).toEqual([])
    })
})
