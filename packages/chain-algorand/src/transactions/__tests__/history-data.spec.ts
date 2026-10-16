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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    algorandGroupToOpen,
    algorandHistoryDataOf,
    EMPTY_ALGORAND_HISTORY_DATA,
    type AlgorandHistoryData,
} from '../history-data'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

const swapDetail = {
    assetInId: '0',
    assetInUnitName: 'ALGO',
    assetInDecimals: 6,
    assetOutId: '31566704',
    assetOutUnitName: 'USDC',
    assetOutDecimals: 6,
    amountIn: new Decimal(1_000_000),
    amountOut: new Decimal(2_000_000),
}

const rowWith = (chainData: unknown) =>
    ({ id: 'TX', chainData }) as TransactionHistoryItem

const data = (
    overrides: Partial<AlgorandHistoryData>,
): AlgorandHistoryData => ({
    ...EMPTY_ALGORAND_HISTORY_DATA,
    ...overrides,
})

describe('algorandHistoryDataOf', () => {
    it('returns the member of a row that carries Algorand data', () => {
        const member = data({ groupId: 'GROUP==', closeTo: 'CLOSE_ADDR' })

        expect(algorandHistoryDataOf(rowWith(member))).toBe(member)
    })

    it.each([
        ['no chain data', null],
        ['a non-object', 'algorand'],
        ['another chain family', { family: 'ethereum', groupId: 'GROUP==' }],
    ])('reads %s as empty Algorand data', (_name, chainData) => {
        expect(algorandHistoryDataOf(rowWith(chainData))).toBe(
            EMPTY_ALGORAND_HISTORY_DATA,
        )
    })
})

describe('algorandGroupToOpen', () => {
    it('names the group of a swap row', () => {
        const row = rowWith(
            data({ groupId: 'GROUP==', swapGroupDetail: swapDetail }),
        )

        expect(algorandGroupToOpen(row)).toBe('GROUP==')
    })

    it.each([
        ['a grouped row that is not a swap', data({ groupId: 'GROUP==' })],
        ['a swap row with no group', data({ swapGroupDetail: swapDetail })],
        ['a row with no chain data', null],
    ])('opens the row itself for %s', (_name, chainData) => {
        expect(algorandGroupToOpen(rowWith(chainData))).toBeNull()
    })
})
