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
    PWBadge,
    PWListItemLayout,
    PWText,
    PWView,
    PWIcon,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CollectibleThumbnail } from '../CollectibleThumbnail'
import { useStyles } from './styles'
import { type CollectibleItemProps } from '@modules/assets/types/collectible'
import { useCollectibleItem } from '@modules/assets/hooks/useCollectibleItem'

const CollectibleListItemBase = ({
    item,
    onPress,
    style,
    showFrozenBadge = false,
}: CollectibleItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        thumbnailUrl,
        showAmount,
        hasBalance,
        verificationIconName,
        title,
        collectionLabel,
        handleLongPress,
    } = useCollectibleItem({ item, onPress })

    const subtitle = [
        collectionLabel,
        showAmount ? `x${item.amount.toString()}` : null,
    ]
        .filter(Boolean)
        .join(' \u00B7 ')

    return (
        <PWListItemLayout
            testID={`collectible_row_${item.assetId}`}
            style={[styles.container, style]}
            onPress={onPress}
            onLongPress={handleLongPress}
            left={
                <PWView style={styles.thumbnail}>
                    <CollectibleThumbnail
                        thumbnailUrl={thumbnailUrl}
                        imageStyle={styles.image}
                        placeholderStyle={styles.placeholderContainer}
                        iconSize='md'
                        notOptedIn={!hasBalance}
                    />
                </PWView>
            }
        >
            <PWView>
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='body'
                        style={styles.title}
                        numberOfLines={1}
                    >
                        {title}
                    </PWText>
                    {verificationIconName ? (
                        <PWIcon
                            name={verificationIconName}
                            size='xs'
                        />
                    ) : null}
                    {showFrozenBadge ? (
                        <PWBadge
                            variant='secondary'
                            value={t('transactions.asset_freeze.frozen')}
                            testID='frozen-badge'
                        />
                    ) : null}
                </PWView>
                {!!subtitle && (
                    <PWText
                        variant='caption'
                        style={styles.subtitle}
                        numberOfLines={1}
                    >
                        {subtitle}
                    </PWText>
                )}
            </PWView>
        </PWListItemLayout>
    )
}

export const CollectibleListItem = React.memo(CollectibleListItemBase)
