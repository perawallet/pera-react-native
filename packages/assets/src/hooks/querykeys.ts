import { HistoryPeriod } from "packages/shared/src"
import { ALGO_ASSET_ID } from "../models"

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

export const getAssetDetailsQueryKey = (assetId: string) => [MODULE_PREFIX, { assetId }]

export const getPublicAssetDetailsQueryKey = (assetId: string) => [MODULE_PREFIX, 'public', { assetId }]

export const getIndexerAssetDetailsQueryKey = (assetId: string) => [MODULE_PREFIX, 'indexer', { assetId }]