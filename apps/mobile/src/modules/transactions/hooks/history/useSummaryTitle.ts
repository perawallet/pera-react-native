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

import { useMemo } from 'react'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import type {
    ChainScope,
    LocalizedText,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'

/**
 * The summary's title with its `asset` param swapped for the stored asset's
 * unit name. Reads the local store only, as the row's amounts do.
 */
export const useResolvedSummaryTitle = (
    summary: TransactionSummary,
    scope: ChainScope,
): LocalizedText => {
    const { title, subjectAsset } = summary
    const { data: storedAssets } = useAssetsQuery(
        scope,
        subjectAsset ? [subjectAsset.assetId] : [],
    )
    const unitName = subjectAsset
        ? storedAssets.get(subjectAsset.assetId)?.unitName
        : undefined

    return useMemo(
        () =>
            unitName
                ? { ...title, params: { ...title.params, asset: unitName } }
                : title,
        [title, unitName],
    )
}

export const useSummaryTitle = (
    summary: TransactionSummary,
    scope: ChainScope,
): string => {
    const { t } = useLanguage()
    const { key, params } = useResolvedSummaryTitle(summary, scope)
    return useMemo(() => t(key, params), [t, key, params])
}
