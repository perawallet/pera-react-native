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
    ALGO_ASSET_ID,
    type HistoryPeriod,
    type Network,
} from '@perawallet/wallet-core-shared'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

export const MODULE_PREFIX = 'assets'

export const isAssetQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX

const FNV_OFFSET = 0x81_1c_9d_c5
const FNV_PRIME = 0x01_00_01_93
const MIX_SEED = 0x27_d4_eb_2f
const MIX_PRIME = 0x85_eb_ca_6b
/** Not a valid id character, so `['1','23']` and `['12','3']` can't collide. */
const SEPARATOR = 0x2c

/**
 * Fixed-width digest of an asset-id list, for use inside a query key.
 *
 * An account can hold tens of thousands of assets, and TanStack re-derives a
 * query's hash by `JSON.stringify`-ing its whole key on *every render* of
 * every component observing it. Embedding the raw id array therefore costs an
 * O(ids) string build per render — hundreds of milliseconds of main-thread
 * work per keystroke on a large NFT gallery. A digest makes that
 * O(1).
 *
 * The trade is a collision: two different id lists hashing alike would share
 * one cache entry and serve each other's assets. Two independent 32-bit lanes
 * plus the list length discriminate on ~2^64 states, which is far below the
 * noise floor for the few hundred distinct lists a session builds.
 */
export const hashAssetIds = (assetIDs: string[]): string => {
    let low = FNV_OFFSET
    let high = MIX_SEED

    for (const assetID of assetIDs) {
        for (let index = 0; index < assetID.length; index++) {
            const code = assetID.charCodeAt(index)
            low = Math.imul(low ^ code, FNV_PRIME)
            high = Math.imul(high ^ code, MIX_PRIME)
        }
        low = Math.imul(low ^ SEPARATOR, FNV_PRIME)
        high = Math.imul(high ^ SEPARATOR, MIX_PRIME)
    }

    return `${(low >>> 0).toString(36)}.${(high >>> 0).toString(36)}.${assetIDs.length}`
}

export const getAssetPricesQueryKey = (
    assetIDs: string[],
    network: Network,
) => {
    return [
        MODULE_PREFIX,
        'prices',
        'usd',
        { assetIDs: hashAssetIds(assetIDs), network },
    ]
}

export const getAssetPriceHistoryQueryKey = (
    assetID: string,
    period: HistoryPeriod,
    network: Network,
) => {
    return [MODULE_PREFIX, 'prices', 'history', { assetID, period, network }]
}

/**
 * Chart-history key guard. Allowlisted into query persistence:
 * price history is network-only (no SQLite table backs it) and carries no
 * PII, so the last successful snapshot is safe and cheap to persist.
 */
export const isAssetPriceHistoryQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX &&
    queryKey[1] === 'prices' &&
    queryKey[2] === 'history'

export const getAssetsQueryKey = (assetIDs: string[], network: Network) => {
    return [MODULE_PREFIX, { assetIDs: hashAssetIds(assetIDs), network }]
}

export const getAlgoQueryKey = (network: Network) => {
    return [MODULE_PREFIX, { algo: ALGO_ASSET_ID, network }]
}

/** Canonical single-asset cache entry (DB-backed read path). */
export const getAssetDetailsQueryKey = (assetId: string, network: Network) => [
    MODULE_PREFIX,
    'detail',
    { assetId, network },
]

/**
 * The always-remote single-asset entry (collectible detail): kept distinct
 * from the canonical DB-backed entry because bulk-synced DB rows may carry a
 * sparser collectible payload (media, traits) than the detail endpoints —
 * sharing one entry would let a DB-sourced read permanently satisfy the
 * screen that needs the rich one (staleTime is Infinity).
 */
export const getRemoteAssetDetailsQueryKey = (
    assetId: string,
    network: Network,
) => [MODULE_PREFIX, 'detail-remote', { assetId, network }]

export const getPublicAssetDetailsQueryKey = (assetId: string) => [
    MODULE_PREFIX,
    'public',
    { assetId },
]

export const getIndexerAssetDetailsQueryKey = (assetId: string) => [
    MODULE_PREFIX,
    'indexer',
    { assetId },
]

/** Freeze/clawback authorities, read from the indexer's asset params. */
export const getAssetAuthoritiesQueryKey = (
    assetId: string,
    network: Network,
) => [MODULE_PREFIX, 'authorities', { assetId, network }]

export function invalidateAssetQueries(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === MODULE_PREFIX,
    })
}
