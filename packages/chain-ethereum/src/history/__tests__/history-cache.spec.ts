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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    deleteTransactionsForAccount,
    historyChainAdapters,
} from '@perawallet/wallet-core-transactions'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { testChainContext } from '../../__tests__/context'
import { createEvmHistoryAdapter } from '../adapter'
import { evmHistoryItem } from '../api/msw-handlers'
import { evmHistoryItemSchema, type EvmHistoryItem } from '../api/schema'
import {
    evmHistoryChainData,
    readStoredEvmHistory,
    storeEvmHistoryPage,
    toEvmHistoryRow,
} from '../history-cache'

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Database }))

vi.mock('@perawallet/wallet-core-database', async importActual => ({
    ...(await importActual<
        typeof import('@perawallet/wallet-core-database')
    >()),
    getDatabase: () => mocks.db,
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME = '0x00000000000000000000000000000000000000aa'
const OTHER_ME = '0x00000000000000000000000000000000000000cc'
const PEER = '0x00000000000000000000000000000000000000bb'
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`

const item = (
    overrides: Parameters<typeof evmHistoryItem>[0] = {},
): EvmHistoryItem => evmHistoryItemSchema.parse(evmHistoryItem(overrides))

const sent = (n: number, blockTime: string) =>
    item({
        hash: hash(n),
        from: ME,
        to: PEER,
        value: '5',
        fee: '21000',
        block_time: blockTime,
    })

describe('evm history cache', () => {
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        mocks.db = result.db
        teardown = result.teardown
        await runMigrations(mocks.db, migrations)
        historyChainAdapters.register(
            createEvmHistoryAdapter(ETHEREUM, testChainContext()),
        )
    })

    afterEach(() => {
        teardown()
        historyChainAdapters.reset()
        vi.restoreAllMocks()
    })

    describe('evmHistoryChainData', () => {
        it('decodes what it encoded', () => {
            const row = toEvmHistoryRow(sent(1, '2026-01-01T00:00:00Z'), ME)!

            const decoded = evmHistoryChainData.decode(
                evmHistoryChainData.encode(row),
            )

            expect(decoded.confirmedRound).toBe(row.confirmedRound)
            expect(decoded.roundTime).toBe(row.roundTime)
            expect(decoded.chainData).toEqual(row.chainData)
        })

        it('throws on a malformed document', () => {
            expect(() => evmHistoryChainData.decode('not json')).toThrow()
            expect(() => evmHistoryChainData.decode('{"evm":{}}')).toThrow()
        })
    })

    describe('toEvmHistoryRow', () => {
        it('keys a withdrawal by its first index', () => {
            const row = toEvmHistoryRow(
                item({
                    kind: 'withdrawal',
                    hash: null,
                    withdrawals: [
                        { index: 77, validator_index: 1, amount: '1' },
                    ],
                }),
                ME,
            )

            expect(row?.id).toBe('withdrawal:77')
        })

        it('skips a row with no id', () => {
            expect(toEvmHistoryRow(item({ hash: null }), ME)).toBeUndefined()
        })

        it('marks a reverted call as failed', () => {
            expect(
                toEvmHistoryRow(item({ status: 'failed' }), ME)?.status,
            ).toBe('failed')
        })

        it('stores a zero fee in the column and keeps the item fee null', () => {
            const row = toEvmHistoryRow(item({ fee: null }), ME)

            expect(row?.fee.toFixed()).toBe('0')
            expect(
                (row?.chainData as { item: EvmHistoryItem }).item.fee,
            ).toBeNull()
        })
    })

    describe('storing and reading', () => {
        it('reads the stored items back, newest first', async () => {
            const older = sent(1, '2026-01-01T10:00:00Z')
            const newer = sent(2, '2026-01-03T10:00:00Z')

            await storeEvmHistoryPage([older, newer], ME, SCOPE)
            const read = await readStoredEvmHistory({
                address: ME,
                scope: SCOPE,
                limit: 10,
            })

            expect(read.map(i => i.hash)).toEqual([hash(2), hash(1)])
        })

        it('keeps only the items inside the inclusive UTC days', async () => {
            await storeEvmHistoryPage(
                [
                    sent(1, '2026-01-01T23:59:59Z'),
                    sent(2, '2026-01-02T00:00:00Z'),
                    sent(3, '2026-01-03T23:59:59Z'),
                    sent(4, '2026-01-04T00:00:00Z'),
                ],
                ME,
                SCOPE,
            )

            const read = await readStoredEvmHistory({
                address: ME,
                scope: SCOPE,
                afterTime: '2026-01-02',
                beforeTime: '2026-01-03',
                limit: 10,
            })

            expect(read.map(i => i.hash)).toEqual([hash(3), hash(2)])
        })

        it('links one stored row to each own address', async () => {
            const transfer = item({ hash: hash(9), from: ME, to: OTHER_ME })

            await storeEvmHistoryPage([transfer], ME, SCOPE)
            await storeEvmHistoryPage([transfer], OTHER_ME, SCOPE)

            for (const address of [ME, OTHER_ME]) {
                const read = await readStoredEvmHistory({
                    address,
                    scope: SCOPE,
                    limit: 10,
                })
                expect(read.map(i => i.hash)).toEqual([hash(9)])
            }
            await deleteTransactionsForAccount({ accountAddress: ME })
            expect(
                (
                    await readStoredEvmHistory({
                        address: OTHER_ME,
                        scope: SCOPE,
                        limit: 10,
                    })
                ).map(i => i.hash),
            ).toEqual([hash(9)])
        })

        it.each([
            ['sender first', [OTHER_ME, ME]],
            ['receiver first', [ME, OTHER_ME]],
        ] as const)(
            'keeps each own account its reading of a shared row, %s',
            async (_name, order) => {
                const views = {
                    [OTHER_ME]: item({
                        hash: hash(9),
                        from: OTHER_ME,
                        to: PEER,
                        value: '5',
                        fee: '21000',
                        method: 'swap',
                        input: '0x12345678',
                        balance_impacts: [
                            {
                                asset_id: 'eip155:1/slip44:60',
                                amount: '-21005',
                            },
                        ],
                    }),
                    [ME]: item({
                        hash: hash(9),
                        balance_impacts: [
                            { asset_id: 'eip155:1/slip44:60', amount: '3' },
                        ],
                    }),
                }
                for (const address of order) {
                    await storeEvmHistoryPage([views[address]], address, SCOPE)
                }

                const [fromSender] = await readStoredEvmHistory({
                    address: OTHER_ME,
                    scope: SCOPE,
                    limit: 10,
                })
                const [fromReceiver] = await readStoredEvmHistory({
                    address: ME,
                    scope: SCOPE,
                    limit: 10,
                })

                expect(fromSender.balance_impacts).toEqual(
                    views[OTHER_ME].balance_impacts,
                )
                expect(fromReceiver.balance_impacts).toEqual(
                    views[ME].balance_impacts,
                )
                for (const read of [fromSender, fromReceiver]) {
                    expect(read).toMatchObject({
                        from: OTHER_ME,
                        to: PEER,
                        value: '5',
                        fee: '21000',
                        method: 'swap',
                        input: '0x12345678',
                    })
                }
            },
        )

        it('resolves when the database throws', async () => {
            vi.spyOn(mocks.db, 'insert').mockImplementation(() => {
                throw new Error('disk full')
            })

            await expect(
                storeEvmHistoryPage(
                    [sent(1, '2026-01-01T00:00:00Z')],
                    ME,
                    SCOPE,
                ),
            ).resolves.toBeUndefined()
        })

        it('is emptied when the account is removed', async () => {
            await storeEvmHistoryPage(
                [sent(1, '2026-01-01T00:00:00Z')],
                ME,
                SCOPE,
            )

            await deleteTransactionsForAccount({ accountAddress: ME })

            expect(
                await readStoredEvmHistory({
                    address: ME,
                    scope: SCOPE,
                    limit: 10,
                }),
            ).toEqual([])
        })
    })
})
