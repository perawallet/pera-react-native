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

import type {
    AssetRef,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { PWView } from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { SwapFromAssetSelectionList } from '../SwapFromAssetSelectionList'
import { SwapToAssetSelectionList } from '../SwapToAssetSelectionList'
import { useStyles } from './styles'
import { useSwapAssetSelectionContent } from './useSwapAssetSelectionContent'

type BaseProps = {
    scope: ChainScope
    excludeAsset?: AssetRef
}

export type SwapAssetSelectionContentProps = BaseProps &
    ({ variant: 'from' } | { variant: 'to'; fromAssetId: string })

export const SwapAssetSelectionContent = (
    props: SwapAssetSelectionContentProps,
) => {
    const { scope, variant, excludeAsset } = props
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        handleAssetSelected,
        handleFromAssetSelected,
        handleSwitchPayAsset,
    } = useSwapAssetSelectionContent(variant)

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
                        scope={scope}
                        fromAssetId={props.fromAssetId}
                        onAssetSelected={handleAssetSelected}
                        onSwitchPayAsset={handleSwitchPayAsset}
                        isVisible
                        excludeAssetId={excludeAsset?.assetId}
                        inBottomSheet
                        emptyResultTitle={t(
                            'swap.asset_selection.no_results_title',
                        )}
                        emptyResultBody={t(
                            'swap.asset_selection.no_results_body',
                        )}
                        emptyChainResultBody={t(
                            'swap.asset_selection.no_chain_results_body',
                        )}
                    />
                ) : (
                    <SwapFromAssetSelectionList
                        scope={scope}
                        excludeAsset={excludeAsset}
                        onAssetSelected={handleFromAssetSelected}
                        emptyResultTitle={t(
                            'swap.asset_selection.no_results_title',
                        )}
                        emptyResultBody={t(
                            'swap.asset_selection.no_results_body',
                        )}
                        emptyChainResultBody={t(
                            'swap.asset_selection.no_chain_results_body',
                        )}
                    />
                )}
            </PWView>
        </>
    )
}
