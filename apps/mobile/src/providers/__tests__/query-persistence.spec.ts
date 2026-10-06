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
vi.unmock('@perawallet/wallet-core-chain-algorand/blockchain')

import {
    QueryClient,
    dehydrate,
    hydrate,
    type Query,
    type QueryKey,
} from '@tanstack/react-query'
import {
    persistQueryClientRestore,
    type PersistedClient,
    type Persister,
} from '@tanstack/react-query-persist-client'
import { Decimal } from 'decimal.js'
import {
    parseTypedJson,
    stringifyTypedJson,
} from '@perawallet/wallet-core-shared'
import {
    PERSISTED_CACHE_BUSTER,
    shouldDehydrateQuery,
} from '../query-persistence'

const asQuery = (
    queryKey: QueryKey,
    status: 'success' | 'error' | 'pending',
): Query => ({ queryKey, state: { status } }) as unknown as Query

// Keys below are literals (not built via the packages' query-key factories,
// which stay package-internal) whose shapes are pinned by the package-level
// predicate tests in packages/accounts/src/hooks/__tests__/querykeys.spec.ts
// and packages/assets/src/hooks/__tests__/querykeys.spec.ts.
const MAINNET = { chainId: 'algorand', networkId: 'mainnet' }

const balanceHistoryKey: QueryKey = [
    'accounts',
    'balance-history',
    { period: 'one-week', addresses: ['ADDR1'], scope: MAINNET },
]
const priceHistoryKey: QueryKey = [
    'assets',
    'prices',
    'history',
    { assetID: '123', period: 'one-week', scope: MAINNET },
]
const assetPricesKey: QueryKey = [
    'assets',
    'prices',
    'usd',
    { assetIDs: ['123'], scope: MAINNET },
]

const transactionDetailKey: QueryKey = [
    'blockchain',
    'transaction-detail',
    { transactionId: 'TXID123', scope: MAINNET },
]
const groupTransactionsKey: QueryKey = [
    'blockchain',
    'group-transactions',
    { groupId: 'GROUP123', scope: MAINNET },
]
const suggestedParametersKey: QueryKey = [
    'blockchain',
    'suggested-parameters',
    { scope: MAINNET },
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

    it('never persists a prefix the policy does not list', () => {
        expect(
            shouldDehydrateQuery(asQuery(['discover', 'feed'], 'success')),
        ).toBe(false)
    })

    it('persists an allowlisted prefix and skips non-success ones', () => {
        expect(
            shouldDehydrateQuery(asQuery(['currencies', 'list'], 'success')),
        ).toBe(true)
        expect(
            shouldDehydrateQuery(asQuery(['currencies', 'list'], 'pending')),
        ).toBe(false)
    })

    it('persists chain-derived modules and keeps DB-backed and PII ones off disk', () => {
        for (const key of [
            ['nfd', 'address', { address: 'ADDR1' }],
            ['notifications', 'list', { address: 'ADDR1' }],
            ['asa-inbox', 'summary', { address: 'ADDR1' }],
            ['balance-impact-simulation', 'req-1', MAINNET],
        ]) {
            expect(shouldDehydrateQuery(asQuery(key, 'success'))).toBe(true)
        }
        for (const key of [
            ['passkeys', 'list'],
            ['onramp', 'history', { accountAddress: 'ADDR1' }],
            ['swaps', 'history-infinite', { address: 'ADDR1' }],
        ]) {
            expect(shouldDehydrateQuery(asQuery(key, 'success'))).toBe(false)
        }
    })

    it('persists a module catalog sub-key without persisting its address-keyed siblings', () => {
        expect(
            shouldDehydrateQuery(
                asQuery(['swaps', 'providers', { scope: MAINNET }], 'success'),
            ),
        ).toBe(true)
        expect(
            shouldDehydrateQuery(
                asQuery(
                    ['swaps', 'history-infinite', { address: 'AAAA' }],
                    'success',
                ),
            ),
        ).toBe(false)
        expect(
            shouldDehydrateQuery(
                asQuery(['onramp', 'pairs', { scope: MAINNET }], 'success'),
            ),
        ).toBe(true)
        expect(
            shouldDehydrateQuery(
                asQuery(
                    ['onramp', 'history', { accountAddress: 'AAAA' }],
                    'success',
                ),
            ),
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
            { scope: MAINNET, preferredFiatCurrency: 'EUR' },
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
            parseTypedJson(
                stringifyTypedJson(dehydrate(source, { shouldDehydrateQuery })),
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

describe('PERSISTED_CACHE_BUSTER', () => {
    const MAX_AGE = 1000 * 60 * 60

    const persisterHolding = (buster: string, queryKey: QueryKey) => {
        const source = new QueryClient()
        source.setQueryData(queryKey, ['cached'])
        const stored: PersistedClient = {
            timestamp: Date.now(),
            buster,
            clientState: dehydrate(source),
        }
        const persister: Persister = {
            persistClient: vi.fn(),
            restoreClient: vi.fn(async () => stored),
            removeClient: vi.fn(),
        }
        return persister
    }

    const restore = async (persister: Persister) => {
        const queryClient = new QueryClient()
        await persistQueryClientRestore({
            queryClient,
            persister,
            maxAge: MAX_AGE,
            buster: PERSISTED_CACHE_BUSTER,
        })
        return queryClient
    }

    it('discards a cache persisted under the bare-network key shape', async () => {
        const legacyKey: QueryKey = [
            'swaps',
            'providers',
            { network: 'mainnet' },
        ]
        const persister = persisterHolding('prefix-allowlist', legacyKey)

        const restored = await restore(persister)

        expect(restored.getQueryData(legacyKey)).toBeUndefined()
        expect(persister.removeClient).toHaveBeenCalled()
    })

    it('rehydrates a cache persisted under the current buster', async () => {
        const scopedKey: QueryKey = ['swaps', 'providers', { scope: MAINNET }]
        const persister = persisterHolding(PERSISTED_CACHE_BUSTER, scopedKey)

        const restored = await restore(persister)

        expect(restored.getQueryData(scopedKey)).toEqual(['cached'])
        expect(persister.removeClient).not.toHaveBeenCalled()
    })
})
