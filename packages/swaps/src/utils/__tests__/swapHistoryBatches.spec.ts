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

import { describe, test, expect } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { makeSwapHistoryItem } from '../../__tests__/swapHistoryFixture'
import {
    mergeSwapHistoryPages,
    nextSwapHistoryCursors,
    swapHistoryBatchesOf,
    type SwapHistoryBatchPage,
} from '../swapHistoryBatches'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const row = (orderId: string, createdAt: string) =>
    makeSwapHistoryItem({ orderId, createdAt })

const batchPage = (
    results: ReturnType<typeof row>[],
    next: string | null,
): SwapHistoryBatchPage => ({
    accounts: ['acc'],
    results,
    next,
    oldestCreatedAt: results.at(-1)?.createdAt ?? null,
})

const idsOf = (pages: SwapHistoryBatchPage[][]) =>
    mergeSwapHistoryPages(pages).map(item => item.orderId)

describe('swaps/swapHistoryBatches', () => {
    describe('swapHistoryBatchesOf', () => {
        test('splits accounts into requests of 20, in order', () => {
            const accounts = Array.from({ length: 25 }, (_, index) => ({
                scope: SCOPE,
                address: `ADDRESS${index}`,
            }))

            const batches = swapHistoryBatchesOf(accounts)

            expect(batches.map(batch => batch.accounts.length)).toEqual([20, 5])
            expect(batches[1].accounts[0].address).toBe('ADDRESS20')
        })

        test('never mixes deployments in one batch', () => {
            const batches = swapHistoryBatchesOf([
                { scope: SCOPE, address: 'A' },
                { scope: { ...SCOPE, networkId: 'testnet' }, address: 'B' },
                { scope: SCOPE, address: 'C' },
            ])

            expect(
                batches.map(batch => batch.accounts.map(a => a.address)),
            ).toEqual([['A', 'C'], ['B']])
        })
    })

    describe('nextSwapHistoryCursors', () => {
        test('is undefined once every batch is exhausted', () => {
            expect(
                nextSwapHistoryCursors([
                    batchPage([], null),
                    batchPage([], null),
                ]),
            ).toBeUndefined()
        })

        test('keeps one cursor per batch, null for an exhausted one', () => {
            const done = batchPage([], null)
            const open = { ...batchPage([], 'c2'), accounts: ['other'] }

            expect(nextSwapHistoryCursors([done, open])).toEqual([
                { accounts: ['acc'], cursor: null },
                { accounts: ['other'], cursor: 'c2' },
            ])
        })
    })

    describe('mergeSwapHistoryPages', () => {
        test('keeps the router order of a single batch', () => {
            const pages = [
                [
                    batchPage(
                        [
                            row('a', '2026-10-03T00:00:00Z'),
                            row('b', '2026-10-02T00:00:00Z'),
                        ],
                        null,
                    ),
                ],
            ]

            expect(idsOf(pages)).toEqual(['a', 'b'])
        })

        test('merges two batches newest first', () => {
            const pages = [
                [
                    batchPage(
                        [
                            row('a1', '2026-10-05T00:00:00Z'),
                            row('a2', '2026-10-01T00:00:00Z'),
                        ],
                        null,
                    ),
                    batchPage(
                        [
                            row('b1', '2026-10-04T00:00:00Z'),
                            row('b2', '2026-10-02T00:00:00Z'),
                        ],
                        null,
                    ),
                ],
            ]

            expect(idsOf(pages)).toEqual(['a1', 'b1', 'b2', 'a2'])
        })

        test('holds back rows older than an open batch has loaded until it catches up', () => {
            const first = [
                batchPage(
                    [
                        row('a1', '2026-10-05T00:00:00Z'),
                        row('a2', '2026-10-01T00:00:00Z'),
                    ],
                    null,
                ),
                batchPage(
                    [
                        row('b1', '2026-10-04T00:00:00Z'),
                        row('b2', '2026-10-03T00:00:00Z'),
                    ],
                    'more',
                ),
            ]
            expect(idsOf([first])).toEqual(['a1', 'b1', 'b2'])

            const second = [
                batchPage([], null),
                batchPage([row('b3', '2026-09-30T00:00:00Z')], null),
            ]
            expect(idsOf([first, second])).toEqual([
                'a1',
                'b1',
                'b2',
                'a2',
                'b3',
            ])
        })

        test("carries an open batch's oldest row through a page where it returned nothing", () => {
            const first = [
                batchPage([row('a1', '2026-10-05T00:00:00Z')], 'more'),
                batchPage([row('b1', '2026-10-02T00:00:00Z')], null),
            ]
            const second = [batchPage([], 'more'), batchPage([], null)]

            expect(idsOf([first, second])).toEqual(['a1'])
        })

        test('shows a row once when two batches return the same order', () => {
            const pages = [
                [
                    batchPage([row('same', '2026-10-05T00:00:00Z')], null),
                    batchPage([row('same', '2026-10-05T00:00:00Z')], null),
                ],
            ]

            expect(idsOf(pages)).toEqual(['same'])
        })
    })
})
