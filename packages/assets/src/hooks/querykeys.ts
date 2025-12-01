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

import { HistoryPeriod } from 'packages/shared/src'
import { ALGO_ASSET_ID } from '../models'

export const MODULE_PREFIX = 'assets'

export const getAssetFiatPricesQueryKey = (assetIDs: string[]) => {
    return [MODULE_PREFIX, 'prices', 'fiat', { assetIDs }]
}

export const getAssetPriceHistoryQueryKey = (
    assetID: string,
    period: HistoryPeriod,
) => {
    return [MODULE_PREFIX, 'prices', 'history', { assetID, period }]
}

export const getAssetsQueryKey = (assetIDs: string[]) => {
    return [MODULE_PREFIX, { assetIDs }]
}

export const getAlgoQueryKey = () => {
    return [MODULE_PREFIX, { algo: ALGO_ASSET_ID }]
}

export const getAssetDetailsQueryKey = (assetId: string) => [
    MODULE_PREFIX,
    { assetId },
]

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
