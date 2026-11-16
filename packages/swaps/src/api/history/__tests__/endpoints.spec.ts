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

import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { PeraNetworkError, queryClient } from '@perawallet/wallet-core-shared'
import { fetchDeviceSwapHistory, fetchSwapHistory } from '../endpoints'
import { routerOrderItem, SCOPE_A } from '../../__tests__/routerFixtures'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    queryClient: vi.fn(),
}))

describe('fetchSwapHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('asks for the device and accounts and reads the next cursor', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                next: 'https://x/api/v4/swap/history/?cursor=n2',
                results: [routerOrderItem()],
            },
        })

        const page = await fetchSwapHistory(
            { deviceId: 'dev-1', accounts: ['fake-a:main:A', 'fake-a:main:B'] },
            SCOPE_A,
        )

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: '/api/v4/swap/history/',
                params: {
                    device_id: 'dev-1',
                    accounts: 'fake-a:main:A,fake-a:main:B',
                },
            }),
        )
        expect(page.results).toHaveLength(1)
        expect(page.next).toBe('n2')
    })
})

describe('fetchDeviceSwapHistory', () => {
    const refusal = (status: number, backendCode: string) =>
        new PeraNetworkError('client', { status, backendCode })
    const notOnDevice = () => refusal(422, 'account_not_on_device')
    const page = (...orders: ReturnType<typeof routerOrderItem>[]) => ({
        data: { next: null, results: orders },
    })
    const accountParam = (call: unknown[]) =>
        (call[0] as { params: { accounts?: string } }).params.accounts

    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('reads the accounts alone when the combined read names one the device lacks, keeping the registered ones', async () => {
        ;(queryClient as Mock).mockImplementation(
            async (request: { params: { accounts?: string } }) => {
                if (request.params.accounts === 'fake-a:main:A') {
                    return page(routerOrderItem({ order_id: 'a-1' }))
                }
                throw notOnDevice()
            },
        )

        const result = await fetchDeviceSwapHistory(
            { deviceId: 'dev-1', accounts: ['fake-a:main:A', 'fake-a:main:B'] },
            SCOPE_A,
        )

        expect(result.results.map(item => item.orderId)).toEqual(['a-1'])
        expect(result.next).toBeNull()
    })

    test('dedupes shared orders, sorts newest first and slices to the limit', async () => {
        ;(queryClient as Mock).mockImplementation(
            async (request: { params: { accounts?: string } }) => {
                if (request.params.accounts === 'fake-a:main:A,fake-a:main:B') {
                    throw notOnDevice()
                }
                return request.params.accounts === 'fake-a:main:A'
                    ? page(
                          routerOrderItem({
                              order_id: 'old',
                              created_at: '2026-10-01T10:00:00Z',
                          }),
                          routerOrderItem({
                              order_id: 'shared',
                              created_at: '2026-10-03T10:00:00Z',
                          }),
                      )
                    : page(
                          routerOrderItem({
                              order_id: 'shared',
                              created_at: '2026-10-03T10:00:00Z',
                          }),
                          routerOrderItem({
                              order_id: 'new',
                              created_at: '2026-10-05T10:00:00Z',
                          }),
                      )
            },
        )

        const result = await fetchDeviceSwapHistory(
            {
                deviceId: 'dev-1',
                accounts: ['fake-a:main:A', 'fake-a:main:B'],
                limit: 2,
            },
            SCOPE_A,
        )

        expect(result.results.map(item => item.orderId)).toEqual([
            'new',
            'shared',
        ])
    })

    test('is empty when the only account named is not on the device', async () => {
        ;(queryClient as Mock).mockRejectedValue(notOnDevice())

        const result = await fetchDeviceSwapHistory(
            { deviceId: 'dev-1', accounts: ['fake-a:main:A'] },
            SCOPE_A,
        )

        expect(result).toEqual({ results: [], next: null })
        expect(queryClient).toHaveBeenCalledTimes(1)
    })

    test('is empty when the router does not know the device', async () => {
        ;(queryClient as Mock).mockRejectedValue(
            refusal(404, 'device_not_found'),
        )

        const result = await fetchDeviceSwapHistory(
            { deviceId: 'dev-1', accounts: [] },
            SCOPE_A,
        )

        expect(result).toEqual({ results: [], next: null })
    })

    test('rejects on any other failure', async () => {
        ;(queryClient as Mock).mockRejectedValue(
            new PeraNetworkError('server', { status: 500 }),
        )

        await expect(
            fetchDeviceSwapHistory(
                { deviceId: 'dev-1', accounts: ['fake-a:main:A'] },
                SCOPE_A,
            ),
        ).rejects.toThrow()
    })

    test('rejects when a per-account read fails for another reason', async () => {
        ;(queryClient as Mock).mockImplementation(
            async (request: { params: { accounts?: string } }) => {
                if (request.params.accounts === 'fake-a:main:A') {
                    throw new PeraNetworkError('server', { status: 500 })
                }
                throw notOnDevice()
            },
        )

        await expect(
            fetchDeviceSwapHistory(
                {
                    deviceId: 'dev-1',
                    accounts: ['fake-a:main:A', 'fake-a:main:B'],
                },
                SCOPE_A,
            ),
        ).rejects.toThrow()
    })

    test('rejects an account refusal on a later page instead of restarting the list', async () => {
        ;(queryClient as Mock).mockRejectedValue(notOnDevice())

        await expect(
            fetchDeviceSwapHistory(
                {
                    deviceId: 'dev-1',
                    accounts: ['fake-a:main:A', 'fake-a:main:B'],
                    cursor: 'n2',
                },
                SCOPE_A,
            ),
        ).rejects.toThrow()
        expect(queryClient).toHaveBeenCalledTimes(1)
        expect(accountParam((queryClient as Mock).mock.calls[0])).toBe(
            'fake-a:main:A,fake-a:main:B',
        )
    })
})
