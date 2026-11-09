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
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import React from 'react'
import {
    fetchAndPersistAccount,
    invalidateAccountQueriesForAddresses,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { fetchSwapOrder } from '../../api'
import { makeSwapHistoryItem } from '../../__tests__/swapHistoryFixture'
import type { SwapStatus, SwapTrackedOrder } from '../../models'
import { useSwapTrackingStore } from '../../store'
import {
    SWAP_ORDER_TRACKING_LIMIT_MS,
    SWAP_STATUS_REVERSIBLE_MS,
} from '../../utils/swapOrderSettlement'
import { useSwapOrderTracker } from '../useSwapOrderTracker'

vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<typeof import('../../api')>()),
    fetchSwapOrder: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    invalidateAccountQueriesForAddresses: vi.fn(),
    fetchAndPersistAccount: vi.fn(),
}))

const NOW = 1_700_000_000_000
const POLL_MS = 30_000
const SOURCE_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const DESTINATION_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const PAYING_ACCOUNT = {
    id: 'paying',
    chains: { algorand: { address: 'ALGO_ADDR' } },
} as unknown as WalletAccount

const trackedOrder = (
    overrides: Partial<SwapTrackedOrder> = {},
): SwapTrackedOrder => ({
    orderId: 'order-1',
    sourceScope: SOURCE_SCOPE,
    destinationScope: DESTINATION_SCOPE,
    sourceAddress: 'ALGO_ADDR',
    destinationAddress: '0xETH',
    assetIn: { ref: { ...SOURCE_SCOPE, assetId: '0' }, unitName: 'ALGO' },
    assetOut: {
        ref: { ...DESTINATION_SCOPE, assetId: 'native' },
        unitName: 'ETH',
    },
    status: 'in_progress',
    createdAt: NOW,
    checkedAt: NOW,
    ...overrides,
})

const routerSays = (...statuses: SwapStatus[]) => {
    for (const status of statuses) {
        vi.mocked(fetchSwapOrder).mockResolvedValueOnce(
            makeSwapHistoryItem({ status }),
        )
    }
}

const render = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
    return renderHook(() => useSwapOrderTracker(), { wrapper })
}

// TanStack hands results over through chained short timeouts, so each step
// runs the clock a little past the point it waits for.
const SETTLE_MS = 50
const flush = () => act(() => vi.advanceTimersByTimeAsync(SETTLE_MS))
const nextPoll = () => act(() => vi.advanceTimersByTimeAsync(POLL_MS))

const statusOf = (orderId = 'order-1') =>
    useSwapTrackingStore.getState().orders[orderId]?.status

