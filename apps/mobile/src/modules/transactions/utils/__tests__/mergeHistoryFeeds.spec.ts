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

// @vitest-environment node

import { describe, it, expect, vi } from 'vitest'
import type {
    ChainScope,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type {
    SuspectedPoisoning,
    TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        formatISODate: (date: Date) => date.toISOString().split('T')[0],
        parseRoundTime: (seconds: number) => new Date(seconds * 1000),
    }
})

import {
    mergeHistoryFeeds,
    type HistoryFeedSnapshot,
} from '../mergeHistoryFeeds'
import {
    buildRecordListRows,
    buildTransactionListRows,
    type TransactionListRow,
} from '../transactionListRows'

// 2024-01-01T00:00:00Z in seconds.
const JAN_1 = 1_704_067_200
const HOUR = 3600

const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const BSC: ChainScope = { chainId: 'bsc', networkId: 'mainnet' }

const algoAt = (id: string, seconds: number) =>
    ({ id, roundTime: seconds }) as TransactionHistoryItem
const ethAt = (id: string, seconds?: number) =>
    ({
        id,
        scope: ETHEREUM,
        timestamp: seconds === undefined ? undefined : seconds * 1000,
    }) as TransactionRecord

const feed = (
    scope: ChainScope,
    rows: TransactionListRow[],
    overrides: Partial<HistoryFeedSnapshot> = {},
): HistoryFeedSnapshot => ({
    scope,
    rows,
    isLoading: false,
    isFetched: true,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    isLoadFailed: false,
    isLoadUnavailable: false,
    isLoadIntegrityBlocked: false,
    isRefreshFailed: false,
    isRefreshUnavailable: false,
    hasNextPage: false,
    isSearchPaused: false,
    isRetrying: false,
    isRefreshing: false,
    suspectedPoisoningById: new Map(),
    ...overrides,
})

const entryKeys = (rows: TransactionListRow[]) =>
    rows.filter(row => row.kind !== 'header').map(row => row.key)

