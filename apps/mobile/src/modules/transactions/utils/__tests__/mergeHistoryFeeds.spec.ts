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
    it('interleaves every network newest first, each row naming its network', () => {
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows([
                    algoAt('algo-new', JAN_1 + 3 * HOUR),
                    algoAt('algo-old', JAN_1 + HOUR),
                ]),
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
                row.kind === 'header' ? [] : [row.networkChainId],
            ),
        ).toEqual(['algorand', 'ethereum', 'algorand'])
        expect(merged.transactionCount).toBe(3)
        expect(merged.hasNextPage).toBe(false)
    })

    it('puts an in-flight record with no timestamp above everything', () => {
        const merged = mergeHistoryFeeds([
            feed(ALGORAND, buildTransactionListRows([algoAt('algo', JAN_1)])),
            feed(ETHEREUM, buildRecordListRows([ethAt('pending')])),
        ])

        expect(entryKeys(merged.rows)).toEqual(['pending', 'algo'])
    })

    it("hides rows older than a network that still has pages, so its next page can't land above them", () => {
        const merged = mergeHistoryFeeds([
            feed(
                ALGORAND,
                buildTransactionListRows([
                    algoAt('algo-new', JAN_1 + 3 * HOUR),
                    algoAt('algo-old', JAN_1),
                ]),
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
            feed(ALGORAND, buildTransactionListRows([algoAt('algo', JAN_1)]), {
                hasNextPage: true,
            }),
            feed(ETHEREUM, buildRecordListRows([ethAt('eth', JAN_1 + HOUR)]), {
                hasNextPage: true,
            }),
        ])

        expect(entryKeys(merged.rows)).toEqual(['eth'])
        expect(merged.blockingFeeds).toEqual([1])
    })

    it("shows nothing until every network has reported, since one that hasn't could hold the newest rows", () => {
        const merged = mergeHistoryFeeds([
            feed(ALGORAND, buildTransactionListRows([algoAt('algo', JAN_1)])),
            undefined,
        ])

        expect(merged.rows).toEqual([])
        expect(merged.isFetched).toBe(false)
        expect(merged.hasNextPage).toBe(true)
    })

    it('lets a failed or paused network stop holding the others back', () => {
        const merged = mergeHistoryFeeds([
            feed(ALGORAND, buildTransactionListRows([algoAt('algo', JAN_1)])),
            feed(ETHEREUM, [], {
                hasNextPage: true,
                isSearchPaused: true,
            }),
            feed({ chainId: 'base', networkId: 'mainnet' }, [], {
                hasNextPage: true,
                isError: true,
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

    it('fails the load only when nothing shows, and calls it unavailable only when every failure is', () => {
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

    it("keys each transaction's network and poisoning mark by id", () => {
        const suspected = {
            imitatedAddress: 'X',
        } as unknown as SuspectedPoisoning
        const merged = mergeHistoryFeeds([
            feed(ALGORAND, buildTransactionListRows([algoAt('algo', JAN_1)])),
            feed(ETHEREUM, buildRecordListRows([ethAt('eth', JAN_1)]), {
                suspectedPoisoningById: new Map([['eth', suspected]]),
            }),
        ])

        expect(merged.scopeByTransactionId.get('algo')).toBe(ALGORAND)
        expect(merged.scopeByTransactionId.get('eth')).toBe(ETHEREUM)
        expect(merged.suspectedPoisoningById.get('eth')).toBe(suspected)
    })
})