describe('swaps/useSwapOrderTracker', () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: NOW })
        vi.mocked(fetchSwapOrder).mockReset()
        vi.mocked(invalidateAccountQueriesForAddresses).mockReset()
        vi.mocked(fetchAndPersistAccount).mockReset().mockResolvedValue({
            changed: true,
            holdingsChanged: true,
            observedRound: 1,
        })
        useSwapTrackingStore.getState().resetState()
        useAccountsStore.setState({ accounts: [PAYING_ACCOUNT] })
        onlineManager.setOnline(true)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    test('carries an order restored after a relaunch through to completed and refreshes the receiving account', async () => {
        useSwapTrackingStore.getState().trackOrder(trackedOrder())
        routerSays('in_progress', 'completed')

        render()
        await flush()
        expect(statusOf()).toBe('in_progress')

        await nextPoll()

        expect(statusOf()).toBe('completed')
        expect(fetchSwapOrder).toHaveBeenCalledWith('order-1', SOURCE_SCOPE)
        expect(fetchAndPersistAccount).toHaveBeenCalledWith(
            '0xETH',
            DESTINATION_SCOPE,
        )
        expect(invalidateAccountQueriesForAddresses).toHaveBeenCalledTimes(1)
        expect(invalidateAccountQueriesForAddresses).toHaveBeenCalledWith(
            expect.anything(),
            ['0xETH'],
            { includeMultiAccountKeys: true },
        )
    })

    test('refreshes the paying account when the order is refunded', async () => {
        useSwapTrackingStore.getState().trackOrder(trackedOrder())
        routerSays('refunded')

        render()
        await flush()

        expect(statusOf()).toBe('refunded')
        expect(fetchAndPersistAccount).toHaveBeenCalledWith(
            'ALGO_ADDR',
            SOURCE_SCOPE,
        )
        expect(invalidateAccountQueriesForAddresses).toHaveBeenCalledWith(
            expect.anything(),
            ['ALGO_ADDR'],
            { includeMultiAccountKeys: true },
        )
    })

    test('still refreshes the receiving account when reading it from the chain fails', async () => {
        vi.mocked(fetchAndPersistAccount).mockRejectedValue(
            new Error('node down'),
        )
        useSwapTrackingStore.getState().trackOrder(trackedOrder())
        routerSays('completed')

        render()
        await flush()

        expect(invalidateAccountQueriesForAddresses).toHaveBeenCalledWith(
            expect.anything(),
            ['0xETH'],
            { includeMultiAccountKeys: true },
        )
    })

    test('stops reading an order once it is settled', async () => {
        useSwapTrackingStore
            .getState()
            .trackOrder(trackedOrder({ status: 'completed' }))

        render()
        await flush()
        await nextPoll()

        expect(fetchSwapOrder).not.toHaveBeenCalled()
    })

    test('keeps polling an expired order the provider can still overturn', async () => {
        useSwapTrackingStore.getState().trackOrder(trackedOrder())
        routerSays('expired', 'expired')

        render()
        await flush()
        await nextPoll()

        expect(statusOf()).toBe('expired')
        expect(fetchSwapOrder).toHaveBeenCalledTimes(2)
    })

    test('skips an order whose paying account left the wallet, and keeps it for a re-import', async () => {
        useAccountsStore.setState({ accounts: [] })
        useSwapTrackingStore.getState().trackOrder(trackedOrder())

        render()
        await flush()
        await nextPoll()

        expect(fetchSwapOrder).not.toHaveBeenCalled()
        expect(statusOf()).toBe('in_progress')
    })

    test('drops an unfinished order past the tracking limit on mount', async () => {
        useSwapTrackingStore.getState().trackOrder(
            trackedOrder({
                createdAt: NOW - SWAP_ORDER_TRACKING_LIMIT_MS,
            }),
        )

        render()
        await flush()
        await nextPoll()

        expect(fetchSwapOrder).not.toHaveBeenCalled()
        expect(useSwapTrackingStore.getState().orders).toEqual({})
    })

    test('drops a settled order past the reversible window on mount', async () => {
        useSwapTrackingStore.getState().trackOrder(
            trackedOrder({
                status: 'failed',
                createdAt: NOW - SWAP_STATUS_REVERSIBLE_MS,
            }),
        )

        render()
        await flush()

        expect(useSwapTrackingStore.getState().orders).toEqual({})
    })

    test('waits while offline and resumes on reconnect', async () => {
        onlineManager.setOnline(false)
        useSwapTrackingStore.getState().trackOrder(trackedOrder())
        routerSays('completed')

        render()
        await flush()
        expect(fetchSwapOrder).not.toHaveBeenCalled()

        await act(async () => {
            onlineManager.setOnline(true)
            await vi.advanceTimersByTimeAsync(0)
        })

        expect(statusOf()).toBe('completed')
    })

    test('keeps tracking and polling an order the router does not know', async () => {
        useSwapTrackingStore.getState().trackOrder(trackedOrder())
        vi.mocked(fetchSwapOrder).mockRejectedValueOnce(new Error('not found'))
        routerSays('completed')

        render()
        await flush()
        expect(statusOf()).toBe('in_progress')

        await nextPoll()

        expect(statusOf()).toBe('completed')
    })

    test('reads the order on the scope it was placed on, whatever network is selected now', async () => {
        const testnet = { chainId: 'algorand', networkId: 'testnet' } as const
        useSwapTrackingStore
            .getState()
            .trackOrder(trackedOrder({ sourceScope: testnet }))
        routerSays('in_progress')

        render()
        await flush()

        expect(fetchSwapOrder).toHaveBeenCalledWith('order-1', testnet)
    })
})
