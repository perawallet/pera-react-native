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

import { describe, it, expect, vi } from 'vitest'

// The global mocks in vitest.setup.ts replace these packages' hooks, not the
// pure key predicates shouldDehydrateQuery composes — this spec needs the
// real predicates, not the hook stubs.
vi.unmock('@perawallet/wallet-core-accounts')
vi.unmock('@perawallet/wallet-core-assets')
vi.unmock('@perawallet/wallet-core-blockchain')

import {
    QueryClient,
    dehydrate,
    hydrate,
    type Query,
    type QueryKey,
} from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import {
    algorandSafeQueryParse,
    algorandSafeQuerySerialize,
} from '@perawallet/wallet-core-blockchain'
import { shouldDehydrateQuery } from '../query-persistence'

const asQuery = (
    queryKey: QueryKey,
    status: 'success' | 'error' | 'pending',
): Query => ({ queryKey, state: { status } }) as unknown as Query

// Keys below are literals (not built via the packages' query-key factories,
// which stay package-internal) whose shapes are pinned by the package-level
// predicate tests added in Tasks 1-2:
// packages/accounts/src/hooks/__tests__/querykeys.test.ts and
// packages/assets/src/hooks/__tests__/querykeys.test.ts.
const balanceHistoryKey: QueryKey = [
    'accounts',
    'balance-history',
    { period: 'one-week', addresses: ['ADDR1'], network: 'mainnet' },
]
const priceHistoryKey: QueryKey = [
    'assets',
    'prices',
    'history',
    { assetID: '123', period: 'one-week', network: 'mainnet' },
]
const assetPricesKey: QueryKey = [
    'assets',
    'prices',
    'usd',
    { assetIDs: ['123'], network: 'mainnet' },
]

const transactionDetailKey: QueryKey = [
    'blockchain',
    'transaction-detail',
    { transactionId: 'TXID123', network: 'mainnet' },
]
const groupTransactionsKey: QueryKey = [
    'blockchain',
    'group-transactions',
    { groupId: 'GROUP123', network: 'mainnet' },
]
const suggestedParametersKey: QueryKey = [
    'blockchain',
    'suggested-parameters',
    { network: 'mainnet' },
]

describe('shouldDehydrateQuery', () => {
    it('persists successful chart-history snapshots (the allowlist)', () => {
        expect(
            shouldDehydrateQuery(asQuery(balanceHistoryKey, 'success')),
        ).toBe(true)
        expect(shouldDehydrateQuery(asQuery(priceHistoryKey, 'success'))).toBe(
            true,
        )
    })

    it('never persists non-success chart-history states', () => {
        expect(shouldDehydrateQuery(asQuery(priceHistoryKey, 'error'))).toBe(
            false,
        )
        expect(shouldDehydrateQuery(asQuery(priceHistoryKey, 'pending'))).toBe(
            false,
        )
    })

    it('keeps excluding DB-backed and PII module queries', () => {
        expect(shouldDehydrateQuery(asQuery(assetPricesKey, 'success'))).toBe(
            false,
        )
        expect(
            shouldDehydrateQuery(
                asQuery(
                    ['accounts', 'balance', { address: 'ADDR1' }],
                    'success',
                ),
            ),
        ).toBe(false)
        expect(
            shouldDehydrateQuery(
                // Per-account asset history is NOT allowlisted (ticket scope).
                asQuery(
                    ['accounts', 'assets', 'balance-history', {}],
                    'success',
                ),
            ),
        ).toBe(false)
        expect(
            shouldDehydrateQuery(asQuery(['transactions', 'list'], 'success')),
        ).toBe(false)
        expect(shouldDehydrateQuery(asQuery(['card', 'kyc'], 'success'))).toBe(
            false,
        )
    })

    it('never persists blockchain-prefixed queries, even successful ones', () => {
        expect(
            shouldDehydrateQuery(asQuery(transactionDetailKey, 'success')),
        ).toBe(false)
        expect(
            shouldDehydrateQuery(asQuery(groupTransactionsKey, 'success')),
        ).toBe(false)
        expect(
            shouldDehydrateQuery(asQuery(suggestedParametersKey, 'success')),
        ).toBe(false)
    })

    it('persists other successful queries and skips non-success ones', () => {
        expect(
            shouldDehydrateQuery(asQuery(['discover', 'feed'], 'success')),
        ).toBe(true)
        expect(
            shouldDehydrateQuery(asQuery(['discover', 'feed'], 'pending')),
        ).toBe(false)
    })
})

describe('persisted Decimal query data', () => {
    // The preferred-currency rate is persisted and transformed in its queryFn,
    // so the Decimal itself crosses the disk boundary. Consumers call Decimal
    // methods on the hydrated value during render, so a string coming back
    // is a cold-start crash for every non-USD user.
    it('survives the dehydrate → serialize → parse → hydrate round trip', () => {
        const currencyPriceKey: QueryKey = [
            'currencies',
            { network: 'mainnet', preferredFiatCurrency: 'EUR' },
        ]
        const source = new QueryClient()
        source.setQueryData(currencyPriceKey, {
            id: 'EUR',
            usdPrice: new Decimal('0.85'),
        })
        expect(
            shouldDehydrateQuery(
                source.getQueryCache().find({ queryKey: currencyPriceKey })!,
            ),
        ).toBe(true)

        const restored = new QueryClient()
        hydrate(
            restored,
            algorandSafeQueryParse(
                algorandSafeQuerySerialize(
                    dehydrate(source, { shouldDehydrateQuery }),
                ),
            ),
        )

        const data = restored.getQueryData<{ usdPrice: Decimal }>(
            currencyPriceKey,
        )
        expect(Decimal.isDecimal(data?.usdPrice)).toBe(true)
        expect(data?.usdPrice.isZero()).toBe(false)
        expect(data?.usdPrice.toString()).toBe('0.85')
    })
})
