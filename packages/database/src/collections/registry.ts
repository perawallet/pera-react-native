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

import {
    MemoryAdapter,
    MmkvAdapter,
    type MmkvLike,
    type PersistentAdapter,
} from './adapter'
import { Collection } from './collection'
import {
    ACCOUNT_ASSET_HOLDINGS_COLLECTION_NAME,
    ACCOUNT_ASSET_HOLDINGS_SCHEMA_VERSION,
    ACCOUNT_BALANCES_COLLECTION_NAME,
    ACCOUNT_BALANCES_SCHEMA_VERSION,
    accountAssetHoldingsKey,
    accountBalancesKey,
    type AccountAssetHoldingRow,
    type AccountBalanceRow,
} from './schemas/accounts'
import {
    ASSETS_NODE_COLLECTION_NAME,
    ASSETS_NODE_SCHEMA_VERSION,
    ASSETS_PERA_COLLECTION_NAME,
    ASSETS_PERA_SCHEMA_VERSION,
    ASSET_PRICES_COLLECTION_NAME,
    ASSET_PRICES_SCHEMA_VERSION,
    assetPricesKey,
    assetsNodeKey,
    assetsPeraKey,
    type AssetPriceRow,
    type AssetsNodeRow,
    type AssetsPeraRow,
} from './schemas/assets'
import {
    NFD_CACHE_COLLECTION_NAME,
    NFD_CACHE_SCHEMA_VERSION,
    nfdCacheKey,
    type NfdCacheRow,
} from './schemas/nfd-cache'
import {
    ACCOUNT_TRANSACTIONS_COLLECTION_NAME,
    ACCOUNT_TRANSACTIONS_SCHEMA_VERSION,
    TRANSACTIONS_COLLECTION_NAME,
    TRANSACTIONS_SCHEMA_VERSION,
    accountTransactionsKey,
    transactionsKey,
    type AccountTransactionRow,
    type TransactionRow,
} from './schemas/transactions'

/**
 * Collection registry — the single place every domain package reaches
 * into to get a typed handle on its reactive collection.
 *
 * The registry is deliberately structured around a single, centralized
 * `getCollections()` accessor so that the eventual swap to the real
 * `@tanstack/db` library is localized: only this file imports the
 * upstream primitives, and every consumer of the collections keeps
 * talking to `Collection<T>` as declared in `collection.ts`.
 *
 * Bootstrap lifecycle:
 *
 *   1. The mobile app calls `bootstrapCollections({ mmkv })` once at
 *      startup with the raw MMKV instance from the platform-rn package.
 *   2. The registry instantiates one `MmkvAdapter` per collection,
 *      hydrates the in-memory state from MMKV, and wires each adapter
 *      to a new `Collection`.
 *   3. Every subsequent call to `getCollections()` returns the same
 *      instance. Calling it before bootstrap throws.
 *
 * For tests, use `bootstrapTestCollections()` which skips MMKV entirely
 * and uses the in-memory `MemoryAdapter`.
 */

export type CollectionRegistry = {
    nfdCache: Collection<NfdCacheRow>
    assetsNode: Collection<AssetsNodeRow>
    assetsPera: Collection<AssetsPeraRow>
    assetPrices: Collection<AssetPriceRow>
    accountBalances: Collection<AccountBalanceRow>
    accountAssetHoldings: Collection<AccountAssetHoldingRow>
    transactions: Collection<TransactionRow>
    accountTransactions: Collection<AccountTransactionRow>
}

let instance: CollectionRegistry | null = null

export type BootstrapOptions = {
    mmkv: MmkvLike
}

