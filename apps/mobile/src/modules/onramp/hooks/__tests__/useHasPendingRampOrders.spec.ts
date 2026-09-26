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
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useSelectedAccountAddress } from '@perawallet/wallet-core-accounts'

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
    useDeviceID: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccountAddress: vi.fn(),
}))

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
        vi.mocked(useNetwork).mockReturnValue({ network: 'mainnet' } as never)
        vi.mocked(useDeviceID).mockReturnValue('device-123')
        vi.mocked(useSelectedAccountAddress).mockReturnValue({
            selectedAccountAddress: 'ADDR',
            setSelectedAccountAddress: vi.fn(),
        })
        vi.mocked(useRampHistoryInfiniteQuery).mockReturnValue(
            makeQueryResult([]),
        )
    })

    it('shares the unfiltered history query instead of a pending-filtered key', () => {
        renderHook(() => useHasPendingRampOrders())

        expect(useRampHistoryInfiniteQuery).toHaveBeenCalledWith({
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
