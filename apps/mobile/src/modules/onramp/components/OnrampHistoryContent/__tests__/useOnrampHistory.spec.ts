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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    useRampHistoryInfiniteQuery,
    type RampHistoryItem,
} from '@perawallet/wallet-core-onramp'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'

import { useOnrampHistory } from '../useOnrampHistory'

vi.mock('@perawallet/wallet-core-onramp', () => ({
    useRampHistoryInfiniteQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeploymentDeviceID: vi.fn(),
}))

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: vi.fn(),
}))

const mockRequestBottomSheet = vi.hoisted(() => vi.fn())

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const onrampAccountAt = (
    address: Nullable<string>,
): ReturnType<typeof useOnrampAccount> => ({
    account: null,
    scope: address === null ? null : SCOPE,
    address,
})

const makeItem = (id: string): RampHistoryItem =>
    ({
        id,
        status: 'completed',
        creationDatetime: '2024-01-01T00:00:00Z',
        provider: 'meld',
        pair: {} as RampHistoryItem['pair'],
        paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
        sourceAmount: null,
        destinationAmount: null,
        sourceCurrencyCode: null,
        destinationCurrencyCode: null,
    }) as unknown as RampHistoryItem

const ITEMS = [makeItem('item-1'), makeItem('item-2')]

const mockFetchNextPage = vi.fn()
const mockRefetch = vi.fn()

const makeQueryResult = (
    overrides: Partial<ReturnType<typeof useRampHistoryInfiniteQuery>> = {},
) => ({
    items: ITEMS,
    isLoading: false,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: mockFetchNextPage,
    refetch: mockRefetch,
    ...overrides,
})

describe('useOnrampHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useDeploymentDeviceID).mockReturnValue('device-123')
        vi.mocked(useOnrampAccount).mockReturnValue(onrampAccountAt('ADDR'))
        vi.mocked(useRampHistoryInfiniteQuery).mockReturnValue(
            makeQueryResult(),
        )
    })

    it('exposes items from the infinite query', () => {
        const { result } = renderHook(() => useOnrampHistory())

        expect(result.current.items).toBe(ITEMS)
    })

    it('passes the device id, account address, and null status to the query on initial render', () => {
        renderHook(() => useOnrampHistory())

        expect(useRampHistoryInfiniteQuery).toHaveBeenCalledWith({
            scope: SCOPE,
            deviceId: 'device-123',
            accountAddress: 'ADDR',
            status: undefined,
            isActive: true,
        })
    })

    it('updates statusFilter and passes new status to the query after setStatusFilter', () => {
        const { result } = renderHook(() => useOnrampHistory())

        expect(result.current.statusFilter).toBeNull()

        act(() => {
            result.current.setStatusFilter('completed')
        })

        expect(result.current.statusFilter).toBe('completed')
        expect(useRampHistoryInfiniteQuery).toHaveBeenLastCalledWith({
            scope: SCOPE,
            deviceId: 'device-123',
            accountAddress: 'ADDR',
            status: 'completed',
            isActive: true,
        })
    })

    it('passes hasNextPage and fetchNextPage through from the query', () => {
        vi.mocked(useRampHistoryInfiniteQuery).mockReturnValue(
            makeQueryResult({ hasNextPage: true }),
        )

        const { result } = renderHook(() => useOnrampHistory())

        expect(result.current.hasNextPage).toBe(true)

        result.current.fetchNextPage()
        expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
    })

    it('falls back to empty deviceId when useDeploymentDeviceID returns null', () => {
        vi.mocked(useDeploymentDeviceID).mockReturnValue(null)

        renderHook(() => useOnrampHistory())

        expect(useRampHistoryInfiniteQuery).toHaveBeenCalledWith(
            expect.objectContaining({ deviceId: '' }),
        )
    })

    it('falls back to empty accountAddress when no account is selected', () => {
        vi.mocked(useOnrampAccount).mockReturnValue(onrampAccountAt(null))

        renderHook(() => useOnrampHistory())

        expect(useRampHistoryInfiniteQuery).toHaveBeenCalledWith(
            expect.objectContaining({ accountAddress: '' }),
        )
    })

    it('passes through isLoading, isFetchingNextPage, and isError from the query', () => {
        vi.mocked(useRampHistoryInfiniteQuery).mockReturnValue(
            makeQueryResult({
                isLoading: true,
                isFetchingNextPage: true,
                isError: true,
            }),
        )

        const { result } = renderHook(() => useOnrampHistory())

        expect(result.current.isLoading).toBe(true)
        expect(result.current.isFetchingNextPage).toBe(true)
        expect(result.current.isError).toBe(true)
    })

    it('calls refetch passthrough', () => {
        const { result } = renderHook(() => useOnrampHistory())

        result.current.refetch()
        expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it('opens the order details sheet when a row is pressed', () => {
        const { result } = renderHook(() => useOnrampHistory())

        act(() => result.current.handleItemPress(makeItem('order-1')))

        expect(mockRequestBottomSheet).toHaveBeenCalledWith(
            expect.objectContaining({ contents: expect.anything() }),
        )
    })
})
