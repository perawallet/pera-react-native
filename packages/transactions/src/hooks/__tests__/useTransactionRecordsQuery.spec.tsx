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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import {
    i18nKey,
    type ChainScope,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    PeraNetworkError,
    PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'
import {
    MAX_AUTO_RECORD_FETCHES,
    MAX_RECORD_PAGE_READS,
    useTransactionRecordsQuery,
} from '../useTransactionRecordsQuery'
import { invalidateTransactionQueriesForAddresses } from '../querykeys'

const mocks = vi.hoisted(() => ({
    getMinedTransactionHistory: vi.fn(),
    getPendingTransactionRecords: vi.fn(),
    ledgerListeners: new Set<() => void>(),
}))

vi.mock('../../pending-history', async importOriginal => ({
    ...(await importOriginal<typeof import('../../pending-history')>()),
    getPendingTransactionRecords: mocks.getPendingTransactionRecords,
    getMinedTransactionHistory: mocks.getMinedTransactionHistory,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    subscribeToSubmissionLedger: (listener: () => void) => {
        mocks.ledgerListeners.add(listener)
        return () => mocks.ledgerListeners.delete(listener)
    },
}))

const capability = vi.hoisted(() => ({ isDecoding: false }))

const NATIVE = vi.hoisted(() => '0')

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: () => capability.isDecoding,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    isNativeAssetId: (_chainId: string, assetId: string) => assetId === NATIVE,
}))

// EVM's codec compares case-blind.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    isSameAddress: (_chainId: string, a: string, b: string) =>
        a.toLowerCase() === b.toLowerCase(),
}))

const ADDRESS = '0xabc'
const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xusdc'

