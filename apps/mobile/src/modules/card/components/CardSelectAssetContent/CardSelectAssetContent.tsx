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
import { AccountAssetSelectionList } from '@modules/assets/components/AccountAssetSelectionList'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

// Only assets that can be swapped to USDC are eligible funding sources.
const filterSwappable = (item: AssetWithAccountBalance) =>
    isSwappableAsset(item.asset)

/**
 * Asset picker for the Add Funds flow — the source asset to deposit (USDC) or
 * swap to USDC. Reuses the shared `AccountAssetSelectionList` primitive with an
 * "Select asset" title (the swap flow's picker is titled "Swap From").
 */
export const CardSelectAssetContent = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<string>()

    const handleAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => resolve(asset.assetId),
        [resolve],
    )

    return (
        <>
            <SheetHeader title={t('peraCard.add_funds.select_asset')} />
            <PWView style={styles.body}>
                <AccountAssetSelectionList
                    onAssetSelected={handleAssetSelected}
                    isVisible
                    filterAsset={filterSwappable}
                    inBottomSheet
                    searchPlaceholder={t(
                        'peraCard.add_funds.select_asset_search',
                    )}
                    emptyResultTitle={t(
                        'peraCard.add_funds.select_asset_empty_title',
                    )}
                    emptyResultBody={t(
                        'peraCard.add_funds.select_asset_empty_body',
                    )}
                />
            </PWView>
        </>
    )
}
