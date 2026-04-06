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
import { type CollectibleItemProps } from '../types'
import { isPureNft } from '@perawallet/wallet-core-assets'

export const CollectibleListItem = ({
    asset,
    amount,
    onPress,
}: CollectibleItemProps) => {
    const styles = useStyles()
    const collectible = asset.peraMetadata?.collectible
    const isPure = isPureNft(asset)
    const thumbnailUrl = collectible?.primaryImage ?? asset.peraMetadata?.logo

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
        >
            <PWView style={styles.thumbnail}>
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
                            size='md'
                        />
                    </PWView>
                )}
            </PWView>
            <PWView style={styles.textContainer}>
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
                        style={styles.subtitle}
                        numberOfLines={1}
                    >
                        {collectible.collection.name}
                    </PWText>
                )}
            </PWView>
            {!isPure && !amount.isZero() && (
                <PWText
                    variant='caption'
                    style={styles.amountText}
                >
                    x{amount.toString()}
                </PWText>
            )}
        </PWTouchableOpacity>
    )
}
