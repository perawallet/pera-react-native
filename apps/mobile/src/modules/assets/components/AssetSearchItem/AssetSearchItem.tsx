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
import { ActivityIndicator } from 'react-native'
import {
    PWButton,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import type { AssetSearchItem as AssetSearchItemType } from '@perawallet/wallet-core-assets'
import { useStyles } from './styles'

type AssetSearchItemProps = {
    item: AssetSearchItemType
    isOptedIn: boolean
    isOptingIn: boolean
    onAdd: (assetId: string) => void
    addLabel: string
    addedLabel: string
}

export const AssetSearchItem = ({
    item,
    isOptedIn,
    isOptingIn,
    onAdd,
    addLabel,
    addedLabel,
}: AssetSearchItemProps) => {
    const styles = useStyles({ isOptedIn })

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={() => !isOptedIn && !isOptingIn && onAdd(item.assetId)}
            disabled={isOptedIn || isOptingIn}
        >
            <PWView style={styles.iconContainer}>
                {item.logo ? (
                    <PWImage
                        source={{ uri: item.logo }}
                        style={styles.iconContainer}
                    />
                ) : (
                    <PWText
                        variant='caption'
                        style={styles.secondaryText}
                    >
                        {(item.unitName ?? item.name ?? '?')
                            .charAt(0)
                            .toUpperCase()}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.infoContainer}>
                <PWView style={styles.nameRow}>
                    <PWText
                        variant='body'
                        numberOfLines={1}
                    >
                        {item.name ?? `Asset #${item.assetId}`}
                    </PWText>
                    {item.unitName ? (
                        <PWText
                            variant='caption'
                            style={styles.unitName}
                        >
                            {item.unitName}
                        </PWText>
                    ) : null}
                </PWView>
                <PWText
                    variant='caption'
                    style={styles.secondaryText}
                >
                    ID: {item.assetId}
                </PWText>
            </PWView>

            <PWView style={styles.actionContainer}>
                {isOptingIn ? (
                    <ActivityIndicator />
                ) : (
                    <PWButton
                        title={isOptedIn ? addedLabel : addLabel}
                        variant={isOptedIn ? 'secondary' : 'primary'}
                        onPress={() => onAdd(item.assetId)}
                        isDisabled={isOptedIn}
                    />
                )}
            </PWView>
        </PWTouchableOpacity>
    )
}
