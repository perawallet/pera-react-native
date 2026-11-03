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
import { useTheme } from '@rneui/themed'
import {
    getIconPixelSize,
    PWText,
    PWTouchableOpacity,
    PWView,
    PWIcon,
} from '@components/core'
import { ChainIcon } from '@modules/chain-ui/icon'
import { CollectibleThumbnail } from '../CollectibleThumbnail'
import { useStyles } from './styles'
import type { CollectibleItemProps } from '@modules/assets/types/collectible'
import { useCollectibleItem } from '@modules/assets/hooks/useCollectibleItem'

// Physical pixels for the Prism resize: a 2-column tile is ~200pt at most,
// so 600px covers 3x displays without downloading the full-size original.
const GRID_IMAGE_WIDTH = 600

const CollectibleGridItemBase = ({
    item,
    onPress,
    networkChainId,
}: CollectibleItemProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
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
                    imageWidth={GRID_IMAGE_WIDTH}
                />
                {networkChainId && (
                    <PWView style={styles.networkBadge}>
                        <ChainIcon
                            chainId={networkChainId}
                            size={getIconPixelSize(theme, 'sm')}
                        />
                    </PWView>
                )}
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
