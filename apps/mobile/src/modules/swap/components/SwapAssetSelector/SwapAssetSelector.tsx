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

import { useMemo } from 'react'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type SwapAssetSelectorProps = {
    assetId: string
    variant: 'pay' | 'receive'
    onPress: () => void
}

export const SwapAssetSelector = ({
    assetId,
    variant,
    onPress,
}: SwapAssetSelectorProps) => {
    const { t } = useLanguage()
    const styles = useStyles({ variant })

    const { data: assets } = useAssetsQuery([assetId])

    const asset = useMemo(() => assets?.get(assetId), [assets, assetId])

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
        >
            <PWView style={styles.content}>
                {asset ? (
                    <>
                        <AssetIcon
                            asset={asset}
                            style={styles.icon}
                        />
                        <PWText variant='h4'>{asset.unitName}</PWText>
                    </>
                ) : (
                    <PWText variant='h4'>{t('swap.form.select_asset')}</PWText>
                )}
                <PWIcon name='chevron-right' />
            </PWView>
        </PWTouchableOpacity>
    )
}
