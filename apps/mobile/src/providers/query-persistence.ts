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

import type { Query } from '@tanstack/react-query'
import { isAccountBalancesHistoryQuery } from '@perawallet/wallet-core-accounts'
import { isAssetPriceHistoryQuery } from '@perawallet/wallet-core-assets'

// Caches written before the serializer tagged Decimals hold them as bare
// strings, and consumers call Decimal methods on hydrated data during render.
// Bump whenever the persisted shape changes incompatibly so such caches are
// discarded instead of rehydrated.
// Bump it when the persistence policy narrows too: caches written under a
// laxer policy otherwise rehydrate for up to `reactQueryPersistenceAge`.
export const PERSISTED_CACHE_BUSTER = 'prefix-allowlist'

/**
 * What each query-key prefix may write to the persisted cache, which is
 * plaintext MMKV on device and `chrome.storage.local` on web — a
 * disk-exposure decision, not a caching one. Unlisted means never persisted,
 * so a new query carrying a token cannot reach unencrypted storage by
 * omission; `__tests__/query-persistence-coverage.spec.ts` fails until a new
 * prefix is classified here.
 */
export const QUERY_PREFIX_POLICY: Record<string, 'persist' | 'never'> = {
    // Address-linked, PII-carrying, secret-adjacent or worthless once stale.
    // The DB-backed ones (accounts, assets, transactions) also have SQLite as
    // their source of truth; blockchain carries raw indexer/algod bytes that
    // crashed when round-tripped through disk.
    accounts: 'never',
    'asa-inbox': 'never',
    assets: 'never',
    'balance-impact-simulation': 'never',
    blockchain: 'never',
    card: 'never',
    multisig: 'never',
    nfd: 'never',
    notifications: 'never',
    onramp: 'never',
    passkeys: 'never',
    'rekey-transaction-fee': 'never',
    swaps: 'never',
    transactions: 'never',
    // Global, non-identifying content that is useful before the first fetch
    // lands. None of these keys carry an address.
    banners: 'persist',
    currencies: 'persist',
    projects: 'persist',
    staking: 'persist',
}

export const shouldDehydrateQuery = (query: Query): boolean => {
    if (query.state.status !== 'success') return false

    // Narrower than the prefix table and checked first: chart snapshots live
    // under otherwise-never modules. They are network-only (no SQLite history
    // table backs them) and carry no PII, so persisting the last successful
    // snapshot is what lets charts render last-known data offline.
    if (
        isAccountBalancesHistoryQuery(query.queryKey) ||
        isAssetPriceHistoryQuery(query.queryKey)
    ) {
        return true
    }

    const prefix = query.queryKey[0]

    return (
        typeof prefix === 'string' && QUERY_PREFIX_POLICY[prefix] === 'persist'
    )
}