export function bootstrapCollections(
    options: BootstrapOptions,
): CollectionRegistry {
    const { mmkv } = options
    instance = {
        nfdCache: new Collection<NfdCacheRow>({
            name: NFD_CACHE_COLLECTION_NAME,
            adapter: new MmkvAdapter<NfdCacheRow>({
                name: NFD_CACHE_COLLECTION_NAME,
                schemaVersion: NFD_CACHE_SCHEMA_VERSION,
                mmkv,
            }),
            getKey: nfdCacheKey,
        }),
        assetsNode: new Collection<AssetsNodeRow>({
            name: ASSETS_NODE_COLLECTION_NAME,
            adapter: new MmkvAdapter<AssetsNodeRow>({
                name: ASSETS_NODE_COLLECTION_NAME,
                schemaVersion: ASSETS_NODE_SCHEMA_VERSION,
                mmkv,
            }),
            getKey: assetsNodeKey,
        }),
        assetsPera: new Collection<AssetsPeraRow>({
            name: ASSETS_PERA_COLLECTION_NAME,
            adapter: new MmkvAdapter<AssetsPeraRow>({
                name: ASSETS_PERA_COLLECTION_NAME,
                schemaVersion: ASSETS_PERA_SCHEMA_VERSION,
                mmkv,
            }),
            getKey: assetsPeraKey,
        }),
        assetPrices: new Collection<AssetPriceRow>({
            name: ASSET_PRICES_COLLECTION_NAME,
            adapter: new MmkvAdapter<AssetPriceRow>({
                name: ASSET_PRICES_COLLECTION_NAME,
                schemaVersion: ASSET_PRICES_SCHEMA_VERSION,
                mmkv,
            }),
            getKey: assetPricesKey,
        }),
        accountBalances: new Collection<AccountBalanceRow>({
            name: ACCOUNT_BALANCES_COLLECTION_NAME,
            adapter: new MmkvAdapter<AccountBalanceRow>({
                name: ACCOUNT_BALANCES_COLLECTION_NAME,
                schemaVersion: ACCOUNT_BALANCES_SCHEMA_VERSION,
                mmkv,
            }),
            getKey: accountBalancesKey,
        }),
        accountAssetHoldings: new Collection<AccountAssetHoldingRow>({
            name: ACCOUNT_ASSET_HOLDINGS_COLLECTION_NAME,
            adapter: new MmkvAdapter<AccountAssetHoldingRow>({
                name: ACCOUNT_ASSET_HOLDINGS_COLLECTION_NAME,
                schemaVersion: ACCOUNT_ASSET_HOLDINGS_SCHEMA_VERSION,
                mmkv,
            }),
            getKey: accountAssetHoldingsKey,
        }),
        transactions: new Collection<TransactionRow>({
            name: TRANSACTIONS_COLLECTION_NAME,
            adapter: new MmkvAdapter<TransactionRow>({
                name: TRANSACTIONS_COLLECTION_NAME,
                schemaVersion: TRANSACTIONS_SCHEMA_VERSION,
                mmkv,
            }),
            getKey: transactionsKey,
        }),
        accountTransactions: new Collection<AccountTransactionRow>({
            name: ACCOUNT_TRANSACTIONS_COLLECTION_NAME,
            adapter: new MmkvAdapter<AccountTransactionRow>({
                name: ACCOUNT_TRANSACTIONS_COLLECTION_NAME,
                schemaVersion: ACCOUNT_TRANSACTIONS_SCHEMA_VERSION,
                mmkv,
            }),
            getKey: accountTransactionsKey,
        }),
    }
    return instance
}

/**
 * Test-only bootstrap. Each call returns a fresh, isolated registry
 * backed by `MemoryAdapter` — use this in `beforeEach` to guarantee
 * test isolation without paying for JSON roundtrips.
 */
export function bootstrapTestCollections(): CollectionRegistry {
    const registry: CollectionRegistry = {
        nfdCache: makeCollection<NfdCacheRow>({
            name: NFD_CACHE_COLLECTION_NAME,
            getKey: nfdCacheKey,
        }),
        assetsNode: makeCollection<AssetsNodeRow>({
            name: ASSETS_NODE_COLLECTION_NAME,
            getKey: assetsNodeKey,
        }),
        assetsPera: makeCollection<AssetsPeraRow>({
            name: ASSETS_PERA_COLLECTION_NAME,
            getKey: assetsPeraKey,
        }),
        assetPrices: makeCollection<AssetPriceRow>({
            name: ASSET_PRICES_COLLECTION_NAME,
            getKey: assetPricesKey,
        }),
        accountBalances: makeCollection<AccountBalanceRow>({
            name: ACCOUNT_BALANCES_COLLECTION_NAME,
            getKey: accountBalancesKey,
        }),
        accountAssetHoldings: makeCollection<AccountAssetHoldingRow>({
            name: ACCOUNT_ASSET_HOLDINGS_COLLECTION_NAME,
            getKey: accountAssetHoldingsKey,
        }),
        transactions: makeCollection<TransactionRow>({
            name: TRANSACTIONS_COLLECTION_NAME,
            getKey: transactionsKey,
        }),
        accountTransactions: makeCollection<AccountTransactionRow>({
            name: ACCOUNT_TRANSACTIONS_COLLECTION_NAME,
            getKey: accountTransactionsKey,
        }),
    }
    instance = registry
    return registry
}

function makeCollection<TValue>(options: {
    name: string
    getKey: (value: TValue) => string
    adapter?: PersistentAdapter<TValue>
}): Collection<TValue> {
    return new Collection<TValue>({
        name: options.name,
        adapter:
            options.adapter ?? new MemoryAdapter<TValue>({ name: options.name }),
        getKey: options.getKey,
    })
}

export function getCollections(): CollectionRegistry {
    if (instance === null) {
        throw new Error(
            'Collections not initialized. Call bootstrapCollections() during app bootstrap.',
        )
    }
    return instance
}

/** Wipes every persisted collection. Used by the "delete all data" flow. */
export function resetAllCollections(): void {
    const registry = getCollections()
    for (const key of Object.keys(registry) as Array<keyof CollectionRegistry>) {
        registry[key].clear()
    }
}

/** Test helper. Drops the singleton so the next `bootstrap*` call rebuilds. */
export function resetRegistryForTest(): void {
    instance = null
}
