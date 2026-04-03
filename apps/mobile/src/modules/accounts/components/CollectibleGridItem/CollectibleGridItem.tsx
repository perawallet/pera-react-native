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

import React, { useMemo } from 'react'
import {
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
    PWIcon,
} from '@components/core'
import { useStyles } from './styles'
import type { CollectibleItemProps } from '../AccountNfts/types'
import { isPureNft } from '@perawallet/wallet-core-assets'
import { getVerificationIcon } from '@modules/assets/utils/verification'

export const CollectibleGridItem = ({
    asset,
    amount,
    onPress,
}: CollectibleItemProps) => {
    const styles = useStyles()
    const collectible = asset.peraMetadata?.collectible
    const isPure = isPureNft(asset)
    const thumbnailUrl = collectible?.primaryImage ?? asset.peraMetadata?.logo
    const showAmount = !isPure && !amount.isZero()
    const verificationIconName = useMemo(() => {
        const tier = asset.peraMetadata?.verificationTier
        return tier ? getVerificationIcon(tier) : null
    }, [asset.peraMetadata?.verificationTier])

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
                {showAmount && (
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
                {collectible?.collection?.name && (
                    <PWText
                        variant='caption'
                        style={styles.collectionName}
                        numberOfLines={1}
                    >
                        {collectible.collection.name}
                    </PWText>
                )}
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='body'
                        style={styles.title}
                        numberOfLines={2}
                    >
                        {collectible?.title ?? asset.name ?? `#${asset.assetId}`}
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
