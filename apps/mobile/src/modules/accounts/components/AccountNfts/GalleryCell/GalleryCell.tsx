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

import React, { useCallback, useMemo } from 'react'
import { PWView } from '@components/core'
import { useStyles } from './styles'
import { CollectibleGridItem, CollectibleListItem } from '@modules/assets'
import {
    assetFromHoldingLiteRow,
    type AccountCollectibleLiteRow,
} from '@perawallet/wallet-core-accounts'
import { GRID_COLUMNS } from '../constants'

export type GalleryCellProps = {
    item: AccountCollectibleLiteRow
    index: number
    isGrid: boolean
    onPress: (item: AccountCollectibleLiteRow) => void
}

const GalleryCellView = ({
    item,
    index,
    isGrid,
    onPress,
}: GalleryCellProps) => {
    const styles = useStyles()
    // The row components are memoised, so they need a press handler whose
    // identity survives a parent re-render. Building the closure here — inside
    // a cell that only re-renders when its own item changes — is what makes
    // that memo actually skip work.
    const handlePress = useCallback(() => onPress(item), [onPress, item])

    // Metadata is parsed here rather than in the query so a 15k-collectible
    // account only pays for the cells on screen.
    const displayItem = useMemo(() => {
        const asset = assetFromHoldingLiteRow(item, item.scope.chainId)
        if (!asset) return null
        return {
            assetId: item.assetId,
            asset,
            collectible: asset.peraMetadata?.collectible,
            amount: item.amount,
        }
    }, [item])

    if (!displayItem) return null

    if (!isGrid) {
        return (
            <CollectibleListItem
                item={displayItem}
                onPress={handlePress}
            />
        )
    }

    return (
        <PWView
            style={[
                styles.gridColumn,
                index % GRID_COLUMNS === 0
                    ? styles.gridColumnLeft
                    : styles.gridColumnRight,
            ]}
        >
            <CollectibleGridItem
                item={displayItem}
                onPress={handlePress}
            />
        </PWView>
    )
}

export const GalleryCell = React.memo(GalleryCellView)
