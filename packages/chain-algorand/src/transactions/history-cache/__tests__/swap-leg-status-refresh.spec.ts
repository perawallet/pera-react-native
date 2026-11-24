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
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    getTransactionHistory,
    historyChainAdapters,
    upsertTransactions,
    type SwapLegResponse,
} from '@perawallet/wallet-core-transactions'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'
import { algorandHistoryDataOf } from '../../history-data'
import { flatHistoryItem } from '../../../test-utils/history-item'
import { algorandXoDepositLeg } from '../../../test-utils/swap-leg'
import { refreshOpenSwapLegs } from '../swap-leg-status-refresh'
import { registerAlgorandHistoryCodec } from './register-history-codec'

const scope = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' } as const

const legRow = (id: string, swapLeg: SwapLegResponse | null) =>
    flatHistoryItem({
        id,
        txType: 'pay',
        sender: 'ACCT1',
        receiver: 'XO_DEPOSIT_ADDR',
        confirmedRound: 12345,
        roundTime: 1700000000,
        fee: new Decimal(1000),
        amount: new Decimal(10000000),
        asset: null,
        interpretedMeaning: null,
        balanceImpacts: [],
        swapLeg,
    })

describe('refreshOpenSwapLegs', () => {
    let db: Database
    let teardown: () => void

    const write = (...items: ReturnType<typeof legRow>[]) =>
        upsertTransactions({ db, items, accountAddress: 'ACCT1', scope })

    const statusOf = async (id: string) => {
        const rows = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope,
        })
        const row = rows.find(candidate => candidate.id === id)
        return row && algorandHistoryDataOf(row).swapLeg?.order.status
    }

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

    it("writes a settled order's status onto its open legs, and asks only about open ones", async () => {
        await write(
            legRow('OPEN', algorandXoDepositLeg({ order_id: 'A' })),
            legRow(
                'DONE',
                algorandXoDepositLeg({ order_id: 'B', status: 'completed' }),
            ),
            legRow('PLAIN', null),
        )
        const fetchOrderStatus = vi.fn().mockResolvedValue('completed')

        await refreshOpenSwapLegs({
            db,
            scope,
            accountAddress: 'ACCT1',
            fetchOrderStatus,
        })

        expect(fetchOrderStatus).toHaveBeenCalledTimes(1)
        expect(fetchOrderStatus).toHaveBeenCalledWith('A', scope)
        expect(await statusOf('OPEN')).toBe('completed')
        expect(await statusOf('DONE')).toBe('completed')
    })

    it('leaves a leg whose order is still open for the next pass', async () => {
        await write(legRow('OPEN', algorandXoDepositLeg({ status: 'pending' })))

        await refreshOpenSwapLegs({
            db,
            scope,
            accountAddress: 'ACCT1',
            fetchOrderStatus: vi.fn().mockResolvedValue('in_progress'),
        })

        expect(await statusOf('OPEN')).toBe('pending')
    })

    it('keeps going past an order it fails to read, and never throws', async () => {
        await write(
            legRow('FAILS', algorandXoDepositLeg({ order_id: 'A' })),
            legRow('SETTLES', algorandXoDepositLeg({ order_id: 'B' })),
        )
        const fetchOrderStatus = vi.fn((orderId: string) =>
            orderId === 'A'
                ? Promise.reject(new Error('offline'))
                : Promise.resolve('refunded'),
        )

        await refreshOpenSwapLegs({
            db,
            scope,
            accountAddress: 'ACCT1',
            fetchOrderStatus,
        })

        expect(await statusOf('FAILS')).toBe('in_progress')
        expect(await statusOf('SETTLES')).toBe('refunded')
    })
})
