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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    useRampHistoryInfiniteQuery,
    type OnrampStatus,
    type RampHistoryItem,
} from '@perawallet/wallet-core-onramp'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'

import { useHasPendingRampOrders } from '../useHasPendingRampOrders'

let mockIsFocused = true

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<typeof import('@react-navigation/native')>()),
    useIsFocused: () => mockIsFocused,
}))

vi.mock('@perawallet/wallet-core-onramp', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-onramp')
    >()),
    useRampHistoryInfiniteQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeploymentDeviceID: vi.fn(),
}))

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: vi.fn(),
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const onrampAccountAt = (
    address: Nullable<string>,
): ReturnType<typeof useOnrampAccount> => ({
    account: null,
    scope: address === null ? null : SCOPE,
    address,
})

const makeItem = (id: string, status: OnrampStatus): RampHistoryItem =>
    ({ id, status }) as unknown as RampHistoryItem

const makeQueryResult = (items: RampHistoryItem[]) =>
    ({
        items,
        isLoading: false,
        isFetchingNextPage: false,
        isError: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        refetch: vi.fn(),
    }) as unknown as ReturnType<typeof useRampHistoryInfiniteQuery>

describe('useHasPendingRampOrders', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsFocused = true
        vi.mocked(useDeploymentDeviceID).mockReturnValue('device-123')
        vi.mocked(useOnrampAccount).mockReturnValue(onrampAccountAt('ADDR'))
        vi.mocked(useRampHistoryInfiniteQuery).mockReturnValue(
            makeQueryResult([]),
        )
    })

    it('shares the unfiltered history query instead of a pending-filtered key', () => {
        renderHook(() => useHasPendingRampOrders())

        expect(useRampHistoryInfiniteQuery).toHaveBeenCalledWith({
            scope: SCOPE,
            deviceId: 'device-123',
            accountAddress: 'ADDR',
            isActive: true,
        })
    })

    it('returns true only when a loaded order is pending', () => {
        vi.mocked(useRampHistoryInfiniteQuery).mockReturnValue(
            makeQueryResult([
                makeItem('a', 'completed'),
                makeItem('b', 'pending'),
            ]),
        )
        const { result } = renderHook(() => useHasPendingRampOrders())
        expect(result.current).toBe(true)
    })

    it('returns false when no loaded order is pending', () => {
        vi.mocked(useRampHistoryInfiniteQuery).mockReturnValue(
            makeQueryResult([makeItem('a', 'completed')]),
        )
        const { result } = renderHook(() => useHasPendingRampOrders())
        expect(result.current).toBe(false)
    })

    it('stops polling while the screen is unfocused', () => {
        mockIsFocused = false

        renderHook(() => useHasPendingRampOrders())

        expect(useRampHistoryInfiniteQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isActive: false }),
        )
    })
})
