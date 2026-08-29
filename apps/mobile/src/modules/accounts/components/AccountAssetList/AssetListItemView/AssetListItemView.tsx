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

import React, { useMemo } from 'react'
import {
    type GestureResponderEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native'
import { AssetAmount } from '@components/AssetAmount'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { PWView } from '@components/core'
import { isCollectible } from '@perawallet/wallet-core-assets'
import {
    assetFromHoldingLiteRow,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'
import { isAlgoAssetId, pow10 } from '@perawallet/wallet-core-shared'
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
            {/* No unit next to the figure: the row already carries it under the
                asset name, and a long one squeezed the amount out.
                ALGO keeps its glyph — that's the brand mark, not a unit name. */}
            <AssetAmount
                asset={asset}
                value={amount}
                density='compact'
                showSymbol={isAlgoAssetId(holding.assetId)}
                style={styles.primaryAmount}
                numberOfLines={1}
            />
            {/* Dynamic currency: usually the preferred currency, but ALGO-
                denominated holdings fall back to the fiat currency when the
                preferred currency is ALGO (see useAssetListFiat). Must honor
                fiat.displayCurrency, so this is CurrencyAmount (not
                PreferredAmount, which would force the ALGO label onto a fiat
                value). */}
            <CurrencyAmount
                currency={fiat.displayCurrency}
                value={fiat.value}
                precision='compact'
                showSymbol
                variant='body'
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
