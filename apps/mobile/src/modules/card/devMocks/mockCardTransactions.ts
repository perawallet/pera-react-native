/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// TODO(card): dev/test-only mock data. Remove once the Baanx transactions
// sandbox returns real data. Shape mirrors GET /v1/card/transactions (decimal
// strings, `merchantNameLocation`, `null` for an absent merchant); it is
// validated at runtime by `cardTransactionsListResponseSchema`.

type MockFundingSource = {
    id?: string
    address?: string
    network?: string
    currency?: string
    txHash?: string
    sign?: string
    status?: string
    amount?: string
    fees?: string
    swapFee?: string
    dateTime?: string
}

/**
 * A raw Baanx card-transaction row. Assignable to the package's
 * `CardTransactionApiResponse`; every field is runtime-checked by the schema.
 */
export type MockCardTransaction = {
    id: string
    cardId?: string
    transactionId?: string
    panLast4?: string
    sign?: string
    status?: string
    merchantNameLocation?: string | null
    merchantType?: string
    mcc?: string | number
    mccCategory?: string
    declineReason?: string
    dateTime?: string
    transactionCurrency?: string
    originalCurrency?: string
    amountInTransactionCurrency?: string
    feesInTransactionCurrency?: string
    amountInOriginalCurrency?: string
    feesInOriginalCurrency?: string
    billingConversionRate?: string
    ecbRate?: string
    fundingSources?: MockFundingSource[]
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const isoAgo = (now: number, offsetMs: number): string =>
    new Date(now - offsetMs).toISOString()

/**
 * A spread of mock card transactions across two months, exercising each row
 * kind (payment, refund, deposit) and status (confirmed, pending, declined).
 * Dates are relative to `now` so the relative-date labels stay sensible.
 */
export const buildMockCardTransactions = (
    now: number = Date.now(),
): MockCardTransaction[] => [
    {
        id: 'tx_payment_sesame',
        cardId: 'card_dev',
        transactionId: 'auth_1001',
        panLast4: '4242',
        sign: 'DEBIT',
        status: 'CONFIRMED',
        merchantNameLocation: 'Sesame Street Cafe',
        merchantType: 'InStore',
        mcc: '5812',
        mccCategory: 'Food & Drink',
        dateTime: isoAgo(now, 3 * HOUR),
        transactionCurrency: 'USDC',
        originalCurrency: 'USDC',
        amountInTransactionCurrency: '500',
        feesInTransactionCurrency: '0',
        amountInOriginalCurrency: '500',
        feesInOriginalCurrency: '0',
        billingConversionRate: '1',
        ecbRate: '1',
    },
    {
        id: 'tx_refund_moretti',
        cardId: 'card_dev',
        transactionId: 'auth_1002',
        panLast4: '4242',
        sign: 'CREDIT',
        status: 'PENDING',
        merchantNameLocation: 'Moretti Restaurant',
        merchantType: 'InStore',
        mcc: '5812',
        mccCategory: 'Food & Drink',
        dateTime: isoAgo(now, DAY + 2 * HOUR),
        transactionCurrency: 'USDC',
        originalCurrency: 'USDC',
        amountInTransactionCurrency: '200',
        feesInTransactionCurrency: '0',
        amountInOriginalCurrency: '200',
        feesInOriginalCurrency: '0',
        billingConversionRate: '1',
        ecbRate: '1',
    },
    {
        id: 'tx_payment_uber',
        cardId: 'card_dev',
        transactionId: 'auth_1003',
        panLast4: '4242',
        sign: 'DEBIT',
        status: 'DECLINED',
        merchantNameLocation: 'Uber',
        merchantType: 'Ecommerce',
        mcc: '4121',
        mccCategory: 'Travel',
        declineReason: 'INSUFFICIENT_FUNDS',
        dateTime: isoAgo(now, 2 * DAY),
        transactionCurrency: 'USDC',
        originalCurrency: 'USDC',
        amountInTransactionCurrency: '42.50',
        feesInTransactionCurrency: '0',
        amountInOriginalCurrency: '42.50',
        feesInOriginalCurrency: '0',
        billingConversionRate: '1',
        ecbRate: '1',
    },
    {
        id: 'tx_deposit_1',
        cardId: 'card_dev',
        transactionId: 'topup_2001',
        panLast4: '4242',
        sign: 'CREDIT',
        status: 'CONFIRMED',
        merchantNameLocation: null,
        dateTime: isoAgo(now, 15 * DAY),
        transactionCurrency: 'USDC',
        originalCurrency: 'USDC',
        amountInTransactionCurrency: '160',
        feesInTransactionCurrency: '0',
        amountInOriginalCurrency: '160',
        feesInOriginalCurrency: '0',
        billingConversionRate: '1',
        ecbRate: '1',
        fundingSources: [
            {
                id: 'fs_2001',
                address: 'PERA…DEV',
                network: 'algorand',
                currency: 'USDC',
                txHash: 'DEVTXHASH',
                sign: 'CREDIT',
                status: 'CONFIRMED',
                amount: '160',
                fees: '0',
                swapFee: '0',
                dateTime: isoAgo(now, 15 * DAY),
            },
        ],
    },
    {
        id: 'tx_payment_bluebottle',
        cardId: 'card_dev',
        transactionId: 'auth_1004',
        panLast4: '4242',
        sign: 'DEBIT',
        status: 'CONFIRMED',
        merchantNameLocation: 'Blue Bottle Coffee',
        merchantType: 'InStore',
        mcc: '5814',
        mccCategory: 'Food & Drink',
        dateTime: isoAgo(now, 38 * DAY),
        transactionCurrency: 'USDC',
        originalCurrency: 'USDC',
        amountInTransactionCurrency: '8.50',
        feesInTransactionCurrency: '0',
        amountInOriginalCurrency: '8.50',
        feesInOriginalCurrency: '0',
        billingConversionRate: '1',
        ecbRate: '1',
    },
    {
        id: 'tx_refund_patagonia',
        cardId: 'card_dev',
        transactionId: 'auth_1005',
        panLast4: '4242',
        sign: 'CREDIT',
        status: 'CONFIRMED',
        merchantNameLocation: 'Patagonia',
        merchantType: 'Ecommerce',
        mcc: '5651',
        mccCategory: 'Shopping',
        dateTime: isoAgo(now, 45 * DAY),
        transactionCurrency: 'USDC',
        originalCurrency: 'USDC',
        amountInTransactionCurrency: '65',
        feesInTransactionCurrency: '0',
        amountInOriginalCurrency: '65',
        feesInOriginalCurrency: '0',
        billingConversionRate: '1',
        ecbRate: '1',
    },
]
