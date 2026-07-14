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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { transformCardTransaction } from '../transformers'
import { TransactionSign, TransactionStatus } from '../../../models'
import type { CardTransactionApiResponse } from '../schema'

const base: CardTransactionApiResponse = {
    id: 'tx_1',
    panLast4: '1234',
    sign: 'DEBIT',
    status: 'CONFIRMED',
    cardId: 'card_1',
    transactionId: 'ext_9',
    merchantNameLocation: 'COFFEE BAR, LISBON',
    merchantType: 'InStore',
    mcc: 5814,
    mccCategory: 'FOOD',
    dateTime: '2026-01-02T10:00:00Z',
    transactionCurrency: 'EUR',
    originalCurrency: 'USD',
    amountInTransactionCurrency: '12.3456789',
    feesInTransactionCurrency: '0.50',
    amountInOriginalCurrency: '10.00',
    feesInOriginalCurrency: '0.40',
    billingConversionRate: '1.2345',
    ecbRate: '1.23',
    fundingSources: [
        {
            id: 'fs_1',
            amount: '5.5',
            fees: '0.1',
            swapFee: '0.01',
            sign: 'DEBIT',
            status: 'CONFIRMED',
            dateTime: '2026-01-02T10:00:01Z',
        },
    ],
}

describe('transformCardTransaction', () => {
    it('wraps every monetary field in Decimal', () => {
        const tx = transformCardTransaction(base)

        expect(tx.amountInTransactionCurrency).toBeInstanceOf(Decimal)
        expect(tx.feesInTransactionCurrency).toBeInstanceOf(Decimal)
        expect(tx.amountInOriginalCurrency).toBeInstanceOf(Decimal)
        expect(tx.feesInOriginalCurrency).toBeInstanceOf(Decimal)
        expect(tx.billingConversionRate).toBeInstanceOf(Decimal)
        expect(tx.ecbRate).toBeInstanceOf(Decimal)
    })

    it('maps the identity + merchant metadata fields', () => {
        const tx = transformCardTransaction(base)

        expect(tx.cardId).toBe('card_1')
        expect(tx.transactionId).toBe('ext_9')
        expect(tx.merchantType).toBe('InStore')
        expect(tx.fundingSources[0].id).toBe('fs_1')
        expect(tx.fundingSources[0].dateTime).toBe('2026-01-02T10:00:01Z')
    })

    it('preserves decimal-string precision with no float drift', () => {
        const tx = transformCardTransaction(base)

        expect(tx.amountInTransactionCurrency.toString()).toBe('12.3456789')
    })

    it('maps missing monetary values to Decimal(0), not NaN', () => {
        const tx = transformCardTransaction({ id: 'tx_2' })

        expect(tx.amountInTransactionCurrency.toString()).toBe('0')
        expect(tx.fundingSources).toEqual([])
    })

    it('maps sign and status, falling back for unknown values', () => {
        expect(transformCardTransaction({ ...base, sign: 'CREDIT' }).sign).toBe(
            TransactionSign.Credit,
        )
        expect(
            transformCardTransaction({ ...base, status: 'REVERTED' }).status,
        ).toBe(TransactionStatus.Reverted)
        expect(transformCardTransaction({ ...base, sign: 'WAT' }).sign).toBe(
            TransactionSign.Debit,
        )
        expect(
            transformCardTransaction({ ...base, status: 'MYSTERY' }).status,
        ).toBe(TransactionStatus.Pending)
    })

    it('transforms nested funding sources with Decimal amounts', () => {
        const tx = transformCardTransaction(base)

        expect(tx.fundingSources[0].amount).toBeInstanceOf(Decimal)
        expect(tx.fundingSources[0].swapFee.toString()).toBe('0.01')
    })

    it('stringifies a numeric mcc', () => {
        expect(transformCardTransaction(base).mcc).toBe('5814')
    })
})
