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
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { useSwapHistoryInfiniteQuery } from '../useSwapHistoryInfiniteQuery'
import { fetchSwapHistory } from '../../api'
import { makeSwapHistoryItem } from '../../__tests__/swapHistoryFixture'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ACCOUNTS = [{ scope: SCOPE, address: 'ADDRESS', isOnDevice: true }]

vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<typeof import('../../api')>()),
    fetchSwapHistory: vi.fn(),
}))

// The unit environment registers no Ethereum deployment; give it the live one.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        deploymentOf: (scope: ChainScope | null) =>
            scope?.chainId === 'ethereum' ? 'live' : actual.deploymentOf(scope),
    }
})

const mockDeviceId = vi.hoisted(() => ({
    current: 'device-1' as string | null,
    byDeployment: null as Record<string, string | null> | null,
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceIdLookup: () => (deployment: string | null) =>
        mockDeviceId.byDeployment && deployment
            ? mockDeviceId.byDeployment[deployment]
            : mockDeviceId.current,
}))

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('swaps/useSwapHistoryInfiniteQuery', () => {
    beforeEach(() => {
        vi.mocked(fetchSwapHistory).mockReset()
        mockDeviceId.current = 'device-1'
        mockDeviceId.byDeployment = null
    })

    test('asks for the device and the account on the scope', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValueOnce({
            results: [makeSwapHistoryItem()],
            next: null,
        })

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery(ACCOUNTS),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(fetchSwapHistory).toHaveBeenCalledWith(
            {
                deviceId: 'device-1',
                accounts: ['fake-a:main:ADDRESS'],
                cursor: undefined,
                limit: 20,
            },
            SCOPE,
        )
        expect(result.current.swaps).toHaveLength(1)
        expect(result.current.hasNextPage).toBe(false)
    })

    test('narrows the loaded rows to the statuses asked for', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValueOnce({
            results: [
                makeSwapHistoryItem({ orderId: 'a', status: 'completed' }),
                makeSwapHistoryItem({ orderId: 'b', status: 'cancelled' }),
                makeSwapHistoryItem({ orderId: 'c', status: 'refunded' }),
            ],
            next: null,
        })

        const { result } = renderHook(
            () =>
                useSwapHistoryInfiniteQuery(ACCOUNTS, [
                    'completed',
                    'refunded',
                ]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.swaps.map(item => item.orderId)).toEqual([
            'a',
            'c',
        ])
    })

    test('reads past a page the status filter empties', async () => {
        vi.mocked(fetchSwapHistory)
            .mockResolvedValueOnce({
                results: [
                    makeSwapHistoryItem({ orderId: 'a', status: 'cancelled' }),
                ],
                next: 'cursor-2',
            })
            .mockResolvedValueOnce({
                results: [
                    makeSwapHistoryItem({ orderId: 'b', status: 'completed' }),
                ],
                next: 'cursor-3',
            })

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery(ACCOUNTS, ['completed']),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.swaps.map(item => item.orderId)).toEqual(['b'])
        expect(vi.mocked(fetchSwapHistory).mock.calls[1][0].cursor).toBe(
            'cursor-2',
        )
        expect(result.current.hasNextPage).toBe(true)
    })

    test('stops reading ahead after a bounded number of emptied pages', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValue({
            results: [makeSwapHistoryItem({ status: 'cancelled' })],
            next: 'more',
        })

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery(ACCOUNTS, ['completed']),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.swaps).toEqual([])
        expect(fetchSwapHistory).toHaveBeenCalledTimes(11)
    })

    test('fetchNextPage passes the next cursor', async () => {
        vi.mocked(fetchSwapHistory)
            .mockResolvedValueOnce({
                results: [makeSwapHistoryItem({ orderId: 'a' })],
                next: 'abc123',
            })
            .mockResolvedValueOnce({
                results: [makeSwapHistoryItem({ orderId: 'b' })],
                next: null,
            })

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery(ACCOUNTS),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.hasNextPage).toBe(true))
        await act(async () => {
            result.current.fetchNextPage()
        })

        await waitFor(() => expect(result.current.swaps).toHaveLength(2))
        expect(vi.mocked(fetchSwapHistory).mock.calls[1][0].cursor).toBe(
            'abc123',
        )
    })

    test('waits for an account and a device id', () => {
        mockDeviceId.current = null
        renderHook(() => useSwapHistoryInfiniteQuery(ACCOUNTS), {
            wrapper: createWrapper(),
        })
        renderHook(() => useSwapHistoryInfiniteQuery([]), {
            wrapper: createWrapper(),
        })

        expect(fetchSwapHistory).not.toHaveBeenCalled()
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchSwapHistory).mockRejectedValue(new Error('boom'))

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery(ACCOUNTS),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.swaps).toEqual([])
    })

    test('lists a cross-chain swap for an account holding addresses on two chains', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValueOnce({
            results: [makeSwapHistoryItem({ orderId: 'cross' })],
            next: null,
        })

        const { result } = renderHook(
            () =>
                useSwapHistoryInfiniteQuery([
                    { scope: SCOPE, address: 'ADDRESS', isOnDevice: true },
                    { scope: ETH_SCOPE, address: '0xETH', isOnDevice: true },
                ]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(vi.mocked(fetchSwapHistory).mock.calls[0]).toEqual([
            expect.objectContaining({
                accounts: ['fake-a:main:ADDRESS', 'fake-b:main:0xETH'],
            }),
            SCOPE,
        ])
        expect(result.current.swaps.map(item => item.orderId)).toEqual([
            'cross',
        ])
    })

    test('drops orders the user funded outside a wallet transaction', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValueOnce({
            results: [
                makeSwapHistoryItem({ orderId: 'swap' }),
                makeSwapHistoryItem({
                    orderId: 'deposit',
                    fundingMethod: 'deposit',
                }),
                makeSwapHistoryItem({
                    orderId: 'wallet',
                    fundingMethod: 'wallet_transaction',
                }),
            ],
            next: null,
        })

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery(ACCOUNTS),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.swaps.map(item => item.orderId)).toEqual([
            'swap',
            'wallet',
        ])
    })

    test('leaves out an account the device does not hold and keeps it out of the next page', async () => {
        const notOnDevice = new PeraNetworkError('client', {
            status: 422,
            backendCode: 'account_not_on_device',
        })
        vi.mocked(fetchSwapHistory).mockImplementation(async params => {
            if (params.accounts.includes('fake-b:main:0xETH')) throw notOnDevice
            return params.cursor
                ? {
                      results: [makeSwapHistoryItem({ orderId: 'b' })],
                      next: null,
                  }
                : {
                      results: [makeSwapHistoryItem({ orderId: 'a' })],
                      next: 'c2',
                  }
        })

        const { result } = renderHook(
            () =>
                useSwapHistoryInfiniteQuery([
                    { scope: SCOPE, address: 'ADDRESS', isOnDevice: true },
                    { scope: ETH_SCOPE, address: '0xETH', isOnDevice: true },
                ]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.swaps).toHaveLength(1))
        expect(result.current.isError).toBe(false)
        await act(async () => {
            result.current.fetchNextPage()
        })
        await waitFor(() => expect(result.current.swaps).toHaveLength(2))
        expect(vi.mocked(fetchSwapHistory).mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({
                accounts: ['fake-a:main:ADDRESS'],
                cursor: 'c2',
            }),
        )
    })

    test('flags the refusal when the device holds none of the accounts', async () => {
        vi.mocked(fetchSwapHistory).mockRejectedValue(
            new PeraNetworkError('client', {
                status: 422,
                backendCode: 'account_not_on_device',
            }),
        )

        const { result } = renderHook(
            () => useSwapHistoryInfiniteQuery(ACCOUNTS),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.isAccountNotOnDevice).toBe(true)
    })

    test('asks only for the accounts device registration sends, on the first of them', async () => {
        vi.mocked(fetchSwapHistory).mockResolvedValueOnce({
            results: [makeSwapHistoryItem()],
            next: null,
        })

        const { result } = renderHook(
            () =>
                useSwapHistoryInfiniteQuery([
                    { scope: ETH_SCOPE, address: '0xETH', isOnDevice: false },
                    { scope: SCOPE, address: 'ADDRESS', isOnDevice: true },
                ]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(vi.mocked(fetchSwapHistory).mock.calls[0]).toEqual([
            expect.objectContaining({ accounts: ['fake-a:main:ADDRESS'] }),
            SCOPE,
        ])
        expect(result.current.isAccountNotOnDevice).toBe(false)
    })

    test('asks for nothing and flags it when no account is on this device', () => {
        const { result } = renderHook(
            () =>
                useSwapHistoryInfiniteQuery([
                    { scope: SCOPE, address: 'ADDRESS', isOnDevice: false },
                ]),
            { wrapper: createWrapper() },
        )

        expect(fetchSwapHistory).not.toHaveBeenCalled()
        expect(result.current.isAccountNotOnDevice).toBe(true)
        expect(result.current.isLoading).toBe(false)
    })

    describe('across batches', () => {
        const MANY = Array.from({ length: 25 }, (_, index) => ({
            scope: SCOPE,
            address: `ADDRESS${index}`,
            isOnDevice: true,
        }))
        const idsOf = (params: { accounts: string[] }) => params.accounts.length

        test('reads 25 accounts as requests of 20 and 5 and merges newest first', async () => {
            vi.mocked(fetchSwapHistory).mockImplementation(async params =>
                idsOf(params) === 20
                    ? {
                          results: [
                              makeSwapHistoryItem({
                                  orderId: 'old',
                                  createdAt: '2026-10-01T00:00:00Z',
                              }),
                          ],
                          next: null,
                      }
                    : {
                          results: [
                              makeSwapHistoryItem({
                                  orderId: 'new',
                                  createdAt: '2026-10-02T00:00:00Z',
                              }),
                          ],
                          next: null,
                      },
            )

            const { result } = renderHook(
                () => useSwapHistoryInfiniteQuery(MANY),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.swaps).toHaveLength(2))
            expect(
                vi
                    .mocked(fetchSwapHistory)
                    .mock.calls.map(([params]) => params.accounts.length)
                    .sort((a, b) => a - b),
            ).toEqual([5, 20])
            expect(result.current.swaps.map(item => item.orderId)).toEqual([
                'new',
                'old',
            ])
        })

        test('pages only the batches that have a cursor, each with its own cursor and accounts', async () => {
            vi.mocked(fetchSwapHistory).mockImplementation(async params => {
                if (params.cursor) {
                    return {
                        results: [
                            makeSwapHistoryItem({
                                orderId: 'next',
                                createdAt: '2026-09-01T00:00:00Z',
                            }),
                        ],
                        next: null,
                    }
                }
                return idsOf(params) === 20
                    ? {
                          results: [
                              makeSwapHistoryItem({
                                  orderId: 'first',
                                  createdAt: '2026-10-01T00:00:00Z',
                              }),
                          ],
                          next: 'c-20',
                      }
                    : { results: [], next: null }
            })

            const { result } = renderHook(
                () => useSwapHistoryInfiniteQuery(MANY),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.hasNextPage).toBe(true))
            await act(async () => {
                result.current.fetchNextPage()
            })

            await waitFor(() => expect(result.current.swaps).toHaveLength(2))
            const paged = vi
                .mocked(fetchSwapHistory)
                .mock.calls.filter(([params]) => params.cursor)
            expect(paged).toHaveLength(1)
            expect(paged[0][0].cursor).toBe('c-20')
            expect(paged[0][0].accounts).toHaveLength(20)
        })

        test("keeps the other batch's rows when the device holds none of one batch", async () => {
            vi.mocked(fetchSwapHistory).mockImplementation(async params => {
                if (idsOf(params) === 5) {
                    throw new PeraNetworkError('client', {
                        status: 422,
                        backendCode: 'account_not_on_device',
                    })
                }
                return {
                    results: [makeSwapHistoryItem({ orderId: 'kept' })],
                    next: null,
                }
            })

            const { result } = renderHook(
                () => useSwapHistoryInfiniteQuery(MANY),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.swaps).toHaveLength(1))
            expect(result.current.isError).toBe(false)
            expect(result.current.isAccountNotOnDevice).toBe(false)
            expect(result.current.hasFailedBatch).toBe(false)
        })

        test("keeps the other batch's rows when one batch fails for another reason", async () => {
            vi.mocked(fetchSwapHistory).mockImplementation(async params => {
                if (idsOf(params) === 5) throw new Error('offline')
                return {
                    results: [makeSwapHistoryItem({ orderId: 'kept' })],
                    next: null,
                }
            })

            const { result } = renderHook(
                () => useSwapHistoryInfiniteQuery(MANY),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.swaps).toHaveLength(1))
            expect(result.current.isError).toBe(false)
            expect(result.current.hasFailedBatch).toBe(true)
        })

        test('flags a failed batch when the batches that loaded have no rows', async () => {
            vi.mocked(fetchSwapHistory).mockImplementation(async params => {
                if (idsOf(params) === 5) throw new Error('offline')
                return { results: [], next: null }
            })

            const { result } = renderHook(
                () => useSwapHistoryInfiniteQuery(MANY),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isLoading).toBe(false))
            expect(result.current.swaps).toEqual([])
            expect(result.current.hasFailedBatch).toBe(true)
        })

        test('fails the read when every batch fails, a real failure outranking a refusal', async () => {
            vi.mocked(fetchSwapHistory).mockImplementation(async params => {
                if (idsOf(params) === 5) throw new Error('offline')
                throw new PeraNetworkError('client', {
                    status: 422,
                    backendCode: 'account_not_on_device',
                })
            })

            const { result } = renderHook(
                () => useSwapHistoryInfiniteQuery(MANY),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.isAccountNotOnDevice).toBe(false)
        })

        test('reports loading, not empty, while no deployment has a device id yet', () => {
            mockDeviceId.byDeployment = { live: null, developer: null }

            const { result } = renderHook(
                () => useSwapHistoryInfiniteQuery(MANY),
                { wrapper: createWrapper() },
            )

            expect(fetchSwapHistory).not.toHaveBeenCalled()
            expect(result.current.isLoading).toBe(true)
            expect(result.current.isError).toBe(false)
        })

        test('reports an error instead of loading forever when no device id registers', () => {
            vi.useFakeTimers()
            try {
                mockDeviceId.byDeployment = { live: null, developer: null }

                const { result } = renderHook(
                    () => useSwapHistoryInfiniteQuery(MANY),
                    { wrapper: createWrapper() },
                )
                expect(result.current.isLoading).toBe(true)

                act(() => {
                    vi.advanceTimersByTime(10_000)
                })

                expect(result.current.isLoading).toBe(false)
                expect(result.current.isError).toBe(true)
            } finally {
                vi.useRealTimers()
            }
        })

        test('names the accounts read, changing once a device id registers', async () => {
            mockDeviceId.byDeployment = { live: null, developer: null }
            vi.mocked(fetchSwapHistory).mockResolvedValue({
                results: [],
                next: null,
            })

            const { result, rerender } = renderHook(
                () => useSwapHistoryInfiniteQuery(MANY),
                { wrapper: createWrapper() },
            )
            expect(result.current.readKey).toBe('')

            mockDeviceId.byDeployment = { live: 'device-1', developer: null }
            rerender()

            await waitFor(() => expect(result.current.isLoading).toBe(false))
            expect(result.current.readKey).toContain('ADDRESS0')
        })

        test('flags the refusal when every batch is refused', async () => {
            vi.mocked(fetchSwapHistory).mockRejectedValue(
                new PeraNetworkError('client', {
                    status: 422,
                    backendCode: 'account_not_on_device',
                }),
            )

            const { result } = renderHook(
                () => useSwapHistoryInfiniteQuery(MANY),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.isAccountNotOnDevice).toBe(true)
        })

        test('reads the deployments the device has an id for when another has none', async () => {
            const testnet = {
                scope: {
                    chainId: 'algorand',
                    networkId: 'testnet',
                } as ChainScope,
                address: 'TESTNET',
                isOnDevice: true,
            }
            mockDeviceId.byDeployment = { live: 'device-1', developer: null }
            vi.mocked(fetchSwapHistory).mockResolvedValue({
                results: [makeSwapHistoryItem({ orderId: 'live' })],
                next: null,
            })

            const { result } = renderHook(
                () => useSwapHistoryInfiniteQuery([...ACCOUNTS, testnet]),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.swaps).toHaveLength(1))
            expect(fetchSwapHistory).toHaveBeenCalledTimes(1)
            expect(result.current.isError).toBe(false)
        })

        test('reads a deployment once its device id registers', async () => {
            const testnet = {
                scope: {
                    chainId: 'algorand',
                    networkId: 'testnet',
                } as ChainScope,
                address: 'TESTNET',
                isOnDevice: true,
            }
            mockDeviceId.byDeployment = { live: 'device-1', developer: null }
            vi.mocked(fetchSwapHistory).mockImplementation(
                async (_params, scope) => ({
                    results: [
                        makeSwapHistoryItem({
                            orderId: scope.networkId,
                            createdAt:
                                scope.networkId === 'testnet'
                                    ? '2026-10-02T00:00:00Z'
                                    : '2026-10-01T00:00:00Z',
                        }),
                    ],
                    next: null,
                }),
            )

            const { result, rerender } = renderHook(
                () => useSwapHistoryInfiniteQuery([...ACCOUNTS, testnet]),
                { wrapper: createWrapper() },
            )
            await waitFor(() => expect(result.current.swaps).toHaveLength(1))

            mockDeviceId.byDeployment = {
                live: 'device-1',
                developer: 'device-2',
            }
            rerender()

            await waitFor(() => expect(result.current.swaps).toHaveLength(2))
            expect(result.current.swaps.map(item => item.orderId)).toEqual([
                'testnet',
                'mainnet',
            ])
        })
    })
})
