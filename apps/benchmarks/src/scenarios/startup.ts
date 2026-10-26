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

import {
    getAccountHoldingsPage,
    getAllAccountChainStateRows,
    hydrateAccountChainStates,
    rehydrateAccountsStore,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    deleteDatabase,
    initializeDatabase,
    resetDatabase,
} from '@perawallet/wallet-core-database'
import {
    parseTypedJson,
    stringifyTypedJson,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { runBenchBootstrap } from '../bootstrapSteps'
import type { BenchScale, Scenario, ScenarioContext } from '../runner/types'
import { seeded, type SeededState } from './seeded'

const ALL_SCALES = ['S', 'M', 'L', 'XL'] as const

// A payload shaped like a persisted React Query cache with one entry per
// account. It is built here, not by the app's persister, so what is timed is
// parseTypedJson on a payload of this size.
const PERSISTED_QUERY_STATE = {
    dataUpdateCount: 1,
    dataUpdatedAt: 0,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: false,
    status: 'success',
    fetchStatus: 'idle',
}

const QUERY_CACHE_ROWS_PER_ENTRY = 200

// The name packages/database opens; it keeps the constant private.
const DATABASE_NAME = 'pera.db'

/** Hydrating an empty chain-state table would time a no-op at every scale. */
const seededWithChainState = async (
    ctx: ScenarioContext,
    scale: BenchScale,
): Promise<SeededState> => {
    const state = await seeded()(ctx, scale)
    const rows = await getAllAccountChainStateRows()
    if (rows.length < scale.accounts) {
        throw new Error(
            `Seeded ${rows.length} chain-state rows for ${scale.accounts} accounts: hydrate would read nothing`,
        )
    }
    return state
}

const databaseInit: Scenario<void> = {
    id: 'startup.database-init',
    group: 'startup',
    title: 'Delete, reopen and migrate the database from scratch',
    scales: ['S'],
    setup: async () => {},
    run: async () => {
        const { database } = getProvider()
        await deleteDatabase(database)
        await initializeDatabase(database)
    },
}

const accountsRehydrate: Scenario<SeededState> = {
    id: 'startup.accounts-rehydrate',
    group: 'startup',
    title: 'Rehydrate the accounts store from storage',
    scales: ALL_SCALES,
    setup: async (ctx, scale) => {
        const state = await seeded()(ctx, scale)
        // A write still in flight would leave the rehydrate reading nothing,
        // and the run would time an empty wallet.
        await rehydrateAccountsStore()
        if (useAccountsStore.getState().accounts.length !== scale.accounts) {
            throw new Error('The accounts were not persisted before the run')
        }
        return state
    },
    run: () => rehydrateAccountsStore(),
}

const chainStateHydrate: Scenario<SeededState> = {
    id: 'startup.chain-state-hydrate',
    group: 'startup',
    title: 'Hydrate every account chain state from the database',
    scales: ALL_SCALES,
    setup: seededWithChainState,
    run: () => hydrateAccountChainStates(),
}

const queryCacheRestore: Scenario<{ persisted: string }> = {
    id: 'startup.query-cache-restore',
    group: 'startup',
    title: 'parseTypedJson on a cache-shaped payload with an entry per account',
    scales: ALL_SCALES,
    setup: async (ctx, scale) => {
        const { wallet, scope } = await seeded()(ctx, scale)
        const rows = await getAccountHoldingsPage({
            accountAddress: wallet.heavyAddress,
            scope,
            limit: QUERY_CACHE_ROWS_PER_ENTRY,
        })
        return {
            persisted: stringifyTypedJson({
                timestamp: 0,
                buster: '',
                clientState: {
                    mutations: [],
                    queries: wallet.accounts.map(account => ({
                        queryKey: ['bench-holdings', account.id],
                        queryHash: `["bench-holdings","${account.id}"]`,
                        state: { ...PERSISTED_QUERY_STATE, data: rows },
                    })),
                },
            }),
        }
    },
    run: async ({ persisted }) => {
        parseTypedJson(persisted)
    },
}

const bootstrap: Scenario<SeededState> = {
    id: 'startup.bootstrap',
    group: 'startup',
    title: 'The bootstrap sequence from a closed database, over a wallet already on the device',
    scales: ALL_SCALES,
    setup: seededWithChainState,
    run: async () => {
        // The platform service keeps an opened database cached, so without
        // this the run would skip the open that a real launch pays for.
        await getProvider().database.close(DATABASE_NAME)
        resetDatabase()
        await runBenchBootstrap()
    },
}

export const startupScenarios: Scenario[] = [
    databaseInit,
    accountsRehydrate,
    chainStateHydrate,
    queryCacheRestore,
    bootstrap,
]