describe('mergeHistoryFeeds', () => {
    describe('a cross-chain swap', () => {
        const source = {
            ...ethAt('0xSOURCE', JAN_1 + HOUR),
            swapLeg: { orderId: 'o1', role: 'source' },
        } as TransactionRecord
        const payout = (swapLeg?: TransactionRecord['swapLeg']) =>
            ({
                id: '0xPAYOUT',
                scope: BASE,
                timestamp: (JAN_1 + 2 * HOUR) * 1000,
                ...(swapLeg && { swapLeg }),
            }) as TransactionRecord

        it('lists only its source row once the backend links the payout on the other network', () => {
            const merged = mergeHistoryFeeds([
                feed(ETHEREUM, buildRecordListRows([source])),
                feed(
                    BASE,
                    buildRecordListRows([
                        payout({ orderId: 'o1', role: 'payout' }),
                    ]),
                ),
            ])

            expect(entryKeys(merged.rows)).toEqual(['0xSOURCE'])
        })

        it('drops a payout the backend has not linked yet when the tracked order names its hash', () => {
            const merged = mergeHistoryFeeds(
                [
                    feed(ETHEREUM, buildRecordListRows([ethAt('0xSOURCE')])),
                    feed(BASE, buildRecordListRows([payout()])),
                ],
                new Map([
                    ['0xsource', { orderId: 'o1', role: 'source' }],
                    ['0xpayout', { orderId: 'o1', role: 'payout' }],
                ]),
            )

            expect(entryKeys(merged.rows)).toEqual(['0xSOURCE'])
        })

        it('lists only the swap from a network read for it, without paging or failing on its behalf', () => {
            const merged = mergeHistoryFeeds(
                [
                    feed(BASE, buildRecordListRows([payout()])),
                    feed(
                        ETHEREUM,
                        buildRecordListRows([
                            source,
                            ethAt('0xOTHER', JAN_1 + 3 * HOUR),
                        ]),
                        {
                            onlySwapOrderIds: new Set(['o1']),
                            hasNextPage: true,
                            isError: true,
                            isRefreshFailed: true,
                        },
                    ),
                ],
                new Map([['0xpayout', { orderId: 'o1', role: 'payout' }]]),
            )

            expect(entryKeys(merged.rows)).toEqual(['0xSOURCE'])
            expect(merged.scopeByTransactionId.get('0xSOURCE')).toEqual(
                ETHEREUM,
            )
            expect(merged.hasNextPage).toBe(false)
            expect(merged.failedChainIds).toEqual([])
        })

        it('keeps the payout where its source is not listed', () => {
            const merged = mergeHistoryFeeds([
                feed(
                    BASE,
                    buildRecordListRows([
                        payout({ orderId: 'o1', role: 'payout' }),
                    ]),
                ),
            ])

            expect(entryKeys(merged.rows)).toEqual(['0xPAYOUT'])
        })
    })

    it('interleaves every network newest first, each row naming its network', () => {
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows(
                    [
                        algoAt('algo-new', JAN_1 + 3 * HOUR),
                        algoAt('algo-old', JAN_1 + HOUR),
                    ],
                    ALGORAND,
                ),
            ),
            feed(
                ETHEREUM,
                buildRecordListRows([ethAt('eth', JAN_1 + 2 * HOUR)]),
            ),
        ])

        expect(entryKeys(merged.rows)).toEqual(['algo-new', 'eth', 'algo-old'])
        expect(merged.rows.filter(row => row.kind === 'header')).toHaveLength(1)
        expect(
            merged.rows.flatMap(row =>
                row.kind === 'header'
                    ? []
                    : [
                          row.kind === 'record'
                              ? row.record.scope.chainId
                              : row.scope.chainId,
                      ],
            ),
        ).toEqual(['algorand', 'ethereum', 'algorand'])
        expect(merged.transactionCount).toBe(3)
        expect(merged.hasNextPage).toBe(false)
    })

    it('puts an in-flight record with no timestamp above everything', () => {
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows([algoAt('algo', JAN_1)], ALGORAND),
            ),
            feed(ETHEREUM, buildRecordListRows([ethAt('pending')])),
        ])

        expect(entryKeys(merged.rows)).toEqual(['pending', 'algo'])
    })

    it("hides rows older than a network that still has pages, so its next page can't land above them", () => {
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows(
                    [
                        algoAt('algo-new', JAN_1 + 3 * HOUR),
                        algoAt('algo-old', JAN_1),
                    ],
                    ALGORAND,
                ),
            ),
            feed(
                ETHEREUM,
                buildRecordListRows([ethAt('eth', JAN_1 + 2 * HOUR)]),
                { hasNextPage: true },
            ),
        ])

        expect(entryKeys(merged.rows)).toEqual(['algo-new', 'eth'])
        expect(merged.transactionCount).toBe(2)
        expect(merged.hasNextPage).toBe(true)
        expect(merged.blockingFeeds).toEqual([1])
    })

    it('blocks on the network whose oldest loaded row is newest', () => {
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows([algoAt('algo', JAN_1)], ALGORAND),
                {
                    hasNextPage: true,
                },
            ),
            feed(ETHEREUM, buildRecordListRows([ethAt('eth', JAN_1 + HOUR)]), {
                hasNextPage: true,
            }),
        ])

        expect(entryKeys(merged.rows)).toEqual(['eth'])
        expect(merged.blockingFeeds).toEqual([1])
    })

    it("shows nothing until every network has reported, since one that hasn't could hold the newest rows", () => {
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows([algoAt('algo', JAN_1)], ALGORAND),
            ),
            undefined,
        ])

        expect(merged.rows).toEqual([])
        expect(merged.isFetched).toBe(false)
        expect(merged.hasNextPage).toBe(true)
    })

    it('lets a failed or paused network stop holding the others back', () => {
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows([algoAt('algo', JAN_1)], ALGORAND),
            ),
            feed(ETHEREUM, [], {
                hasNextPage: true,
                isSearchPaused: true,
            }),
            feed({ chainId: 'base', networkId: 'mainnet' }, [], {
                hasNextPage: true,
                isError: true,
                isLoadFailed: true,
            }),
        ])

        expect(entryKeys(merged.rows)).toEqual(['algo'])
        expect(merged.hasNextPage).toBe(false)
        expect(merged.isSearchPaused).toBe(true)
        expect(merged.pausedFeeds).toEqual([1])
        expect(merged.failedFeeds).toEqual([2])
        expect(merged.failedChainIds).toEqual(['base'])
        expect(merged.isLoadFailed).toBe(false)
    })

    it('keeps a network whose later page failed holding the others back, without calling it failed', () => {
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows(
                    [
                        algoAt('algo-new', JAN_1 + 3 * HOUR),
                        algoAt('algo-old', JAN_1),
                    ],
                    ALGORAND,
                ),
            ),
            feed(
                ETHEREUM,
                buildRecordListRows([ethAt('eth', JAN_1 + 2 * HOUR)]),
                { hasNextPage: true, isError: true },
            ),
        ])

        expect(entryKeys(merged.rows)).toEqual(['algo-new', 'eth'])
        expect(merged.blockingFeeds).toEqual([1])
        expect(merged.failedFeeds).toEqual([1])
        expect(merged.failedChainIds).toEqual([])
        expect(merged.isLoadFailed).toBe(false)
    })

    it('fails the load only when every network fails, and calls it unavailable only when every failure is', () => {
        const unavailable = new PeraServiceUnavailableError(ETHEREUM)
        const failure = (isLoadUnavailable: boolean) => ({
            isError: true,
            isLoadFailed: true,
            isLoadUnavailable,
            error: unavailable,
        })

        const allUnavailable = mergeHistoryFeeds([
            feed(ALGORAND, [], failure(true)),
            feed(ETHEREUM, [], failure(true)),
        ])
        const mixed = mergeHistoryFeeds([
            feed(ALGORAND, [], failure(false)),
            feed(ETHEREUM, [], failure(true)),
        ])

        expect(allUnavailable.isLoadFailed).toBe(true)
        expect(allUnavailable.isLoadUnavailable).toBe(true)
        expect(allUnavailable.error).toBe(unavailable)
        expect(mixed.isLoadUnavailable).toBe(false)
    })

    it('names a failed network beside one that loaded empty, without failing the load', () => {
        const merged = mergeHistoryFeeds([
            feed(ALGORAND, []),
            feed(ETHEREUM, [], { isError: true, isLoadFailed: true }),
        ])

        expect(merged.isLoadFailed).toBe(false)
        expect(merged.failedChainIds).toEqual(['ethereum'])
        expect(merged.transactionCount).toBe(0)
        expect(merged.hasNextPage).toBe(false)
        expect(merged.isFetched).toBe(true)
    })

    it('names a network that failed with only its own sends listed, apart from one with no history service', () => {
        const unavailable = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows([algoAt('algo', JAN_1)], ALGORAND),
            ),
            feed(ETHEREUM, buildRecordListRows([ethAt('sent', JAN_1 + HOUR)]), {
                isError: true,
                isRefreshFailed: true,
                isRefreshUnavailable: true,
            }),
        ])
        const retryable = mergeHistoryFeeds([
            feed(ALGORAND, [], { isError: true, isLoadFailed: true }),
            feed(ETHEREUM, buildRecordListRows([ethAt('sent', JAN_1 + HOUR)]), {
                isError: true,
                isRefreshFailed: true,
                isRefreshUnavailable: true,
            }),
        ])

        expect(entryKeys(unavailable.rows)).toEqual(['sent', 'algo'])
        expect(unavailable.isLoadFailed).toBe(false)
        expect(unavailable.failedChainIds).toEqual([])
        expect(unavailable.unavailableChainIds).toEqual(['ethereum'])
        expect(unavailable.isRefreshFailed).toBe(false)
        expect(unavailable.failedFeeds).toEqual([])
        expect(retryable.failedChainIds).toEqual(['algorand'])
        expect(retryable.unavailableChainIds).toEqual(['ethereum'])
        expect(retryable.failedNetworkNames).toHaveLength(1)
        expect(retryable.unavailableNetworkNames).toHaveLength(1)
        expect(retryable.failedFeeds).toEqual([0])
    })

    it('names an unsupported network apart from a failed one and retries only the failed one', () => {
        const merged = mergeHistoryFeeds([
            feed(ETHEREUM, buildRecordListRows([ethAt('eth', JAN_1 + HOUR)])),
            feed(BASE, [], {
                isError: true,
                isLoadFailed: true,
                isLoadUnavailable: true,
            }),
            feed(BSC, [], { isError: true, isLoadFailed: true }),
        ])

        expect(merged.failedChainIds).toEqual(['bsc'])
        expect(merged.unavailableChainIds).toEqual(['base'])
        expect(merged.failedFeeds).toEqual([2])
        expect(merged.isLoadFailed).toBe(false)
    })

    it('keeps a network named as failed while it is retried', () => {
        const merged = mergeHistoryFeeds([
            feed(ETHEREUM, buildRecordListRows([ethAt('eth', JAN_1)])),
            feed(BSC, [], {
                isError: true,
                isLoadFailed: true,
                isRetrying: true,
            }),
        ])

        expect(merged.failedChainIds).toEqual(['bsc'])
        expect(merged.isRetrying).toBe(true)
    })

    it('fails the load when every network failed, naming only the unsupported one apart', () => {
        const merged = mergeHistoryFeeds([
            feed(BASE, [], {
                isError: true,
                isLoadFailed: true,
                isLoadUnavailable: true,
            }),
            feed(BSC, [], { isError: true, isLoadFailed: true }),
        ])

        expect(merged.isLoadFailed).toBe(true)
        expect(merged.isLoadUnavailable).toBe(false)
        expect(merged.failedChainIds).toEqual([])
        expect(merged.unavailableChainIds).toEqual(['base'])
        expect(merged.failedFeeds).toEqual([1])
    })

    it('names nothing when every network is unsupported', () => {
        const unsupported = {
            isError: true,
            isLoadFailed: true,
            isLoadUnavailable: true,
        }
        const merged = mergeHistoryFeeds([
            feed(BASE, [], unsupported),
            feed(BSC, [], unsupported),
        ])

        expect(merged.isLoadUnavailable).toBe(true)
        expect(merged.failedChainIds).toEqual([])
        expect(merged.unavailableChainIds).toEqual([])
        expect(merged.failedFeeds).toEqual([])
    })

    it('names no network when every one failed with nothing loaded', () => {
        const merged = mergeHistoryFeeds([
            feed(ALGORAND, [], { isError: true, isLoadFailed: true }),
            feed(ETHEREUM, [], { isError: true, isLoadFailed: true }),
        ])

        expect(merged.isLoadFailed).toBe(true)
        expect(merged.failedChainIds).toEqual([])
        expect(merged.isRefreshFailed).toBe(false)
    })

    it('does not fail the load while another network has not reported yet', () => {
        const merged = mergeHistoryFeeds([
            feed(ALGORAND, [], { isError: true, isLoadFailed: true }),
            undefined,
        ])

        expect(merged.isLoadFailed).toBe(false)
    })

    it('shows the paused state, not the failure, for a paused network beside a failed one', () => {
        const merged = mergeHistoryFeeds([
            feed(ALGORAND, [], { isError: true, isLoadFailed: true }),
            feed(ETHEREUM, [], { hasNextPage: true, isSearchPaused: true }),
        ])

        expect(merged.isLoadFailed).toBe(false)
        expect(merged.isSearchPaused).toBe(true)
    })

    it("keys each transaction's network and poisoning mark by id", () => {
        const suspected = {
            imitatedAddress: 'X',
        } as unknown as SuspectedPoisoning
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows([algoAt('algo', JAN_1)], ALGORAND),
            ),
            feed(ETHEREUM, buildRecordListRows([ethAt('eth', JAN_1)]), {
                suspectedPoisoningById: new Map([['eth', suspected]]),
            }),
        ])

        expect(merged.scopeByTransactionId.get('algo')).toBe(ALGORAND)
        expect(merged.scopeByTransactionId.get('eth')).toBe(ETHEREUM)
        expect(merged.suspectedPoisoningById.get('eth')).toBe(suspected)
    })
})
