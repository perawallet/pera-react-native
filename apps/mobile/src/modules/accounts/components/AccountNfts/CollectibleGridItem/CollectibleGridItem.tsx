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
import {
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
    PWIcon,
} from '@components/core'
import { useStyles } from './styles'
import type { CollectibleItemProps } from '../types'

export const CollectibleGridItem = ({
    asset,
    collectible,
    amount,
    isPure,
    onPress,
}: CollectibleItemProps) => {
    const styles = useStyles()
    const thumbnailUrl = collectible?.primaryImage ?? asset.peraMetadata?.logo

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
        >
            <PWView style={styles.imageContainer}>
                {thumbnailUrl ? (
                    <PWImage
                        source={{ uri: thumbnailUrl }}
                        style={styles.image}
                        resizeMode='cover'
                    />
                ) : (
                    <PWView style={styles.placeholderContainer}>
                        <PWIcon
                            name='card-stack'
                            size='lg'
                        />
                    </PWView>
                )}
                {!isPure && !amount.isZero() && (
                    <PWView style={styles.amountBadge}>
                        <PWText
                            variant='caption'
                            style={styles.amountBadgeText}
                        >
                            x{amount.toString()}
                        </PWText>
                    </PWView>
                )}
            </PWView>
            <PWView style={styles.infoContainer}>
                <PWText
                    variant='body'
                    style={styles.title}
                    numberOfLines={1}
                >
                    {collectible?.title ?? asset.name ?? `#${asset.assetId}`}
                </PWText>
                {collectible?.collection?.name && (
                    <PWText
                        variant='caption'
                        style={styles.collectionName}
                        numberOfLines={1}
                    >
                        {collectible.collection.name}
                    </PWText>
                )}
            </PWView>
        </PWTouchableOpacity>
    )
}
