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
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native'
import { AssetAmount } from '@components/AssetAmount'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { PWDivider, PWView } from '@components/core'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { type AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import {
    AssetItemView,
    CollectibleListItem,
    AssetRowSkeleton,
    type AssetFiatConverter,
} from '@modules/assets'
import { ChainLabel } from '@modules/chain-ui/icon'
import { useStyles } from './styles'
import { useAssetListItemView } from './useAssetListItemView'

export type AssetListItemViewProps = {
    holding: AccountHoldingsLiteRow
    chainId: ChainId
    /** Listed under its group: a header above the row names its network. */
    isGroupMember?: boolean
    /** The account spans more than one chain: the icon names its network (a group member's header names it instead). */
    shouldShowChainBadge?: boolean
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
    chainId,
    isGroupMember = false,
    shouldShowChainBadge = false,
    convertFiat,
    onPress,
    style,
}: AssetListItemViewProps) => {
    const styles = useStyles()

    const { asset, displayAmount, fiat, fiatAssetId, collectibleItem } =
        useAssetListItemView({ holding, chainId, convertFiat })

    if (!asset) {
        return <AssetRowSkeleton style={style} />
    }

    if (collectibleItem) {
        return (
            <CollectibleListItem
                item={collectibleItem}
                onPress={onPress}
            />
        )
    }

    const amount = (
        <AssetAmount
            chainId={chainId}
            asset={asset}
            value={displayAmount}
            density='list'
            variant='body'
            style={styles.amount}
            numberOfLines={1}
        />
    )
    // An unpriced asset shows no value rather than a placeholder.
    const value =
        fiat.value == null ? undefined : (
            // Dynamic currency: usually the preferred currency, but ALGO-
            // denominated holdings fall back to the fiat currency when the
            // preferred currency is ALGO (see useAssetListFiatConverter). Must
            // honor fiat.displayCurrency, so this is CurrencyAmount (not
            // PreferredAmount, which would force the ALGO label onto a fiat value).
            <CurrencyAmount
                chainId={chainId}
                currency={fiat.displayCurrency}
                assetId={fiatAssetId}
                isFiat={fiatAssetId === null}
                value={fiat.value}
                precision='compact'
                showSymbol
                style={styles.value}
                numberOfLines={1}
            />
        )

    const row = (
        <AssetItemView
            asset={asset}
            chainId={chainId}
            right={value}
            shouldCapRightSlot
            shouldTopAlignRight
            subtitle={amount}
            showChainBadge={shouldShowChainBadge && !isGroupMember}
            iconSize={isGroupMember ? 'md' : undefined}
            showFavorite
            showDeletedLabel
            copyableAssetId
            onPress={onPress}
            style={isGroupMember ? styles.groupMember : style}
        />
    )

    if (!isGroupMember) {
        return row
    }
    // The list's row margin stays off the wrapper: a member spaces itself
    // (groupMember), and both would stack under it.
    return (
        <PWView>
            <PWView style={styles.networkHeader}>
                <PWDivider style={styles.networkHeaderLine} />
                <ChainLabel chainId={chainId} />
                <PWDivider style={styles.networkHeaderLine} />
            </PWView>
            {row}
        </PWView>
    )
}

export const AssetListItemView = React.memo(AssetListItemViewBase)
