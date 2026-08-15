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
import { PWText, PWTouchableOpacity, PWView, PWIcon } from '@components/core'
import { CollectibleThumbnail } from '../CollectibleThumbnail'
import { useStyles } from './styles'
import type { CollectibleItemProps } from '@modules/assets/types/collectible'
import { useCollectibleItem } from '@modules/assets/hooks/useCollectibleItem'

const CollectibleGridItemBase = ({ item, onPress }: CollectibleItemProps) => {
    const styles = useStyles()
    const {
        thumbnailUrl,
        showAmount,
        hasBalance,
        verificationIconName,
        title,
        collectionLabel,
        handleLongPress,
    } = useCollectibleItem({ item, onPress })

    return (
        <PWTouchableOpacity
            testID={`collectible_row_${item.assetId}`}
            style={styles.container}
            onPress={onPress}
            onLongPress={handleLongPress}
        >
            <PWView style={styles.imageContainer}>
                <CollectibleThumbnail
                    thumbnailUrl={thumbnailUrl}
                    imageStyle={styles.image}
                    placeholderStyle={styles.placeholderContainer}
                    iconSize='lg'
                    notOptedIn={!hasBalance}
                />
                {showAmount && (
                    <PWView style={styles.amountBadge}>
                        <PWText
                            variant='caption'
                            style={styles.amountBadgeText}
                        >
                            x{item.amount.toString()}
                        </PWText>
                    </PWView>
                )}
            </PWView>
            <PWView style={styles.infoContainer}>
                {collectionLabel && (
                    <PWText
                        variant='body'
                        style={styles.collectionName}
                        numberOfLines={1}
                    >
                        {collectionLabel}
                    </PWText>
                )}
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.title}
                        numberOfLines={2}
                    >
                        {title}
                    </PWText>
                    {verificationIconName ? (
                        <PWIcon
                            name={verificationIconName}
                            size='xs'
                        />
                    ) : null}
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}

export const CollectibleGridItem = React.memo(CollectibleGridItemBase)