const record = (
    id: string,
    timestamp: number | undefined,
    assetId = NATIVE,
): TransactionRecord => ({
    id,
    scope: SCOPE,
    status: timestamp === undefined ? 'pending' : 'confirmed',
    timestamp,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('transactions.list_item.send') },
        direction: 'out',
        amount: {
            assetRef: { chainId: 'ethereum', assetId },
            value: new Decimal(1),
        },
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

const pendingSend = (id: string, timestamp: number): TransactionRecord => ({
    ...record(id, timestamp),
    status: 'pending',
})

const DAY_MS = 86_400_000
const JAN_10 = Date.parse('2026-01-10T12:00:00Z')

const gasOnly = (id: string, initiator?: string): TransactionRecord => ({
    id,
    scope: SCOPE,
    status: 'confirmed',
    timestamp: JAN_10,
    fee: new Decimal(21_000),
    ...(initiator !== undefined && { initiator }),
    summary: {
        kind: 'approval',
        title: { key: i18nKey('transactions.list_item.approval') },
        direction: 'none',
        icon: 'approval',
    },
    chainData: { family: 'evm' },
})

describe('useTransactionRecordsQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        vi.resetAllMocks()
        mocks.getPendingTransactionRecords.mockResolvedValue([])
        capability.isDecoding = false
        onlineManager.setOnline(true)
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, retryDelay: 0 } },
        })
        wrapper = ({ children }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    })

    afterEach(() => {
        onlineManager.setOnline(true)
        queryClient.clear()
    })

    test('starts a fresh list when contractDecoding flips, so loaded rows never keep the old labels', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValue({
            items: [record('A', JAN_10)],
        })
        const { result, rerender } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )
        await waitFor(() => expect(result.current.records).toHaveLength(1))
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(1)

        capability.isDecoding = true
        rerender()

        await waitFor(() =>
            expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(2),
        )
    })

    test('lists records newest first and pages on the backend cursor', async () => {
        mocks.getMinedTransactionHistory
            .mockResolvedValueOnce({
                items: [record('B', JAN_10), record('A', JAN_10 - DAY_MS)],
                next: { cursor: 'c1' },
            })
            .mockResolvedValueOnce({
                items: [record('Z', JAN_10 - 2 * DAY_MS)],
            })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.records).toHaveLength(2))
        expect(result.current.hasNextPage).toBe(true)

        act(() => result.current.fetchNextPage())

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual([
                'B',
                'A',
                'Z',
            ]),
        )
        expect(mocks.getMinedTransactionHistory).toHaveBeenLastCalledWith(
            ADDRESS,
            SCOPE,
            { cursor: 'c1' },
            undefined,
        )
        expect(result.current.hasNextPage).toBe(false)
    })

    test('reads past pages with nothing to show instead of settling on an empty one', async () => {
        mocks.getMinedTransactionHistory
            .mockResolvedValueOnce({ items: [], next: { cursor: 'c1' } })
            .mockResolvedValueOnce({
                items: [record('A', JAN_10)],
                next: { cursor: 'c2' },
            })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['A']),
        )
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(2)
        expect(result.current.hasNextPage).toBe(true)
    })

    test('reads at most the cap per fetch, then asks for the next page itself', async () => {
        for (let i = 1; i <= MAX_RECORD_PAGE_READS; i++) {
            mocks.getMinedTransactionHistory.mockResolvedValueOnce({
                items: [],
                next: { cursor: `c${i}` },
            })
        }
        mocks.getMinedTransactionHistory.mockResolvedValueOnce({
            items: [record('A', JAN_10)],
        })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['A']),
        )
        expect(queryClient.getQueryCache().getAll()[0].state.data).toEqual(
            expect.objectContaining({
                pages: [
                    {
                        records: [],
                        next: { cursor: `c${MAX_RECORD_PAGE_READS}` },
                    },
                    { records: [record('A', JAN_10)], next: null },
                ],
            }),
        )
        expect(mocks.getMinedTransactionHistory).toHaveBeenLastCalledWith(
            ADDRESS,
            SCOPE,
            { cursor: `c${MAX_RECORD_PAGE_READS}` },
            undefined,
        )
    })

    test('stops asking for pages after a failed one until a retry', async () => {
        for (let i = 1; i <= MAX_RECORD_PAGE_READS; i++) {
            mocks.getMinedTransactionHistory.mockResolvedValueOnce({
                items: [],
                next: { cursor: `c${i}` },
            })
        }
        mocks.getMinedTransactionHistory.mockRejectedValue(
            new Error('history service refused'),
        )

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        const callsAtFailure =
            mocks.getMinedTransactionHistory.mock.calls.length
        // The failed page is read once more, quietly, before the error shows.
        expect(callsAtFailure).toBe(MAX_RECORD_PAGE_READS + 2)
        expect(result.current.hasNextPage).toBe(true)
        expect(result.current.isNextPageError).toBe(true)

        mocks.getMinedTransactionHistory.mockResolvedValueOnce({
            items: [record('A', JAN_10)],
        })
        act(() => result.current.fetchNextPage())

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['A']),
        )
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(
            callsAtFailure + 1,
        )
    })

    test('pauses the search after its fetch budget and resumes on fetchNextPage', async () => {
        mocks.getMinedTransactionHistory.mockImplementation(
            async (_address, _scope, page?: { cursor: string }) => ({
                items: [],
                next: { cursor: `${page?.cursor ?? 'c'}+` },
            }),
        )

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        const budget = MAX_AUTO_RECORD_FETCHES * MAX_RECORD_PAGE_READS
        await waitFor(() => expect(result.current.isSearchPaused).toBe(true))
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(budget)

        act(() => result.current.fetchNextPage())

        await waitFor(() =>
            expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(
                2 * budget,
            ),
        )
        await waitFor(() => expect(result.current.isSearchPaused).toBe(true))
    })

    test('caps a run of empty pages after a match too, rather than walking the whole history', async () => {
        mocks.getMinedTransactionHistory.mockImplementation(
            async (_address, _scope, page?: { cursor: string }) => ({
                items: page ? [] : [record('MATCH', JAN_10)],
                next: { cursor: `${page?.cursor ?? 'c'}+` },
            }),
        )

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )
        await waitFor(() => expect(result.current.records).toHaveLength(1))
        expect(result.current.isSearchPaused).toBe(false)

        act(() => result.current.fetchNextPage())

        await waitFor(() => expect(result.current.isSearchPaused).toBe(true))
        expect(result.current.records.map(r => r.id)).toEqual(['MATCH'])
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(
            1 + MAX_AUTO_RECORD_FETCHES * MAX_RECORD_PAGE_READS,
        )
    })

    test('stays paused, not loading, while a background refetch re-reads its pages', async () => {
        mocks.getMinedTransactionHistory.mockImplementation(
            async (_address, _scope, page?: { cursor: string }) => ({
                items: [],
                next: { cursor: `${page?.cursor ?? 'c'}+` },
            }),
        )
        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )
        await waitFor(() => expect(result.current.isSearchPaused).toBe(true))

        mocks.getMinedTransactionHistory.mockImplementation(
            () => new Promise(() => {}),
        )
        act(() => result.current.refetch())

        await waitFor(() => expect(result.current.isFetching).toBe(true))
        expect(result.current.isSearchPaused).toBe(true)
    })

    test('leaves out a ledger send older than the range start and keeps paging', async () => {
        mocks.getPendingTransactionRecords.mockResolvedValue([
            pendingSend('STALE_SEND', JAN_10 - DAY_MS),
        ])
        mocks.getMinedTransactionHistory.mockResolvedValueOnce({
            items: [record('JAN10_LATE', JAN_10)],
            next: { cursor: 'c1' },
        })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    afterTime: '2026-01-10',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual([
                'JAN10_LATE',
            ]),
        )
        expect(result.current.hasNextPage).toBe(true)
    })

    describe('when the backend read fails', () => {
        const mount = () =>
            renderHook(
                () =>
                    useTransactionRecordsQuery({
                        accountAddress: ADDRESS,
                        scope: SCOPE,
                    }),
                { wrapper },
            )

        test.each([
            ['a network error', new PeraNetworkError('timeout')],
            ['a 5xx', new PeraNetworkError('server', { status: 503 })],
            [
                'a network with no history service',
                new PeraServiceUnavailableError(SCOPE),
            ],
        ])('still lists the ledger sends on %s', async (_name, failure) => {
            mocks.getPendingTransactionRecords.mockResolvedValue([
                pendingSend('STUCK', JAN_10),
            ])
            mocks.getMinedTransactionHistory.mockRejectedValue(failure)

            const { result } = mount()

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.error).toBe(failure)
            expect(result.current.isNextPageError).toBe(false)
            expect(result.current.records.map(r => r.id)).toEqual(['STUCK'])
            expect(result.current.records[0].status).toBe('pending')
        })

        test('merges the mined rows in once it answers, without a second row for the send', async () => {
            mocks.getPendingTransactionRecords.mockResolvedValue([
                pendingSend('SENT', JAN_10 + DAY_MS),
            ])
            mocks.getMinedTransactionHistory.mockRejectedValue(
                new PeraNetworkError('server', { status: 502 }),
            )
            const { result } = mount()
            await waitFor(() => expect(result.current.isError).toBe(true))

            mocks.getMinedTransactionHistory.mockResolvedValue({
                items: [record('SENT', JAN_10 + DAY_MS), record('A', JAN_10)],
            })
            act(() => result.current.refetch())

            await waitFor(() => expect(result.current.isError).toBe(false))
            expect(result.current.records.map(r => r.id)).toEqual(['SENT', 'A'])
            expect(result.current.records[0].status).toBe('confirmed')
        })

        test('lists a send made after a good load when the next refetch fails', async () => {
            mocks.getMinedTransactionHistory.mockResolvedValue({
                items: [record('A', JAN_10)],
            })
            const { result } = mount()
            await waitFor(() =>
                expect(result.current.records.map(r => r.id)).toEqual(['A']),
            )

            mocks.getPendingTransactionRecords.mockResolvedValue([
                pendingSend('SENT', JAN_10 + DAY_MS),
            ])
            mocks.getMinedTransactionHistory.mockRejectedValue(
                new PeraNetworkError('timeout'),
            )
            act(() => {
                for (const listener of mocks.ledgerListeners) listener()
                result.current.refetch()
            })

            await waitFor(() => expect(result.current.isError).toBe(true))
            await waitFor(() =>
                expect(result.current.records.map(r => r.id)).toEqual([
                    'SENT',
                    'A',
                ]),
            )
        })
    })

    describe('background refetch', () => {
        type Backend = Record<
            string,
            {
                items: TransactionRecord[]
                next?: { cursor: string }
            }
        >
        const serve = (backend: Backend) =>
            mocks.getMinedTransactionHistory.mockImplementation(
                async (_address, _scope, page?: { cursor: string }) =>
                    backend[page?.cursor ?? 'head'],
            )
        const mount = (params: { assetId?: string } = {}) =>
            renderHook(
                () =>
                    useTransactionRecordsQuery({
                        accountAddress: ADDRESS,
                        scope: SCOPE,
                        ...params,
                    }),
                { wrapper },
            )
        const cached = () =>
            queryClient.getQueryCache().getAll()[0].state.data as {
                pages: { records: TransactionRecord[] }[]
                pageParams: unknown[]
            }
        const loadPages = async (
            result: { current: { fetchNextPage: () => void } },
            count: number,
        ) => {
            await waitFor(() => expect(cached()?.pages).toHaveLength(1))
            for (let loaded = 1; loaded < count; loaded++) {
                act(() => result.current.fetchNextPage())
                await waitFor(() =>
                    expect(cached().pages).toHaveLength(loaded + 1),
                )
            }
        }
        const invalidate = async (options?: {
            shouldRefetchAllPages: true
        }) => {
            act(() => {
                invalidateTransactionQueriesForAddresses(
                    queryClient,
                    [ADDRESS],
                    SCOPE,
                    options,
                )
            })
            await waitFor(() => expect(queryClient.isFetching()).toBe(0))
        }
        const threePages = (): Backend => ({
            head: {
                items: [record('B', JAN_10)],
                next: { cursor: 'c1' },
            },
            c1: {
                items: [record('A', JAN_10 - DAY_MS)],
                next: { cursor: 'c2' },
            },
            c2: { items: [record('Z', JAN_10 - 2 * DAY_MS)] },
        })

        test('makes one backend read, whatever the number of loaded pages', async () => {
            const backend = threePages()
            serve(backend)
            const { result } = mount()
            await loadPages(result, 3)
            mocks.getMinedTransactionHistory.mockClear()

            await invalidate()

            expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(1)
            expect(mocks.getMinedTransactionHistory).toHaveBeenCalledWith(
                ADDRESS,
                SCOPE,
                undefined,
                undefined,
            )
            expect(result.current.records.map(r => r.id)).toEqual([
                'B',
                'A',
                'Z',
            ])
            expect(cached().pageParams).toEqual([
                null,
                { cursor: 'c1' },
                { cursor: 'c2' },
            ])
        })

        test('adds new records ahead and updates loaded ones in place, keeping every page and cursor', async () => {
            mocks.getPendingTransactionRecords.mockResolvedValue([
                pendingSend('SENT', JAN_10 + DAY_MS),
            ])
            const backend: Backend = {
                head: {
                    items: [record('A', JAN_10)],
                    next: { cursor: 'c1' },
                },
                c1: { items: [record('Z', JAN_10 - DAY_MS)] },
            }
            serve(backend)
            const { result } = mount()
            await loadPages(result, 2)
            backend.head = {
                items: [
                    record('NEW', JAN_10 + 2 * DAY_MS),
                    record('SENT', JAN_10 + DAY_MS),
                    record('A', JAN_10),
                    record('OLDER_BEYOND_LOADED', JAN_10 - 3 * DAY_MS),
                ],
                next: { cursor: 'c1' },
            }

            await invalidate()

            expect(result.current.records.map(r => r.id)).toEqual([
                'NEW',
                'SENT',
                'A',
                'Z',
            ])
            expect(
                result.current.records.find(r => r.id === 'SENT')?.status,
            ).toBe('confirmed')
            expect(cached().pageParams).toEqual([null, { cursor: 'c1' }])
            expect(result.current.hasNextPage).toBe(false)
        })

        test('re-reads the loaded pages when the head no longer reaches them', async () => {
            serve(threePages())
            const { result } = mount()
            await loadPages(result, 2)
            mocks.getMinedTransactionHistory.mockClear()
            mocks.getMinedTransactionHistory.mockImplementation(
                async (_address, _scope, page?: { cursor: string }) => {
                    const k = page ? Number(page.cursor.slice(1)) + 1 : 1
                    return {
                        items: [record(`N${k}`, JAN_10 - k * 1000)],
                        next: { cursor: `n${k}` },
                    }
                },
            )

            await invalidate()

            expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(
                MAX_RECORD_PAGE_READS + 1,
            )
            expect(result.current.records.map(r => r.id)).toEqual([
                'N1',
                'N2',
                'N3',
                'N4',
                'N5',
                'N6',
            ])
        })

        test('finds a new match in a filtered list without reading past the head', async () => {
            const backend: Backend = {
                head: {
                    items: [record('ETH1', JAN_10)],
                    next: { cursor: 'r2' },
                },
                r2: {
                    items: [record('USDC_OLD', JAN_10 - DAY_MS, USDC)],
                    next: { cursor: 'c1' },
                },
                c1: {
                    items: [record('USDC_OLDER', JAN_10 - 2 * DAY_MS, USDC)],
                },
            }
            serve(backend)
            const { result } = mount({ assetId: USDC })
            await loadPages(result, 2)
            mocks.getMinedTransactionHistory.mockClear()
            backend.head = {
                items: [
                    record('USDC_NEW', JAN_10 + DAY_MS, USDC),
                    record('ETH1', JAN_10),
                    record('ETH0', JAN_10 - 1000),
                ],
                next: { cursor: 'r2' },
            }

            await invalidate()

            expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(1)
            expect(result.current.records.map(r => r.id)).toEqual([
                'USDC_NEW',
                'USDC_OLD',
                'USDC_OLDER',
            ])
        })

        test('keeps a paused filtered search paused at one backend read', async () => {
            mocks.getMinedTransactionHistory.mockImplementation(
                async (_address, _scope, page?: { cursor: string }) => ({
                    items: [record(`E-${page?.cursor ?? 'c'}`, JAN_10)],
                    next: { cursor: `${page?.cursor ?? 'c'}+` },
                }),
            )
            const { result } = mount({ assetId: USDC })
            await waitFor(() =>
                expect(result.current.isSearchPaused).toBe(true),
            )
            const pageCount = cached().pages.length
            mocks.getMinedTransactionHistory.mockClear()

            await invalidate()

            expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(1)
            expect(cached().pages).toHaveLength(pageCount)
            expect(result.current.isSearchPaused).toBe(true)
        })

        test('re-reads every loaded page when an explicit refresh asks, and only that once', async () => {
            serve(threePages())
            const { result } = mount()
            await loadPages(result, 3)
            mocks.getMinedTransactionHistory.mockClear()

            await invalidate({ shouldRefetchAllPages: true })

            expect(
                mocks.getMinedTransactionHistory.mock.calls.map(
                    call => call[2],
                ),
            ).toEqual([undefined, { cursor: 'c1' }, { cursor: 'c2' }])
            mocks.getMinedTransactionHistory.mockClear()

            await invalidate()

            expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(1)
        })

        test('stays a full re-read when its first attempt fails and the quiet retry runs', async () => {
            const backend = threePages()
            serve(backend)
            const { result } = mount()
            await loadPages(result, 3)
            mocks.getMinedTransactionHistory.mockClear()
            mocks.getMinedTransactionHistory.mockRejectedValueOnce(
                new Error('not ready yet'),
            )

            await invalidate({ shouldRefetchAllPages: true })

            expect(
                mocks.getMinedTransactionHistory.mock.calls.map(
                    call => call[2],
                ),
            ).toEqual([
                undefined,
                undefined,
                { cursor: 'c1' },
                { cursor: 'c2' },
            ])
        })

        test('resumes a full re-read at the page that failed, without re-reading the head', async () => {
            const backend = threePages()
            serve(backend)
            const { result } = mount()
            await loadPages(result, 3)
            mocks.getMinedTransactionHistory.mockClear()
            mocks.getMinedTransactionHistory.mockImplementation(
                async (_address, _scope, page?: { cursor: string }) => {
                    if (page?.cursor === 'c1' && !hasFailedC1) {
                        hasFailedC1 = true
                        throw new Error('not ready yet')
                    }
                    return backend[page?.cursor ?? 'head']
                },
            )
            let hasFailedC1 = false

            await invalidate({ shouldRefetchAllPages: true })

            expect(
                mocks.getMinedTransactionHistory.mock.calls.map(
                    call => call[2],
                ),
            ).toEqual([
                undefined,
                { cursor: 'c1' },
                { cursor: 'c1' },
                { cursor: 'c2' },
            ])
        })

        test('stays a full re-read when an invalidation cancels it part way', async () => {
            const backend = threePages()
            serve(backend)
            const { result } = mount()
            await loadPages(result, 3)
            mocks.getMinedTransactionHistory.mockImplementation(
                async (_address, _scope, page?: { cursor: string }) =>
                    page ? new Promise(() => {}) : backend.head,
            )
            act(() => {
                invalidateTransactionQueriesForAddresses(
                    queryClient,
                    [ADDRESS],
                    SCOPE,
                    { shouldRefetchAllPages: true },
                )
            })
            await waitFor(() =>
                expect(mocks.getMinedTransactionHistory).toHaveBeenCalledWith(
                    ADDRESS,
                    SCOPE,
                    { cursor: 'c1' },
                    undefined,
                ),
            )
            serve(backend)
            mocks.getMinedTransactionHistory.mockClear()

            await invalidate()

            expect(
                mocks.getMinedTransactionHistory.mock.calls.map(
                    call => call[2],
                ),
            ).toEqual([undefined, { cursor: 'c1' }, { cursor: 'c2' }])
        })

        test('keeps reading for the newest id when the first backend page is empty', async () => {
            const backend: Backend = {
                head: { items: [], next: { cursor: 'r2' } },
                r2: {
                    items: [record('B', JAN_10)],
                    next: { cursor: 'c1' },
                },
                c1: { items: [record('A', JAN_10 - DAY_MS)] },
            }
            serve(backend)
            const { result } = mount()
            await loadPages(result, 2)
            mocks.getMinedTransactionHistory.mockClear()

            await invalidate()

            expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(2)
            expect(result.current.records.map(r => r.id)).toEqual(['B', 'A'])
        })

        test('lists the ledger sends offline, then the backend records once it can be read', async () => {
            onlineManager.setOnline(false)
            mocks.getPendingTransactionRecords.mockResolvedValue([
                pendingSend('SENT', JAN_10 + DAY_MS),
            ])
            const { result } = mount()
            await waitFor(() =>
                expect(result.current.records.map(r => r.id)).toEqual(['SENT']),
            )
            serve({
                head: {
                    items: [
                        record('SENT', JAN_10 + DAY_MS),
                        record('A', JAN_10),
                    ],
                    next: { cursor: 'c1' },
                },
            })
            onlineManager.setOnline(true)

            await invalidate()

            await waitFor(() =>
                expect(result.current.records.map(r => r.id)).toEqual([
                    'SENT',
                    'A',
                ]),
            )
            expect(result.current.records[0].status).toBe('confirmed')
            expect(result.current.hasNextPage).toBe(true)
        })
    })

    test('keeps fetchNextPage and refetch stable across renders', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValue({
            items: [record('A', JAN_10)],
        })

        const { result, rerender } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )
        await waitFor(() => expect(result.current.records).toHaveLength(1))
        const { fetchNextPage, refetch } = result.current

        rerender()

        expect(result.current.fetchNextPage).toBe(fetchNextPage)
        expect(result.current.refetch).toBe(refetch)
    })

    test('keeps only records that move the filtered asset', async () => {
        mocks.getMinedTransactionHistory
            .mockResolvedValueOnce({
                items: [record('ETH', JAN_10)],
                next: { cursor: 'c1' },
            })
            .mockResolvedValueOnce({
                items: [
                    record('USDC', JAN_10 - DAY_MS, USDC),
                    record('ETH2', JAN_10 - DAY_MS),
                ],
            })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    assetId: USDC,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['USDC']),
        )
        expect(result.current.hasNextPage).toBe(false)
    })

    test('asks the chain for the filtered asset on every page it reads', async () => {
        mocks.getMinedTransactionHistory
            .mockResolvedValueOnce({ items: [], next: { cursor: 'c1' } })
            .mockResolvedValueOnce({ items: [record('USDC', JAN_10, USDC)] })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    assetId: USDC,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['USDC']),
        )
        expect(mocks.getMinedTransactionHistory.mock.calls).toEqual([
            [ADDRESS, SCOPE, undefined, USDC],
            [ADDRESS, SCOPE, { cursor: 'c1' }, USDC],
        ])
    })

    test('settles on an empty list when the asset has no history', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValueOnce({ items: [] })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    assetId: USDC,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetched).toBe(true))
        expect(result.current.records).toEqual([])
        expect(result.current.hasNextPage).toBe(false)
        expect(result.current.isError).toBe(false)
    })

    test('keeps a call the account paid gas for in the native asset’s History, but not one another address sent', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValueOnce({
            items: [
                gasOnly('OWN'),
                gasOnly('OWN_SIGNED', '0xABC'),
                gasOnly('THEIRS', '0xdef'),
                record('USDC', JAN_10, USDC),
            ],
        })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    assetId: NATIVE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual([
                'OWN',
                'OWN_SIGNED',
            ]),
        )
    })

    test('leaves out of the native asset’s History a token movement the account paid gas for, and a replaced or unsigned failed attempt', async () => {
        const paid = { fee: new Decimal(21_000), initiator: ADDRESS }
        mocks.getMinedTransactionHistory.mockResolvedValueOnce({
            items: [
                { ...record('TOKEN_SEND', JAN_10, USDC), ...paid },
                {
                    ...gasOnly('TOKEN_SWAP', ADDRESS),
                    summary: {
                        kind: 'swap',
                        title: { key: i18nKey('transactions.list_item.swap') },
                        direction: 'none',
                        icon: 'swap',
                        balanceChanges: [
                            {
                                assetRef: {
                                    chainId: 'ethereum',
                                    assetId: USDC,
                                },
                                value: new Decimal(-5),
                            },
                            {
                                assetRef: {
                                    chainId: 'ethereum',
                                    assetId: '0xdai',
                                },
                                value: new Decimal(5),
                            },
                        ],
                    },
                },
                { ...gasOnly('REPLACED'), status: 'replaced' },
                { ...gasOnly('REJECTED'), status: 'failed' },
                { ...gasOnly('REVERTED', ADDRESS), status: 'failed' },
                gasOnly('APPROVE', ADDRESS),
            ],
        })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    assetId: NATIVE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual([
                'REVERTED',
                'APPROVE',
            ]),
        )
    })

    test('leaves a token’s History to the records that move it, whatever gas the account paid', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValueOnce({
            items: [gasOnly('OWN'), record('USDC', JAN_10, USDC)],
        })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    assetId: USDC,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['USDC']),
        )
    })

    test('keeps the date range inclusive and stops paging once it passes its start', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValueOnce({
            items: [
                record('JAN11', JAN_10 + DAY_MS),
                record('JAN10', JAN_10),
                record('JAN9', JAN_10 - DAY_MS),
                record('PENDING', undefined),
            ],
            next: { cursor: 'c1' },
        })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    afterTime: '2026-01-10',
                    beforeTime: '2026-01-10',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual([
                'JAN10',
                'PENDING',
            ]),
        )
        expect(result.current.hasNextPage).toBe(false)
    })

    test('shows only the wallet’s own sends while offline', async () => {
        onlineManager.setOnline(false)
        mocks.getPendingTransactionRecords.mockResolvedValueOnce([
            record('SENT', undefined),
        ])

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['SENT']),
        )
        expect(mocks.getMinedTransactionHistory).not.toHaveBeenCalled()
        expect(result.current.hasNextPage).toBe(false)
    })

    test('keeps the loaded pages and their cursor when a refetch runs offline', async () => {
        mocks.getMinedTransactionHistory
            .mockResolvedValueOnce({
                items: [record('B', JAN_10)],
                next: { cursor: 'c1' },
            })
            .mockResolvedValueOnce({
                items: [record('A', JAN_10 - DAY_MS)],
                next: { cursor: 'c2' },
            })
        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )
        await waitFor(() => expect(result.current.records).toHaveLength(1))
        act(() => result.current.fetchNextPage())
        await waitFor(() => expect(result.current.records).toHaveLength(2))

        onlineManager.setOnline(false)
        act(() => result.current.refetch())

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.records.map(r => r.id)).toEqual(['B', 'A'])
        expect(result.current.hasNextPage).toBe(true)
    })

    test('keeps the next-page cursor when loading more offline', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValueOnce({
            items: [record('B', JAN_10)],
            next: { cursor: 'c1' },
        })
        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )
        await waitFor(() => expect(result.current.records).toHaveLength(1))

        onlineManager.setOnline(false)
        act(() => result.current.fetchNextPage())

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.hasNextPage).toBe(true)
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(1)
    })

    test('reads again once before reporting a failed read', async () => {
        mocks.getMinedTransactionHistory
            .mockRejectedValueOnce(new Error('not ready yet'))
            .mockResolvedValueOnce({ items: [record('A', JAN_10)] })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['A']),
        )
        expect(result.current.isError).toBe(false)
    })

    test('does not read again for a Pera service the network lacks', async () => {
        mocks.getMinedTransactionHistory.mockRejectedValue(
            new PeraServiceUnavailableError(SCOPE),
        )

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(1)
    })

    test('reports a failed read as an error', async () => {
        const failure = new Error('history service refused')
        mocks.getMinedTransactionHistory.mockRejectedValue(failure)

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBe(failure)
        expect(result.current.records).toEqual([])
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(2)
    })

    test('stays idle without an address', () => {
        renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: '',
                    scope: SCOPE,
                }),
            { wrapper },
        )

        expect(mocks.getMinedTransactionHistory).not.toHaveBeenCalled()
    })
})
