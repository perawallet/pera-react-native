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
import { Decimal } from 'decimal.js'
import { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PWView } from '@components/core'
import { isCollectible } from '@perawallet/wallet-core-assets'
import {
    assetFromHoldingLiteRow,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'
import { AssetItemView } from '@modules/assets/components/AssetItem/AssetItemView'
import { CollectibleListItem } from '@modules/assets/components/CollectibleListItem'
import { AssetRowSkeleton } from '@modules/assets/components/AssetRowSkeleton'
import type { AssetFiatConverter } from '../useAssetListFiat'
import { useStyles } from './styles'

export type AssetListItemViewProps = {
    holding: AccountHoldingsLiteRow
    /** List-level converter; the row converts its own value (observer-free). */
    convertFiat: AssetFiatConverter
    onPress?: (event: GestureResponderEvent) => void
    style?: StyleProp<ViewStyle>
}

// 10^decimals reused across the handful of visible rows.
const POW10_CACHE = new Map<number, Decimal>()
const pow10 = (decimals: number): Decimal => {
    let value = POW10_CACHE.get(decimals)
    if (!value) {
        value = new Decimal(10).pow(decimals)
        POW10_CACHE.set(decimals, value)
    }
    return value
}

/**
 * Asset-list-only row. It receives a lightweight holding row and materializes
 * everything it needs — the `PeraAsset` (parsing metadata), the display-unit
 * amount and the preferred-currency value — **lazily, only for rendered rows**.
 * Because FlashList virtualizes, that's a handful of rows at a time instead of
 * all N on every data change, which is what blanked the list during a large
 * account's sync. No per-row price/rate React Query observers are mounted.
 */
const AssetListItemViewBase = ({
    holding,
    convertFiat,
    onPress,
    style,
}: AssetListItemViewProps) => {
    const styles = useStyles()

    const asset = useMemo(() => assetFromHoldingLiteRow(holding), [holding])

    const amount = useMemo(
        () =>
            asset ? holding.amount.div(pow10(asset.decimals)) : holding.amount,
        [holding.amount, asset],
    )

    const fiat = useMemo(
        () => convertFiat(holding.assetId, holding.usdPrice, amount),
        [convertFiat, holding.assetId, holding.usdPrice, amount],
    )

    const collectibleItem = useMemo(() => {
        if (asset && isCollectible(asset)) {
            return {
                assetId: holding.assetId,
                asset,
                collectible: asset.peraMetadata?.collectible,
                amount,
            }
        }
        return null
    }, [asset, holding.assetId, amount])

    if (!asset) {
        return <AssetRowSkeleton />
    }

    if (collectibleItem) {
        return (
            <CollectibleListItem
                item={collectibleItem}
                onPress={onPress}
            />
        )
    }

    const balance = (
        <PWView style={styles.amountContainer}>
            <CurrencyDisplay
                currency={asset.unitName ?? ''}
                value={amount}
                precision={asset.decimals}
                minPrecision={2}
                showSymbol
                style={styles.primaryAmount}
                numberOfLines={1}
            />
            <CurrencyDisplay
                currency={fiat.displayCurrency}
                value={fiat.value}
                precision={2}
                minPrecision={2}
                showSymbol
                variant='caption'
                style={styles.secondaryAmount}
                numberOfLines={1}
            />
        </PWView>
    )

    return (
        <AssetItemView
            asset={asset}
            right={balance}
            showFavorite
            showDeletedLabel
            copyableAssetId
            onPress={onPress}
            style={style}
        />
    )
}

export const AssetListItemView = React.memo(AssetListItemViewBase)
