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

import React from 'react'
import {
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    type PeraAsset,
    type PeraCollectible,
} from '@perawallet/wallet-core-assets'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useCollectibleInfo } from './useCollectibleInfo'

type CollectibleInfoSectionProps = {
    asset: PeraAsset
    collectible?: PeraCollectible
}

export const CollectibleInfoSection = ({
    asset,
    collectible: _collectible,
}: CollectibleInfoSectionProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        onCreatorPressed,
        onCreatorLongPressed,
        onAssetIdPressed,
        onAssetIdLongPressed,
        onOpenExplorer,
        totalSupplyAmount,
        totalSupplyUnit,
    } = useCollectibleInfo(asset)

    return (
        <PWView style={styles.infoSection}>
            {asset.creator.address && (
                <>
                    <PWTouchableOpacity
                        style={styles.infoRow}
                        onPress={onCreatorPressed}
                        onLongPress={onCreatorLongPressed}
                        accessibilityHint='Long press to copy'
                    >
                        <PWText
                            variant='body'
                            truncate
                            style={styles.infoLabel}
                        >
                            {t('asset_details.collectible.creator')}
                        </PWText>
                        <PWText
                            variant='body'
                            style={
                                onCreatorPressed
                                    ? styles.infoValueLink
                                    : styles.infoValue
                            }
                        >
                            {truncateAlgorandAddress(asset.creator.address)}
                        </PWText>
                    </PWTouchableOpacity>
                    <PWDivider style={styles.infoDivider} />
                </>
            )}

            <PWTouchableOpacity
                style={styles.infoRow}
                onPress={onAssetIdPressed}
                onLongPress={onAssetIdLongPressed}
                accessibilityHint='Long press to copy'
            >
                <PWText
                    variant='body'
                    truncate
                    style={styles.infoLabel}
                >
                    {t('asset_details.collectible.asset_id')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.infoValueAction}
                >
                    {asset.assetId}
                </PWText>
            </PWTouchableOpacity>
            <PWDivider style={styles.infoDivider} />

            <PWView style={styles.infoRow}>
                <PWText
                    variant='body'
                    truncate
                    style={styles.infoLabel}
                >
                    {t('asset_details.collectible.total_supply')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.infoValue}
                >
                    {totalSupplyAmount?.toString()}
                    {totalSupplyUnit}
                </PWText>
            </PWView>

            {onOpenExplorer && (
                <>
                    <PWDivider style={styles.infoDivider} />
                    <PWTouchableOpacity
                        style={styles.infoRow}
                        onPress={onOpenExplorer}
                    >
                        <PWText
                            variant='body'
                            truncate
                            style={styles.infoLabel}
                        >
                            {t('asset_details.collectible.show_on')}
                        </PWText>
                        <PWView style={styles.explorerRow}>
                            <PWIcon
                                name='pera'
                                size='md'
                            />
                            <PWText
                                variant='body'
                                style={styles.infoValueLink}
                            >
                                {t('asset_details.collectible.explorer')}
                            </PWText>
                        </PWView>
                    </PWTouchableOpacity>
                </>
            )}
        </PWView>
    )
}
