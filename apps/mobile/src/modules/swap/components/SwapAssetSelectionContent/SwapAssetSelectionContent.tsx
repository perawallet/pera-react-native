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

import { useCallback } from 'react'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { isSwappableAsset } from '@perawallet/wallet-core-swaps'
import { PWView } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { AccountAssetSelectionList } from '@modules/assets/components/AccountAssetSelectionList'
import { SwapToAssetSelectionList } from '../SwapToAssetSelectionList'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'
import { useStyles } from './styles'

const filterSwappable = (item: AssetWithAccountBalance) =>
    isSwappableAsset(item.asset)

type BaseProps = {
    excludeAssetId?: string
}

export type SwapAssetSelectionContentProps = BaseProps &
    ({ variant: 'from' } | { variant: 'to'; fromAssetId: string })

export const SwapAssetSelectionContent = (
    props: SwapAssetSelectionContentProps,
) => {
    const { variant, excludeAssetId } = props
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<string>()

    const handleAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            const assetName =
                asset.asset?.unitName ?? asset.asset?.name ?? asset.assetId
            trackEvent(
                variant === 'from'
                    ? SwapEvent.SelectTopAsset
                    : SwapEvent.SelectBottomAsset,
                { [AnalyticsMetadataKey.AssetName]: assetName },
            )
            resolve(asset.assetId)
        },
        [resolve, variant],
    )

    const title =
        variant === 'from'
            ? t('swap.asset_selection.swap_from_title')
            : t('swap.asset_selection.swap_to_title')

    return (
        <>
            <SheetHeader title={title} />
            <PWView style={styles.body}>
                {props.variant === 'to' ? (
                    <SwapToAssetSelectionList
                        fromAssetId={props.fromAssetId}
                        onAssetSelected={handleAssetSelected}
                        isVisible
                        excludeAssetId={excludeAssetId}
                        inBottomSheet
                        searchPlaceholder={t(
                            'swap.asset_selection.search_placeholder',
                        )}
                        emptyResultTitle={t(
                            'swap.asset_selection.no_results_title',
                        )}
                        emptyResultBody={t(
                            'swap.asset_selection.no_results_body',
                        )}
                    />
                ) : (
                    <AccountAssetSelectionList
                        onAssetSelected={handleAssetSelected}
                        isVisible
                        excludeAssetId={excludeAssetId}
                        filterAsset={filterSwappable}
                        inBottomSheet
                        searchPlaceholder={t(
                            'swap.asset_selection.search_placeholder',
                        )}
                        emptyResultTitle={t(
                            'swap.asset_selection.no_results_title',
                        )}
                        emptyResultBody={t(
                            'swap.asset_selection.no_results_body',
                        )}
                    />
                )}
            </PWView>
        </>
    )
}
