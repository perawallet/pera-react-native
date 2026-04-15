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

export type {
    CollectionKey,
    MmkvLike,
    PersistentAdapter,
} from './adapter'
export {
    MmkvAdapter,
    MemoryAdapter,
    InMemoryMmkv,
    encode,
    decode,
    fromKeyValueStorage,
    type KeyValueStorageLike,
} from './adapter'

export { Collection } from './collection'

export {
    bootstrapCollections,
    bootstrapTestCollections,
    getCollections,
    resetAllCollections,
    resetRegistryForTest,
    type BootstrapOptions,
    type CollectionRegistry,
} from './registry'

export {
    NFD_CACHE_COLLECTION_NAME,
    NFD_CACHE_SCHEMA_VERSION,
    nfdCacheKey,
    type NfdCacheRow,
} from './schemas/nfd-cache'

export {
    ASSETS_NODE_COLLECTION_NAME,
    ASSETS_NODE_SCHEMA_VERSION,
    ASSETS_PERA_COLLECTION_NAME,
    ASSETS_PERA_SCHEMA_VERSION,
    ASSET_PRICES_COLLECTION_NAME,
    ASSET_PRICES_SCHEMA_VERSION,
    assetsNodeKey,
    assetsPeraKey,
    assetPricesKey,
    type AssetsNodeRow,
    type AssetsPeraRow,
    type AssetPriceRow as AssetPriceCollectionRow,
} from './schemas/assets'

export {
    ACCOUNT_BALANCES_COLLECTION_NAME,
    ACCOUNT_BALANCES_SCHEMA_VERSION,
    ACCOUNT_ASSET_HOLDINGS_COLLECTION_NAME,
    ACCOUNT_ASSET_HOLDINGS_SCHEMA_VERSION,
    accountBalancesKey,
    accountAssetHoldingsKey,
    accountAssetHoldingsPrefix,
    type AccountBalanceRow as AccountBalanceCollectionRow,
    type AccountAssetHoldingRow,
} from './schemas/accounts'

export {
    TRANSACTIONS_COLLECTION_NAME,
    TRANSACTIONS_SCHEMA_VERSION,
    ACCOUNT_TRANSACTIONS_COLLECTION_NAME,
    ACCOUNT_TRANSACTIONS_SCHEMA_VERSION,
    transactionsKey,
    accountTransactionsKey,
    accountTransactionsPrefix,
    type TransactionRow,
    type AccountTransactionRow,
} from './schemas/transactions'

export { useCollectionQuery } from './react'
