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
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import type { IconName } from '@components/core'
import type { AssetSearchItem as AssetSearchItemType } from '@perawallet/wallet-core-assets'
import { useStyles } from './styles'

type AssetSearchItemProps = {
    item: AssetSearchItemType
    isOptedIn: boolean
    isOptingIn: boolean
    onAdd: (assetId: string) => void
}

const VERIFICATION_ICON_MAP: Record<string, IconName | null> = {
    verified: 'assets/verified',
    trusted: 'assets/trusted',
    suspicious: 'assets/suspicious',
    unverified: null,
}

export const AssetSearchItem = ({
    item,
    isOptedIn,
    isOptingIn,
    onAdd,
}: AssetSearchItemProps) => {
    const styles = useStyles()

    const verificationIcon =
        VERIFICATION_ICON_MAP[item.verificationTier] ?? null

    const subtitle = [item.unitName, item.assetId]
        .filter(Boolean)
        .join(' · ')

    return (
        <>
            <PWTouchableOpacity
                style={styles.container}
                onPress={() => onAdd(item.assetId)}
                disabled={isOptedIn || isOptingIn}
            >
                <PWView style={styles.assetIcon}>
                    {item.logo ? (
                        <PWImage
                            source={{ uri: item.logo }}
                            style={styles.assetIcon}
                        />
                    ) : (
                        <PWText variant='body'>
                            {(item.unitName ?? item.name ?? '?')
                                .charAt(0)
                                .toUpperCase()}
                        </PWText>
                    )}
                </PWView>

                <PWView style={styles.infoContainer}>
                    <PWView style={styles.titleRow}>
                        <PWText
                            variant='body'
                            numberOfLines={1}
                            style={styles.titleText}
                        >
                            {item.name ?? `Asset ${item.assetId}`}
                        </PWText>
                        {verificationIcon ? (
                            <PWIcon
                                name={verificationIcon}
                                size='xs'
                                style={styles.verificationIcon}
                            />
                        ) : null}
                    </PWView>
                    <PWText
                        variant='caption'
                        numberOfLines={1}
                        style={styles.subtitle}
                    >
                        {subtitle}
                    </PWText>
                </PWView>

                <PWView style={styles.actionButton}>
                    {isOptingIn ? (
                        <ActivityIndicator size='small' />
                    ) : isOptedIn ? (
                        <PWIcon
                            name='check'
                            size='sm'
                            variant='positive'
                        />
                    ) : (
                        <PWIcon
                            name='plus'
                            size='sm'
                            variant='primary'
                        />
                    )}
                </PWView>
            </PWTouchableOpacity>
            <PWView style={styles.separator} />
        </>
    )
}
