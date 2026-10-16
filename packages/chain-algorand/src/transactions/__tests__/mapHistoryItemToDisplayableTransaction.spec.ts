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

import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

// Faithful reimplementation of toBigInt — the real module pulls in
// react-native-mmkv, which cannot load in the node test environment.

import {
    EMPTY_ALGORAND_HISTORY_DATA,
    type AlgorandHistoryData,
} from '../history-data'
import { mapHistoryItemToDisplayableTransaction } from '../mapHistoryItemToDisplayableTransaction'

const baseItem: TransactionHistoryItem = {
    id: 'TX123',
    txType: 'pay',
    sender: 'SENDER_ADDR',
    assetSender: null,
    receiver: 'RECEIVER_ADDR',
    confirmedRound: 41065416,
    roundTime: 1752576000,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount: new Decimal(2500000),
    asset: null,
    balanceImpacts: [],
    chainData: EMPTY_ALGORAND_HISTORY_DATA,
}

const withData = (
    data: Partial<AlgorandHistoryData>,
    overrides: Partial<TransactionHistoryItem> = {},
): TransactionHistoryItem => ({
    ...baseItem,
    ...overrides,
    chainData: { ...EMPTY_ALGORAND_HISTORY_DATA, ...data },
})

describe('mapHistoryItemToDisplayableTransaction', () => {
    it('carries closeAmount into the displayable payment leg', () => {
        const result = mapHistoryItemToDisplayableTransaction(
            withData(
                {
                    closeTo: 'CLOSE_ADDR',
                    closeAmount: new Decimal('50854132929'),
                },
                { amount: new Decimal(0) },
            ),
        )

        expect(result?.paymentTransaction).toEqual({
            amount: 0n,
            receiver: 'RECEIVER_ADDR',
            closeRemainderTo: 'CLOSE_ADDR',
            closeAmount: 50854132929n,
        })
    })

    it('leaves the round unset for a transaction not yet in a block', () => {
        const result = mapHistoryItemToDisplayableTransaction({
            ...baseItem,
            confirmedRound: undefined,
        })

        expect(result?.confirmedRound).toBeUndefined()
    })

    it('carries closeAmount into the displayable asset-transfer leg', () => {
        const result = mapHistoryItemToDisplayableTransaction(
            withData(
                { closeTo: 'CLOSE_ADDR', closeAmount: new Decimal('250000') },
                {
                    txType: 'axfer',
                    amount: new Decimal(0),
                    asset: {
                        assetId: '31566704',
                        name: 'USD Coin',
                        unitName: 'USDC',
                        decimals: 6,
                    },
                },
            ),
        )

        expect(result?.assetTransferTransaction).toMatchObject({
            closeTo: 'CLOSE_ADDR',
            closeAmount: 250000n,
        })
    })

    it('maps a payment row to a displayable payment transaction', () => {
        const result = mapHistoryItemToDisplayableTransaction(baseItem)

        expect(result).not.toBeNull()
        expect(result?.id).toBe('TX123')
        expect(result?.txType).toBe('pay')
        expect(result?.sender).toBe('SENDER_ADDR')
        expect(result?.fee).toBe(1000n)
        expect(result?.confirmedRound).toBe(41065416n)
        expect(result?.roundTime).toBe(1752576000)
        expect(result?.roundTimeMillis).toBe(1752576000000)
        expect(result?.paymentTransaction).toEqual({
            amount: 2500000n,
            receiver: 'RECEIVER_ADDR',
            closeRemainderTo: undefined,
        })
    })

    it('maps payment closeTo and null amount defensively', () => {
        const result = mapHistoryItemToDisplayableTransaction(
            withData({ closeTo: 'CLOSE_ADDR' }, { amount: null }),
        )

        expect(result?.paymentTransaction).toEqual({
            amount: 0n,
            receiver: 'RECEIVER_ADDR',
            closeRemainderTo: 'CLOSE_ADDR',
        })
    })

    it('maps an asset transfer row using the stored asset summary', () => {
        const result = mapHistoryItemToDisplayableTransaction({
            ...baseItem,
            txType: 'axfer',
            amount: new Decimal(150),
            asset: {
                assetId: '31566704',
                name: 'USDC',
                unitName: 'USDC',
                decimals: 6,
            },
        })

        expect(result?.assetTransferTransaction).toEqual({
            assetId: 31566704n,
            amount: 150n,
            receiver: 'RECEIVER_ADDR',
            closeTo: undefined,
            sender: undefined,
        })
    })

    it('carries the clawback authority through as the asset sender', () => {
        const result = mapHistoryItemToDisplayableTransaction({
            ...baseItem,
            txType: 'axfer',
            assetSender: 'DRAINED_ADDR',
            asset: {
                assetId: '31566704',
                name: 'USDC',
                unitName: 'USDC',
                decimals: 6,
            },
        })

        expect(result?.assetTransferTransaction?.sender).toBe('DRAINED_ADDR')
    })

    it('returns null for an axfer row without a stored asset summary', () => {
        const result = mapHistoryItemToDisplayableTransaction({
            ...baseItem,
            txType: 'axfer',
            asset: null,
        })

        expect(result).toBeNull()
    })

    it('maps an app call row with its application id', () => {
        const result = mapHistoryItemToDisplayableTransaction(
            withData(
                { applicationId: '1002541853' },
                { txType: 'appl', amount: null, receiver: null },
            ),
        )

        expect(result?.applicationTransaction?.applicationId).toBe(1002541853n)
        expect(result?.applicationTransaction?.onCompletion).toBeUndefined()
        expect(result?.innerTxns).toBeUndefined()
        expect(result?.innerTransactionCount).toBeUndefined()
    })

    it('threads the stored inner transaction count for app calls', () => {
        const result = mapHistoryItemToDisplayableTransaction(
            withData(
                { applicationId: '1002541853', innerTransactionCount: 3 },
                { txType: 'appl' },
            ),
        )

        expect(result?.innerTransactionCount).toBe(3)
        expect(result?.innerTxns).toBeUndefined()
    })

    it('defaults a missing application id to 0 (app creation)', () => {
        const result = mapHistoryItemToDisplayableTransaction(
            withData({ applicationId: null }, { txType: 'appl' }),
        )

        expect(result?.applicationTransaction?.applicationId).toBe(0n)
    })

    it.each(['acfg', 'afrz', 'keyreg', 'hb'] as const)(
        'returns null for %s rows (sub-struct data not stored locally)',
        txType => {
            const result = mapHistoryItemToDisplayableTransaction({
                ...baseItem,
                txType,
            })

            expect(result).toBeNull()
        },
    )
})
