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
import { describe, test, expect, beforeEach, vi } from 'vitest'

const registeredStores = vi.hoisted(
    () =>
        [] as Parameters<
            typeof import('@perawallet/wallet-core-shared').registerStore
        >[0][],
)

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: (entry: (typeof registeredStores)[number]) => {
            registeredStores.push(entry)
        },
    }
})

import { readQuarantinedStates } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useSwapTrackingStore } from '../swapTrackingStore'
import type { SwapTrackedOrder } from '../../models'
import { SWAP_STATUS_REVERSIBLE_MS } from '../../utils/swapOrderSettlement'

const STORE_KEY = 'swap-tracking-store'
const CREATED_AT = 1_700_000_000_000

const makeOrder = (
    overrides: Partial<SwapTrackedOrder> = {},
): SwapTrackedOrder => ({
    orderId: 'order-1',
    sourceScope: { chainId: 'algorand', networkId: 'mainnet' },
    destinationScope: { chainId: 'ethereum', networkId: 'mainnet' },
    sourceAddress: 'ALGO_ADDR',
    destinationAddress: '0xETH',
    assetIn: {
        ref: { chainId: 'algorand', networkId: 'mainnet', assetId: '0' },
        unitName: 'ALGO',
    },
    assetOut: {
        ref: { chainId: 'ethereum', networkId: 'mainnet', assetId: 'native' },
        unitName: 'ETH',
    },
    status: 'pending',
    createdAt: CREATED_AT,
    checkedAt: CREATED_AT,
    ...overrides,
})

const orders = () => useSwapTrackingStore.getState().orders

describe('swaps/swapTrackingStore', () => {
    beforeEach(() => {
        useSwapTrackingStore.getState().resetState()
    })

    test('tracks an order under its id', () => {
        useSwapTrackingStore.getState().trackOrder(makeOrder())

        expect(orders()).toEqual({ 'order-1': makeOrder() })
    })

    test('records a new status and when it was read', () => {
        useSwapTrackingStore.getState().trackOrder(makeOrder())

        useSwapTrackingStore
            .getState()
            .updateOrderStatus('order-1', 'in_progress', CREATED_AT + 30_000)

        expect(orders()['order-1']).toMatchObject({
            status: 'in_progress',
            checkedAt: CREATED_AT + 30_000,
        })
    })

    test('ignores a status for an order it does not track', () => {
        useSwapTrackingStore
            .getState()
            .updateOrderStatus('missing', 'completed', CREATED_AT)

        expect(orders()).toEqual({})
    })

    test('removes only the named order', () => {
        const state = useSwapTrackingStore.getState()
        state.trackOrder(makeOrder({ orderId: 'a' }))
        state.trackOrder(makeOrder({ orderId: 'b' }))

        state.removeOrder('a')

        expect(Object.keys(orders())).toEqual(['b'])
    })

    test('prunes settled orders older than the reversible window and keeps the rest', () => {
        const now = CREATED_AT + SWAP_STATUS_REVERSIBLE_MS
        const state = useSwapTrackingStore.getState()
        state.trackOrder(makeOrder({ orderId: 'old-done', status: 'completed' }))
        state.trackOrder(
            makeOrder({ orderId: 'old-open', status: 'in_progress' }),
        )
        state.trackOrder(
            makeOrder({
                orderId: 'new-done',
                status: 'failed',
                createdAt: now - 1,
            }),
        )

        state.pruneSettledOrders(now)

        expect(Object.keys(orders()).sort()).toEqual(['new-done', 'old-open'])
    })

    test('restores an in-flight order from storage after a restart', async () => {
        const order = makeOrder({ status: 'in_progress' })
        getProvider().keyValueStorage.setItem(
            STORE_KEY,
            JSON.stringify({
                state: { orders: { [order.orderId]: order } },
                version: 1,
            }),
        )

        await useSwapTrackingStore.persist.rehydrate()

        expect(orders()).toEqual({ [order.orderId]: order })
    })

    test('quarantines a blob it cannot read instead of throwing', async () => {
        getProvider().keyValueStorage.setItem(STORE_KEY, '{not json')

        await expect(
            useSwapTrackingStore.persist.rehydrate(),
        ).resolves.not.toThrow()

        expect(orders()).toEqual({})
        expect(
            readQuarantinedStates(getProvider().keyValueStorage, STORE_KEY),
        ).toEqual([
            expect.objectContaining({ reason: 'unreadable', raw: '{not json' }),
        ])
    })

    test('registers with the store registry', () => {
        const registration = registeredStores.find(r => r.name === STORE_KEY)
        useSwapTrackingStore.getState().trackOrder(makeOrder())

        registration!.resetState()

        expect(orders()).toEqual({})
        expect(() => registration!.clearStorage()).not.toThrow()
    })
})
