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

// Caches written before the serializer tagged Decimals hold them as bare
// strings, and consumers call Decimal methods on hydrated data during render.
// Bump whenever the persisted shape changes incompatibly so such caches are
// discarded instead of rehydrated.
// Bump it when the persistence policy narrows too: caches written under a
// laxer policy otherwise rehydrate for up to `reactQueryPersistenceAge`.
// And when a query key changes shape: entries are stored by key hash, so ones
// written under the old shape are never read again yet outlive that same age.
export const PERSISTED_CACHE_BUSTER = 'price-history-points'

/**
 * What each query-key prefix may write to the persisted cache, which is
 * plaintext MMKV on device and `chrome.storage.local` on web — a
 * disk-exposure decision, not a caching one. Unlisted means never persisted,
 * so a new query carrying a token cannot reach unencrypted storage by
 * omission; `__tests__/query-persistence-coverage.spec.ts` fails until a new
 * prefix is classified here.
 *
 * Entries are `/`-joined key paths of any depth and the longest one matching a
 * key's leading string segments wins. `pera/persisted-query-serializable`
 * reads this table to check what every persisted entry's queries return.
 */
export const QUERY_PREFIX_POLICY: Record<string, 'persist' | 'never'> = {
    // Two reasons to keep a module off disk. SQLite already holds it, so a
    // second copy only drifts (accounts, assets, transactions; blockchain is
    // raw indexer/algod bytes that crashed when round-tripped). Or it carries
    // personal data with no public source behind it: card KYC, and the
    // onramp/swap histories tied to a device and an account.
    accounts: 'never',
    assets: 'never',
    blockchain: 'never',
    card: 'never',
    // The proven-passkey sweep: credential metadata, and a cold start re-runs
    // it before any reader needs it.
    'cloud-backup': 'never',
    onramp: 'never',
    passkeys: 'never',
    // Keyed by the hosts of the sites the user connects to; the verdict is
    // recomputed on device from the stored lists in milliseconds.
    'site-safety': 'never',
    swaps: 'never',
    transactions: 'never',
    // Everything else is derived from the chain or public catalogs, so a copy
    // on disk exposes nothing that isn't already public, and it is what lets
    // the app render before the first fetch lands.
    'asa-inbox': 'persist',
    'balance-impact-simulation': 'persist',
    banners: 'persist',
    currencies: 'persist',
    'delegation-transaction-fee': 'persist',
    multisig: 'persist',
    nfd: 'persist',
    notifications: 'persist',
    projects: 'persist',
    staking: 'persist',
    // `onramp` and `swaps` are mixed: their history keys carry an address, but
    // their catalogs are the same global content as the block above. A longer
    // entry overrides the module, so the catalog keeps persisting while the
    // module stays closed by default.
    'onramp/pairs': 'persist',
    'onramp/region': 'persist',
    'swaps/providers': 'persist',
    'swaps/top-pairs': 'persist',
    // Chart snapshots live under otherwise-never modules. They are
    // network-only (no SQLite history table backs them) and carry no PII, so
    // persisting the last successful snapshot is what lets charts render
    // last-known data offline. The per-account asset history
    // (`accounts/assets/balance-history`) stays closed.
    'accounts/balance-history': 'persist',
    'assets/prices/history': 'persist',
}

export const shouldDehydrateQuery = (query: Query): boolean => {
    if (query.state.status !== 'success') return false

    let verdict: 'persist' | 'never' | undefined
    let path = ''
    for (const segment of query.queryKey) {
        if (typeof segment !== 'string') break
        path = path === '' ? segment : `${path}/${segment}`
        verdict = QUERY_PREFIX_POLICY[path] ?? verdict
    }

    return verdict === 'persist'
}
