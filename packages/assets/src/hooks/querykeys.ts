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
import { type QueryClient, type QueryKey } from '@tanstack/react-query'

export const MODULE_PREFIX = 'assets'

export const isAssetQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX

export const getAssetPricesQueryKey = (
    assetIDs: string[],
    network: Network,
) => {
    return [MODULE_PREFIX, 'prices', 'usd', { assetIDs, network }]
}

export const getAssetPriceHistoryQueryKey = (
    assetID: string,
    period: HistoryPeriod,
    network: Network,
) => {
    return [MODULE_PREFIX, 'prices', 'history', { assetID, period, network }]
}

/**
 * Chart-history key guard. Allowlisted into query persistence (PERA-4581):
 * price history is network-only (no SQLite table backs it) and carries no
 * PII, so the last successful snapshot is safe and cheap to persist.
 */
export const isAssetPriceHistoryQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX &&
    queryKey[1] === 'prices' &&
    queryKey[2] === 'history'

export const getAssetsQueryKey = (assetIDs: string[], network: Network) => {
    return [MODULE_PREFIX, { assetIDs, network }]
}

export const getAlgoQueryKey = (network: Network) => {
    return [MODULE_PREFIX, { algo: ALGO_ASSET_ID, network }]
}

export const getAssetDetailsQueryKey = (
    assetId: string,
    useDB: boolean,
    network: Network,
) => [MODULE_PREFIX, { assetId, useDB, network }]

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

export function invalidateAssetQueries(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === MODULE_PREFIX,
    })
}

export const getAssetByIdQueryKey = (assetId: string, network: Network) => [
    MODULE_PREFIX,
    'byId',
    { assetId, network },
]
