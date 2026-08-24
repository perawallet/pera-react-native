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

import { type Query } from '@tanstack/react-query'
import {
    isAccountBalancesHistoryQuery,
    isAccountQuery,
} from '@perawallet/wallet-core-accounts'
import {
    isAssetPriceHistoryQuery,
    isAssetQuery,
} from '@perawallet/wallet-core-assets'
import { isTransactionQuery } from '@perawallet/wallet-core-transactions'
import { isCardQuery } from '@perawallet/wallet-core-card'
import { isBlockchainQuery } from '@perawallet/wallet-core-blockchain'

export const shouldDehydrateQuery = (query: Query): boolean => {
    // PERA-4581: chart-history snapshots are allowlisted AHEAD of the module
    // exclusions below. They are network-only (no SQLite history table backs
    // them) and carry no PII, so persisting the last successful snapshot is
    // what lets charts render last-known data offline across restarts.
    if (
        isAccountBalancesHistoryQuery(query.queryKey) ||
        isAssetPriceHistoryQuery(query.queryKey)
    ) {
        return query.state.status === 'success'
    }
    // Don't persist DB-backed queries — SQLite is the source of truth.
    // Card queries are excluded too: their responses can carry KYC
    // PII that must never land in the unencrypted disk cache.
    // Blockchain queries are indexer/algod-backed, and the raw byte fields
    // they carry are what PERA-4974 crashed on once round-tripped through
    // disk. Both consumers degrade acceptably without a disk copy: Transaction
    // Details falls back to the mapped SQLite row (losing only the indexer
    // enrichment), and the group list renders empty until the fetch lands.
    if (
        isAccountQuery(query.queryKey) ||
        isAssetQuery(query.queryKey) ||
        isTransactionQuery(query.queryKey) ||
        isCardQuery(query.queryKey) ||
        isBlockchainQuery(query.queryKey)
    ) {
        return false
    }
    return query.state.status === 'success'
}
