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

import React from 'react'
import { PWText, PWTouchableOpacity, PWView, PWIcon } from '@components/core'
import { CollectibleThumbnail } from '../CollectibleThumbnail'
import { useStyles } from './styles'
import { type CollectibleItemProps } from '@modules/assets/types/collectible'
import { useCollectibleItem } from '@modules/assets/hooks/useCollectibleItem'

const CollectibleListItemBase = ({ item, onPress }: CollectibleItemProps) => {
    const styles = useStyles()
    const {
        thumbnailUrl,
        showAmount,
        hasBalance,
        verificationIconName,
        title,
        collectionLabel,
    } = useCollectibleItem({ item, onPress })

    const subtitle = [
        collectionLabel,
        showAmount ? `x${item.amount.toString()}` : null,
    ]
        .filter(Boolean)
        .join(' \u00B7 ')

    const content = (
        <>
            <PWView style={styles.thumbnail}>
                <CollectibleThumbnail
                    thumbnailUrl={thumbnailUrl}
                    imageStyle={styles.image}
                    placeholderStyle={styles.placeholderContainer}
                    iconSize='md'
                    notOptedIn={!hasBalance}
                />
            </PWView>
            <PWView style={styles.textContainer}>
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
        </>
    )

    if (onPress) {
        return (
            <PWTouchableOpacity
                style={styles.container}
                onPress={onPress}
            >
                {content}
            </PWTouchableOpacity>
        )
    }

    return <PWView style={styles.container}>{content}</PWView>
}

export const CollectibleListItem = React.memo(CollectibleListItemBase)
