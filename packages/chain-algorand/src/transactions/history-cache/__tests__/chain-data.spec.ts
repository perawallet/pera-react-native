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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    getTransactionHistory,
    historyChainAdapters,
    upsertTransactions,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import {
    algorandHistoryDataOf,
    EMPTY_ALGORAND_HISTORY_DATA,
    type AlgorandHistoryData,
} from '../../history-data'
import { algorandHistoryChainData } from '../chain-data'
import {
    flatHistoryItem,
    type FlatHistoryItem,
} from '../../../test-utils/history-item'
import { registerAlgorandHistoryCodec } from './register-history-codec'

const ADDRESS = 'ACCT1'
const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const

const makeTx = (
    overrides: Partial<FlatHistoryItem> = {},
): TransactionHistoryItem =>
    flatHistoryItem({
        id: 'TX',
        txType: 'pay',
        sender: ADDRESS,
        assetSender: null,
        receiver: 'RECEIVER_ADDR',
        confirmedRound: 12345,
        status: 'confirmed',
        roundTime: 1700000000,
        fee: new Decimal(1000),
        groupId: null,
        amount: new Decimal(5000000),
        closeTo: null,
        closeAmount: null,
        applicationId: null,
        innerTransactionCount: null,
        asset: null,
        swapGroupDetail: null,
        interpretedMeaning: null,
        balanceImpacts: [],
        ...overrides,
    })

const swapDetail = {
    assetInId: '0',
    assetInUnitName: 'ALGO',
    assetInDecimals: 6,
    assetOutId: '31566704',
    assetOutUnitName: 'USDC',
    assetOutDecimals: 6,
    amountIn: new Decimal('1000000'),
    amountOut: new Decimal('18446744073709551615'),
}

