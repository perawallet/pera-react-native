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

import { useCallback } from 'react'
import { type AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { PWBottomSheet, PWIcon, PWText, PWToolbar } from '@components/core'
import { AccountAssetSelectionList } from '@modules/assets/components/AccountAssetSelectionList'
import { SwapToAssetSelectionList } from '../SwapToAssetSelectionList'
import { isSwappableAsset } from '@perawallet/wallet-core-swaps'
import { useStyles } from './styles'

const filterSwappable = (item: AssetWithAccountBalance) =>
    isSwappableAsset(item.asset)

type BaseProps = {
    isVisible: boolean
    onClose: () => void
    onAssetSelected: (asset: AssetWithAccountBalance) => void
    excludeAssetId?: string
}

export type SwapAssetSelectionBottomSheetProps = BaseProps &
    ({ variant: 'from' } | { variant: 'to'; fromAssetId: string })

export const SwapAssetSelectionBottomSheet = (
    props: SwapAssetSelectionBottomSheetProps,
) => {
    const { variant, isVisible, onClose, onAssetSelected, excludeAssetId } =
        props
    const { t } = useLanguage()
    const styles = useStyles()

    const handleAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            onAssetSelected(asset)
            onClose()
        },
        [onAssetSelected, onClose],
    )

    const title =
        variant === 'from'
            ? t('swap.asset_selection.swap_from_title')
            : t('swap.asset_selection.swap_to_title')

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        onPress={onClose}
                    />
                }
                center={<PWText variant='h4'>{title}</PWText>}
            />
            {props.variant === 'to' ? (
                <SwapToAssetSelectionList
                    fromAssetId={props.fromAssetId}
                    onAssetSelected={handleAssetSelected}
                    isVisible={isVisible}
                    excludeAssetId={excludeAssetId}
                    searchPlaceholder={t(
                        'swap.asset_selection.search_placeholder',
                    )}
                    emptyResultTitle={t(
                        'swap.asset_selection.no_results_title',
                    )}
                    emptyResultBody={t('swap.asset_selection.no_results_body')}
                />
            ) : (
                <AccountAssetSelectionList
                    onAssetSelected={handleAssetSelected}
                    isVisible={isVisible}
                    excludeAssetId={excludeAssetId}
                    filterAsset={filterSwappable}
                    searchPlaceholder={t(
                        'swap.asset_selection.search_placeholder',
                    )}
                    emptyResultTitle={t(
                        'swap.asset_selection.no_results_title',
                    )}
                    emptyResultBody={t('swap.asset_selection.no_results_body')}
                />
            )}
        </PWBottomSheet>
    )
}
