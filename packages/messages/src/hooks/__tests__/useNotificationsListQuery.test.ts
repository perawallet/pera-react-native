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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-extension-platform'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-config'
import { useNotificationsListQuery } from '../useNotificationsListQuery'
import { fetchNotificationList } from '../../api/notifications'
import { useDeviceID } from '@perawallet/wallet-core-device'

vi.mock('../../api/notifications', () => ({
    fetchNotificationList: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return {
        ...actual,
        useDeviceID: vi.fn().mockReturnValue('test-device-id'),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
}))

beforeEach(() => {
    vi.mocked(useNetwork).mockReturnValue({
        network: 'mainnet',
    } as ReturnType<typeof useNetwork>)
})

describe('useNotificationsListQuery', () => {
    it('should fetch notifications list and map response', async () => {
        const mockDate = new Date('2023-01-01T00:00:00Z')
        const mockResponse = {
            count: 1,
            next: null,
            previous: null,
            results: [
                {
                    id: '1',
                    account_address: 'TESTADDR123',
                    message: 'Test Message',
                    url: 'perawallet://account-detail?address=TESTADDR123',
                    creation_datetime: mockDate.toISOString(),
                    icon: {
                        logo: 'https://example.com/icon.png',
                        shape: 'circle' as const,
                    },
                },
            ],
        }
        vi.mocked(fetchNotificationList).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useNotificationsListQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.isPending).toBe(false)
        })

        expect(fetchNotificationList).toHaveBeenCalledWith(
            'mainnet',
            'test-device-id',
            '',
        )

        expect(result.current.data).toEqual([
            {
                id: '1',
                accountAddress: 'TESTADDR123',
                message: 'Test Message',
                url: 'perawallet://account-detail?address=TESTADDR123',
                createdAt: mockDate,
                icon: {
                    logo: 'https://example.com/icon.png',
                    shape: 'circle',
                },
            },
        ])
    })

    it('preserves null wire fields so the UI can handle absence explicitly', async () => {
        const mockResponse = {
            count: 1,
            next: null,
            previous: null,
            results: [
                {
                    id: '5',
                    type: null,
                    account_address: null,
                    message: null,
                    url: null,
                    creation_datetime: '2023-01-01T00:00:00Z',
                    is_unread: null,
                },
            ],
        }
        vi.mocked(fetchNotificationList).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useNotificationsListQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data).toEqual([
            {
                id: '5',
                type: null,
                accountAddress: null,
                message: null,
                url: null,
                createdAt: new Date('2023-01-01T00:00:00Z'),
                isUnread: null,
                icon: null,
            },
        ])
    })

    it('maps a response with no icon to icon: null', async () => {
        const mockResponse = {
            count: 1,
            next: null,
            previous: null,
            results: [
                {
                    id: '2',
                    account_address: 'ADDR2',
                    message: 'No icon',
                    url: 'perawallet://',
                    creation_datetime: new Date().toISOString(),
                },
            ],
        }
        vi.mocked(fetchNotificationList).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useNotificationsListQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data?.[0].icon).toBeNull()
    })

    it('reports a terminal, non-loading unregistered state when deviceID is null', () => {
        vi.mocked(useDeviceID).mockReturnValueOnce(null)
        vi.mocked(fetchNotificationList).mockClear()

        const { result } = renderHook(() => useNotificationsListQuery(), {
            wrapper: createWrapper(),
        })

        // A disabled query keeps `status: 'pending'` in React Query v5, so
        // surfacing `query.isPending` here would spin the empty view forever.
        expect(result.current.isPending).toBe(false)
        expect(result.current.isDeviceUnregistered).toBe(true)
        expect(fetchNotificationList).not.toHaveBeenCalled()
    })

    it('passes only the cursor query param (not the full next URL) when fetching the next page', async () => {
        const nextCursor = 'cD0xMjM0NTY3'
        vi.mocked(fetchNotificationList).mockResolvedValueOnce({
            count: 1,
            next: `https://mobile-api.perawallet.app/v2/devices/test-device-id/notifications/?cursor=${nextCursor}&page_size=20`,
            previous: null,
            results: [],
        })

        const { result } = renderHook(() => useNotificationsListQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        vi.mocked(fetchNotificationList).mockResolvedValueOnce({
            count: 0,
            next: null,
            previous: null,
            results: [],
        })

        await result.current.fetchNextPage()

        expect(fetchNotificationList).toHaveBeenLastCalledWith(
            'mainnet',
            'test-device-id',
            nextCursor,
        )
    })

    it('returns referentially stable refetch and fetchNextPage across renders', async () => {
        vi.mocked(fetchNotificationList).mockResolvedValue({
            count: 0,
            next: null,
            previous: null,
            results: [],
        })

        const { result, rerender } = renderHook(
            () => useNotificationsListQuery(),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        const { refetch, fetchNextPage } = result.current

        rerender()

        // NotificationsScreen refetches on focus with `refetch` in the effect
        // deps: a per-render identity re-runs the effect after every render
        // the refetch itself causes — an infinite request loop (~1/s) with the
        // refresh spinner pinned.
        expect(result.current.refetch).toBe(refetch)
        expect(result.current.fetchNextPage).toBe(fetchNextPage)
    })

    it('treats a next URL with an empty cursor as the last page instead of refetching page one forever', async () => {
        vi.mocked(fetchNotificationList).mockClear()
        // Staging returns `next` with `?cursor=` (empty) on the last page;
        // an empty-string page param must read as "no next page", or the
        // list loops the same request once per onEndReached tick.
        vi.mocked(fetchNotificationList).mockResolvedValue({
            count: 0,
            next: 'https://mobile-api.perawallet.app/v2/devices/test-device-id/notifications/?cursor=',
            previous: null,
            results: [],
        })

        const { result } = renderHook(() => useNotificationsListQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(fetchNotificationList).toHaveBeenCalledTimes(1)

        await result.current.fetchNextPage()

        expect(fetchNotificationList).toHaveBeenCalledTimes(1)
    })

    describe('offline and error states', () => {
        beforeEach(() => {
            vi.mocked(fetchNotificationList).mockClear()
        })

        afterEach(() => {
            onlineManager.setOnline(true)
        })

        it('reports isPaused — not isPending — when offline pauses an uncached query', async () => {
            onlineManager.setOnline(false)

            const { result } = renderHook(() => useNotificationsListQuery(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isPaused).toBe(true))
            // A paused query keeps `status: 'pending'`; surfacing that as
            // isPending would spin the empty view for as long as the device
            // (or Android's connectivity validation) reports no internet.
            expect(result.current.isPending).toBe(false)
            expect(fetchNotificationList).not.toHaveBeenCalled()
        })

        it('reports isError when the fetch fails', async () => {
            vi.mocked(fetchNotificationList).mockRejectedValueOnce(
                new Error('boom'),
            )

            const { result } = renderHook(() => useNotificationsListQuery(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.isPending).toBe(false)
            expect(result.current.isPaused).toBe(false)
        })
    })

    describe('non-Pera-backed networks', () => {
        beforeEach(() => {
            vi.mocked(fetchNotificationList).mockClear()
        })

        it.each([Networks.betanet, Networks.custom])(
            'disables the query, flags isUnavailableOnNetwork and returns [] on %s',
            network => {
                vi.mocked(useNetwork).mockReturnValue({
                    network,
                } as ReturnType<typeof useNetwork>)

                const { result } = renderHook(
                    () => useNotificationsListQuery(),
                    {
                        wrapper: createWrapper(),
                    },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(true)
                // Network unavailability outranks the missing-device state:
                // this can never succeed, so it must not read as "unregistered".
                expect(result.current.isDeviceUnregistered).toBe(false)
                expect(result.current.isPending).toBe(false)
                expect(result.current.data).toEqual([])
                expect(fetchNotificationList).not.toHaveBeenCalled()
            },
        )

        it.each([Networks.betanet, Networks.custom])(
            'no-ops fetchNextPage on %s',
            async network => {
                vi.mocked(useNetwork).mockReturnValue({
                    network,
                } as ReturnType<typeof useNetwork>)

                const { result } = renderHook(
                    () => useNotificationsListQuery(),
                    {
                        wrapper: createWrapper(),
                    },
                )

                await result.current.fetchNextPage()

                expect(fetchNotificationList).not.toHaveBeenCalled()
            },
        )
    })
})