describe('Algorand history rows in chain_data', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
        registerAlgorandHistoryCodec()
    })

    afterEach(() => {
        teardown()
        historyChainAdapters.reset()
    })

    const write = (items: TransactionHistoryItem[], accountAddress = ADDRESS) =>
        upsertTransactions({ db, items, accountAddress, scope })

    const read = () =>
        getTransactionHistory({ db, accountAddress: ADDRESS, scope })

    // Every other test writes and reads through the same codec, so only a raw
    // read catches a writer that stops storing what existing installs hold.
    const readStored = async (id: string) => {
        const [row] = (await db.all(
            sql`select chain_data from transactions where id = ${id}`,
        )) as Array<[string]>
        return (JSON.parse(row[0]) as { algorand: Record<string, unknown> })
            .algorand
    }

    it('stores each Algorand fact under the algorand entry', async () => {
        await write([
            makeTx({
                id: 'PAY',
                closeTo: 'CLOSE_ADDR',
                closeAmount: new Decimal('50854132929'),
            }),
            makeTx({
                id: 'APPL',
                txType: 'appl',
                amount: null,
                groupId: 'GROUP==',
                applicationId: '1002541853',
                innerTransactionCount: 3,
            }),
            makeTx({
                id: 'SWAP',
                txType: 'appl',
                amount: null,
                swapGroupDetail: swapDetail,
            }),
        ])

        expect(await readStored('PAY')).toMatchObject({
            confirmedRound: 12345,
            roundTime: 1700000000,
            closeTo: 'CLOSE_ADDR',
            closeAmount: '50854132929',
        })
        expect(await readStored('APPL')).toMatchObject({
            applicationId: '1002541853',
            innerTransactionCount: 3,
            groupId: 'GROUP==',
        })
        expect(await readStored('SWAP')).toMatchObject({
            swapGroupDetail: {
                assetInId: '0',
                assetOutId: '31566704',
                amountIn: '1000000',
                amountOut: '18446744073709551615',
            },
        })
    })

    it('returns each Algorand kind exactly as it was written', async () => {
        const written = [
            makeTx({
                id: 'SWAP',
                txType: 'appl',
                roundTime: 1700000004,
                amount: null,
                swapGroupDetail: swapDetail,
            }),
            makeTx({
                id: 'PENDING',
                roundTime: 1700000003,
                confirmedRound: undefined,
                status: 'pending',
            }),
            makeTx({
                id: 'APPL',
                txType: 'appl',
                roundTime: 1700000002,
                amount: null,
                applicationId: '1002541853',
                innerTransactionCount: 3,
                groupId: 'GROUP==',
            }),
            makeTx({
                id: 'AXFER',
                txType: 'axfer',
                roundTime: 1700000001,
                asset: {
                    assetId: '31566704',
                    name: 'USDC',
                    unitName: 'USDC',
                    decimals: 6,
                },
            }),
            makeTx({
                id: 'CLOSE',
                roundTime: 1700000000,
                amount: new Decimal(0),
                closeTo: 'CLOSE_ADDR',
                closeAmount: new Decimal('50854132929'),
            }),
        ]
        await write(written)

        expect(await read()).toEqual(written)
    })

    // A cached swap row can carry no ids, no unit names and no decimals.
    // Nothing can recover the names, but decimals must default to 6: 0 would
    // inflate the amounts by six orders of magnitude.
    it('defaults swap decimals for rows cached without them', async () => {
        await write([
            makeTx({
                swapGroupDetail: {
                    assetInId: null,
                    assetInUnitName: '',
                    assetOutId: null,
                    assetOutUnitName: '',
                    amountIn: new Decimal(1000000),
                    amountOut: new Decimal(5000000),
                } as unknown as AlgorandHistoryData['swapGroupDetail'],
            }),
        ])

        const [item] = await read()

        expect(
            algorandHistoryDataOf(item).swapGroupDetail?.assetInDecimals,
        ).toBe(6)
        expect(
            algorandHistoryDataOf(item).swapGroupDetail?.assetOutDecimals,
        ).toBe(6)
    })

    it('reads every Algorand field as absent from a document with no algorand entry', async () => {
        await write([makeTx({ closeTo: 'CLOSE_ADDR' })])
        await db.run(sql`update transactions set chain_data = '{}'`)

        const [item] = await read()

        expect(item.confirmedRound).toBeUndefined()
        expect(item.roundTime).toBe(0)
        expect(item.chainData).toEqual(EMPTY_ALGORAND_HISTORY_DATA)
    })

    it('reads a document in the shape installs already hold', () => {
        const decoded = algorandHistoryChainData.decode(
            JSON.stringify({
                algorand: {
                    confirmedRound: 12345,
                    roundTime: 1700000000,
                    innerTransactionCount: 3,
                    applicationId: '1002541853',
                    closeTo: 'CLOSE_ADDR',
                    swapGroupDetail: {
                        assetInId: '0',
                        assetInUnitName: 'ALGO',
                        assetInDecimals: 6,
                        assetOutId: '31566704',
                        assetOutUnitName: 'USDC',
                        assetOutDecimals: 6,
                        amountIn: '1000000',
                        amountOut: '18446744073709551615',
                    },
                    groupId: 'GROUP==',
                    closeAmount: '50854132929',
                },
            }),
        )

        expect(decoded).toEqual({
            confirmedRound: 12345,
            roundTime: 1700000000,
            chainData: {
                family: 'algorand',
                innerTransactionCount: 3,
                applicationId: '1002541853',
                closeTo: 'CLOSE_ADDR',
                swapGroupDetail: swapDetail,
                groupId: 'GROUP==',
                closeAmount: new Decimal('50854132929'),
            },
        })
    })

    it('keeps the swept amount when another account re-upserts the shared row without one', async () => {
        await write(
            [
                makeTx({
                    closeTo: 'CLOSE_ADDR',
                    closeAmount: new Decimal('50854132929'),
                }),
            ],
            'SENDER_ACCT',
        )
        await write(
            [makeTx({ closeTo: 'CLOSE_ADDR', closeAmount: null })],
            'RECEIVER_ACCT',
        )

        expect((await readStored('TX')).closeAmount).toBe('50854132929')
    })

    it("lists a swap in each side's asset history", async () => {
        await write([
            makeTx({
                id: 'SWAP',
                txType: 'appl',
                amount: null,
                swapGroupDetail: swapDetail,
            }),
        ])

        for (const assetId of ['0', '31566704']) {
            const items = await getTransactionHistory({
                db,
                accountAddress: ADDRESS,
                scope,
                assetId,
            })
            expect(items.map(item => item.id)).toEqual(['SWAP'])
        }
    })
})
