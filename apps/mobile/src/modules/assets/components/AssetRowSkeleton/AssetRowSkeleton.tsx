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
import type { StyleProp, ViewStyle } from 'react-native'
import { PWSkeleton, PWView } from '@components/core'
import { useStyles } from './styles'

export type AssetRowSkeletonProps = {
    /** Number of skeleton rows to render. Defaults to a single row. */
    count?: number
    /** Outer spacing, as the caller gives the loaded row. */
    style?: StyleProp<ViewStyle>
}

const SkeletonRow = ({ style }: Pick<AssetRowSkeletonProps, 'style'>) => {
    const styles = useStyles()
    return (
        <PWView style={[styles.container, style]}>
            <PWSkeleton
                circle
                height={styles.icon.width}
                width={styles.icon.width}
            />
            <PWView style={styles.textColumn}>
                <PWView style={styles.primaryLine}>
                    <PWSkeleton
                        height={styles.nameBar.height}
                        style={styles.nameBar}
                    />
                </PWView>
                <PWView style={styles.secondaryLine}>
                    <PWSkeleton
                        height={styles.subtitleBar.height}
                        style={styles.subtitleBar}
                    />
                </PWView>
            </PWView>
            <PWView style={styles.amountColumn}>
                <PWView style={styles.primaryLine}>
                    <PWSkeleton
                        height={styles.amountBar.height}
                        width={styles.amountBar.width}
                    />
                </PWView>
                <PWView style={styles.secondaryLine}>
                    <PWSkeleton
                        height={styles.fiatBar.height}
                        width={styles.fiatBar.width}
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}

/**
 * Shared loading placeholder for an asset row (icon, name and subtitle, amount
 * and fiat value), sized to match the loaded `AssetItemView` so swapping
 * skeleton↔content doesn't shift layout. Used by the account asset list, the
 * asset-row metadata-loading state, and the swap asset selection list.
 */
export const AssetRowSkeleton = ({
    count = 1,
    style,
}: AssetRowSkeletonProps) => {
    if (count <= 1) return <SkeletonRow style={style} />
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <SkeletonRow
                    key={i}
                    style={style}
                />
            ))}
        </>
    )
}
