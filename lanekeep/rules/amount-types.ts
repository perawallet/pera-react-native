/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import noRestrictedTypes from 'lanekeep/no-restricted-types'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

// Case-sensitive, `*`-only patterns: an exact lowercase name plus a camelCase
// suffix, so `feedback` and `amountLabel` stay out.
const NAMES = [
    'amount',
    'amounts',
    '*Amount',
    '*Amounts',
    'balance',
    'balances',
    '*Balance',
    '*Balances',
    'price',
    'prices',
    '*Price',
    '*Prices',
    'fee',
    'fees',
    '*Fee',
    '*Fees',
]

export default {
    ...noRestrictedTypes({
        conventions: [
            {
                names: NAMES,
                forbid: ['number', 'string'],
                reason: 'Amounts, balances, prices and fees are Decimal: a number loses precision past 2^53, and a string does arithmetic by concatenation.',
            },
        ],
    }),
    id: 'pera/amount-types',
    // Existing string amounts in the onramp form, card withdrawal and a few
    // display props need a typed migration of their own before this can block.
    severity: 'warn',
    gates: productionSource({
        pathNotMatches: [
            ...TEST_SUPPORT,
            // Indexer JSON wire shapes (the schema and the raw-transaction subset
            // balance-impacts reads): amounts arrive as number, string or bigint.
            'packages/transactions/src/api/history/indexer/{schema,balance-impacts}.ts',
            // The boundary helpers themselves: they accept every raw shape they convert.
            '**/shared/src/utils/unit-conversion.ts',
        ],
    }),
}
