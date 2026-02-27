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
import { useStyles } from './styles'

//TODO: remove nullability of assetId when swap form is implemented
export type SwapAssetSelectorProps = {
    assetId: string | null
    onPress: () => void
}

export const SwapAssetSelector = ({
    assetId,
    onPress,
}: SwapAssetSelectorProps) => {
    const styles = useStyles()

    const { data: assets } = useAssetsQuery(assetId ? [assetId] : [])

    const asset = useMemo(
        () => (assetId ? assets?.get(assetId) : undefined),
        [assets, assetId],
    )

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
                    <PWText variant='h4'>Select</PWText>
                )}
                <PWIcon name='chevron-right' />
            </PWView>
        </PWTouchableOpacity>
    )
}
