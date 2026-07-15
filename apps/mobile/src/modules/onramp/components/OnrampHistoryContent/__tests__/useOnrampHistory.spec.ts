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
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useSelectedAccountAddress } from '@perawallet/wallet-core-accounts'

import { useOnrampHistory } from '../useOnrampHistory'

vi.mock('@perawallet/wallet-core-onramp', () => ({
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
        vi.mocked(useNetwork).mockReturnValue({
            network: 'mainnet',
        } as never)
        vi.mocked(useDeviceID).mockReturnValue('device-123')
        vi.mocked(useSelectedAccountAddress).mockReturnValue({
            selectedAccountAddress: 'ADDR',
            setSelectedAccountAddress: vi.fn(),
        })
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

    it('falls back to empty deviceId when useDeviceID returns null', () => {
        vi.mocked(useDeviceID).mockReturnValue(null)

        renderHook(() => useOnrampHistory())

        expect(useRampHistoryInfiniteQuery).toHaveBeenCalledWith(
            expect.objectContaining({ deviceId: '' }),
        )
    })

    it('falls back to empty accountAddress when selectedAccountAddress is null', () => {
        vi.mocked(useSelectedAccountAddress).mockReturnValue({
            selectedAccountAddress: null,
            setSelectedAccountAddress: vi.fn(),
        })

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
})
