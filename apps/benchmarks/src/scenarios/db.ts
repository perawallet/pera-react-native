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

import { Decimal } from 'decimal.js'
import {
    getAccountCollectiblesLite,
    getAccountHoldingsLite,
    getAccountHoldingsPage,
    getAccountPortfolioTotals,
    getAllHeldAssetIdsForNetwork,
    refreshAccountHoldings,
} from '@perawallet/wallet-core-accounts'
import { getStaleOrMissingPriceAssetIds } from '@perawallet/wallet-core-assets'
import { getTransactionHistory } from '@perawallet/wallet-core-transactions'
import type { Scenario } from '../runner/types'
import { seeded, type SeededState } from './seeded'

const ALL_SCALES = ['S', 'M', 'L', 'XL'] as const
const PAGE_SIZE = 100
const PRICE_TTL_MS = 30_000

type Query = (state: SeededState) => Promise<unknown>

const read = (
    id: string,
    title: string,
    query: Query,
    withHistory = false,
): Scenario<SeededState> => ({
    id,
    group: 'db',
    title,
    scales: ALL_SCALES,
    setup: seeded({ withHistory }),
    run: async state => {
        await query(state)
    },
})

const sourcesOf = ({ wallet, scope }: SeededState) => [
    { address: wallet.heavyAddress, scope },
]

type Holdings = { assetId: string; amount: Decimal }[]

type WriteState = SeededState & {
    /** Two full sets whose amounts all differ from each other and from the seed. */
    sets: [Holdings, Holdings]
    round: number
}

// Neither is 1 (a seeded collectible) or a multiple of 1000 (any other seeded
// holding), so the first write changes every row, and so does each swap.
const AMOUNT_A = new Decimal(7)
const AMOUNT_B = new Decimal(8)

const holdingsWrite: Scenario<WriteState> = {
    id: 'db.holdings-write',
    group: 'db',
    title: 'Rewrite every holding of the heavy account (all amounts changed)',
    scales: ALL_SCALES,
    setup: async (ctx, scale) => {
        const state = await seeded()(ctx, scale)
        const setOf = (amount: Decimal): Holdings =>
            state.wallet.heldAssetIds.map(assetId => ({ assetId, amount }))
        return { ...state, sets: [setOf(AMOUNT_A), setOf(AMOUNT_B)], round: 0 }
    },
    run: async state => {
        state.round += 1
        await refreshAccountHoldings({
            accountAddress: state.wallet.heavyAddress,
            holdings: state.sets[state.round % 2],
            scope: state.scope,
        })
    },
}

export const dbScenarios: Scenario[] = [
    read(
        'db.holdings-page',
        'First page of the heavy account holdings',
        state =>
            getAccountHoldingsPage({
                accountAddress: state.wallet.heavyAddress,
                scope: state.scope,
                limit: PAGE_SIZE,
                offset: 0,
            }),
    ),
    read('db.holdings-lite', 'Every holding of the heavy account', state =>
        getAccountHoldingsLite({ sources: sourcesOf(state) }),
    ),
    read('db.holdings-search', 'Search the heavy account holdings', state =>
        getAccountHoldingsLite({
            sources: sourcesOf(state),
            search: 'Asset 1',
        }),
    ),
    read(
        'db.collectibles-lite',
        'Every collectible of the heavy account',
        state => getAccountCollectiblesLite({ sources: sourcesOf(state) }),
    ),
    read(
        'db.portfolio-totals',
        'Portfolio totals for every account',
        ({ wallet, scope }) =>
            Promise.all(
                wallet.accounts.map(account =>
                    getAccountPortfolioTotals({
                        accountAddress: account.chains.algorand?.address ?? '',
                        scope,
                    }),
                ),
            ),
    ),
    read(
        'db.held-asset-ids',
        'Every held asset id on the network',
        ({ scope }) => getAllHeldAssetIdsForNetwork({ scope }),
    ),
    read(
        'db.stale-price-ids',
        'Which held assets need a price fetch',
        ({ wallet, scope }) =>
            getStaleOrMissingPriceAssetIds({
                assetIds: wallet.heldAssetIds,
                scope,
                ttlMs: PRICE_TTL_MS,
            }),
    ),
    read(
        'db.history-page',
        'First page of the heavy account history',
        state =>
            getTransactionHistory({
                accountAddress: state.wallet.heavyAddress,
                scope: state.scope,
                limit: 25,
            }),
        true,
    ),
    holdingsWrite as Scenario,
]
