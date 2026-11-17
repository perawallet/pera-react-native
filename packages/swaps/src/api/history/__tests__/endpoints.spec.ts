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

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest'
import {
    logger,
    PeraNetworkError,
    queryClient,
} from '@perawallet/wallet-core-shared'
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
    const page = (
        next: string | null,
        ...orders: ReturnType<typeof routerOrderItem>[]
    ) => ({
        data: { next, results: orders },
    })
    const accountParams = () =>
        (queryClient as Mock).mock.calls.map(
            call =>
                (call[0] as { params: { accounts?: string } }).params.accounts,
        )
    // The refusal memo is module state, so each test names its own device.
    let deviceId: string
    let deviceCount = 0
    const A = 'fake-a:main:A'
    const B = 'fake-a:main:B'
    const C = 'fake-a:main:C'

    beforeEach(() => {
        vi.clearAllMocks()
        deviceId = `dev-${++deviceCount}`
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    const refuseAccounts = (...refused: string[]) =>
        (queryClient as Mock).mockImplementation(
            async (request: { params: { accounts?: string } }) => {
                const named = (request.params.accounts ?? '').split(',')
                if (named.some(account => refused.includes(account))) {
                    throw notOnDevice()
                }
                return page('n2', routerOrderItem({ order_id: 'a-1' }))
            },
        )

    test('drops the refused account and re-reads the rest so the cursor survives', async () => {
        refuseAccounts(B)

        const result = await fetchDeviceSwapHistory(
            { deviceId, accounts: [A, B], limit: 20 },
            SCOPE_A,
        )

        expect(result.results.map(item => item.orderId)).toEqual(['a-1'])
        expect(result.next).toBe('n2')
        expect(accountParams().at(-1)).toBe(A)
    })

    test('skips the refused account on later reads, pages included', async () => {
        refuseAccounts(B)
        await fetchDeviceSwapHistory({ deviceId, accounts: [A, B] }, SCOPE_A)
        vi.clearAllMocks()

        const result = await fetchDeviceSwapHistory(
            { deviceId, accounts: [A, B], cursor: 'n2' },
            SCOPE_A,
        )

        expect(accountParams()).toEqual([A])
        expect(result.next).toBe('n2')
    })

    test('stops skipping a refused account once the memo expires', async () => {
        vi.useFakeTimers()
        refuseAccounts(B)
        await fetchDeviceSwapHistory({ deviceId, accounts: [A, B] }, SCOPE_A)
        vi.clearAllMocks()
        vi.advanceTimersByTime(6 * 60 * 1000)

        await fetchDeviceSwapHistory({ deviceId, accounts: [A, B] }, SCOPE_A)

        expect(accountParams()[0]).toBe(`${A},${B}`)
    })

    test('does not carry a refusal across devices', async () => {
        refuseAccounts(B)
        await fetchDeviceSwapHistory({ deviceId, accounts: [A, B] }, SCOPE_A)
        vi.clearAllMocks()

        await fetchDeviceSwapHistory(
            { deviceId: `${deviceId}-other`, accounts: [A, B] },
            SCOPE_A,
        )

        expect(accountParams()[0]).toBe(`${A},${B}`)
    })

    test('is empty when every named account is refused', async () => {
        refuseAccounts(A, B)

        const result = await fetchDeviceSwapHistory(
            { deviceId, accounts: [A, B] },
            SCOPE_A,
        )

        expect(result).toEqual({ results: [], next: null })
        vi.clearAllMocks()
        await fetchDeviceSwapHistory({ deviceId, accounts: [A, B] }, SCOPE_A)
        expect(queryClient).not.toHaveBeenCalled()
    })

    test('is empty when the only account named is not on the device', async () => {
        ;(queryClient as Mock).mockRejectedValue(notOnDevice())

        const result = await fetchDeviceSwapHistory(
            { deviceId, accounts: [A] },
            SCOPE_A,
        )

        expect(result).toEqual({ results: [], next: null })
        expect(queryClient).toHaveBeenCalledTimes(1)
    })

    test('keeps the readable accounts when three are named and one is refused', async () => {
        refuseAccounts(C)

        await fetchDeviceSwapHistory({ deviceId, accounts: [A, B, C] }, SCOPE_A)

        expect(accountParams().at(-1)).toBe(`${A},${B}`)
    })

    test('is empty when the router does not know the device', async () => {
        ;(queryClient as Mock).mockRejectedValue(
            refusal(404, 'device_not_found'),
        )

        const result = await fetchDeviceSwapHistory(
            { deviceId, accounts: [] },
            SCOPE_A,
        )

        expect(result).toEqual({ results: [], next: null })
    })

    test('rejects on any other failure', async () => {
        ;(queryClient as Mock).mockRejectedValue(
            new PeraNetworkError('server', { status: 500 }),
        )

        await expect(
            fetchDeviceSwapHistory({ deviceId, accounts: [A] }, SCOPE_A),
        ).rejects.toThrow()
    })

    test('remembers the refusals it confirmed when another probe fails', async () => {
        ;(queryClient as Mock).mockImplementation(
            async (request: { params: { accounts?: string } }) => {
                const named = (request.params.accounts ?? '').split(',')
                if (named.includes(C)) throw notOnDevice()
                if (named.includes(A)) {
                    throw new PeraNetworkError('server', { status: 500 })
                }
                return page(null)
            },
        )

        await expect(
            fetchDeviceSwapHistory({ deviceId, accounts: [A, B, C] }, SCOPE_A),
        ).rejects.toThrow()
        vi.clearAllMocks()
        ;(queryClient as Mock).mockResolvedValue(page(null))
        await fetchDeviceSwapHistory({ deviceId, accounts: [A, B, C] }, SCOPE_A)

        expect(accountParams()).toEqual([`${A},${B}`])
    })

    test('finds one refused account among eight by halving, not one probe each', async () => {
        const accounts = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(
            name => `fake-a:main:${name}`,
        )
        refuseAccounts(accounts[7])

        await fetchDeviceSwapHistory({ deviceId, accounts }, SCOPE_A)

        // The refused read, three halving probes, then the readable read.
        expect(queryClient).toHaveBeenCalledTimes(5)
        expect(accountParams().at(-1)).toBe(accounts.slice(0, 7).join(','))
    })

    test('logs how many accounts it drops, without naming them', async () => {
        const warn = vi.spyOn(logger, 'warn')
        refuseAccounts(B)

        await fetchDeviceSwapHistory({ deviceId, accounts: [A, B] }, SCOPE_A)

        expect(warn).toHaveBeenCalledWith(expect.any(String), {
            deviceId,
            dropped: 1,
            readable: 1,
        })
    })

    test("keeps a page's account list for its cursor after the memo expires", async () => {
        vi.useFakeTimers()
        refuseAccounts(B)
        await fetchDeviceSwapHistory({ deviceId, accounts: [A, B] }, SCOPE_A)
        vi.clearAllMocks()
        vi.advanceTimersByTime(6 * 60 * 1000)

        await fetchDeviceSwapHistory(
            { deviceId, accounts: [A, B], cursor: 'n2' },
            SCOPE_A,
        )

        expect(accountParams()).toEqual([A])
    })

    test('hands out a fresh empty page each time', async () => {
        refuseAccounts(A, B)

        const first = await fetchDeviceSwapHistory(
            { deviceId, accounts: [A, B] },
            SCOPE_A,
        )
        const second = await fetchDeviceSwapHistory(
            { deviceId, accounts: [A, B] },
            SCOPE_A,
        )

        expect(first.results).not.toBe(second.results)
    })

    test('rejects an account refusal on a page after the first', async () => {
        ;(queryClient as Mock).mockRejectedValue(notOnDevice())

        await expect(
            fetchDeviceSwapHistory(
                { deviceId, accounts: [A, B], cursor: 'n2' },
                SCOPE_A,
            ),
        ).rejects.toThrow()
        expect(queryClient).toHaveBeenCalledTimes(1)
    })
})
