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

import { type Decimal } from 'decimal.js'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import {
    type PWIconSize,
    type PWTouchableOpacityProps,
    PWView,
} from '@components/core'
import { isCollectible, useAssetsQuery } from '@perawallet/wallet-core-assets'
import { type AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { isAlgoAssetId } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useMemo } from 'react'
import { CollectibleListItem } from '../CollectibleListItem'
import { AssetItemView } from './AssetItemView'
import { AssetRowSkeleton } from '../AssetRowSkeleton'

export type AccountAssetItemViewProps = {
    accountBalance: AssetWithAccountBalance
    usdPrice?: Decimal
    iconSize?: PWIconSize
    /** Logo URL forwarded to the asset icon, bypassing Prism optimization. */
    logoUrl?: string
    showBalance?: boolean
    skipFetch?: boolean
    /** Marks a holding-level frozen asset (selection contexts). */
    showFrozenBadge?: boolean
} & PWTouchableOpacityProps

export const AccountAssetItemView = ({
    accountBalance,
    usdPrice,
    iconSize,
    logoUrl,
    showBalance = true,
    skipFetch = false,
    showFrozenBadge = false,
    onPress,
    ...rest
}: AccountAssetItemViewProps) => {
    const styles = useStyles()

    // Use pre-fetched asset data when available to avoid N+1 queries.
    // Falls back to individual fetch for callers that don't populate
    // accountBalance.asset. The main asset list passes skipFetch so all
    // rows share a single empty-array query and don't create a separate
    // RQ observer per row, which would saturate the JS thread on large
    // watch accounts.
    const assetIds = useMemo(
        () =>
            skipFetch || accountBalance.asset ? [] : [accountBalance.assetId],
        [skipFetch, accountBalance.asset, accountBalance.assetId],
    )
    const { data: fetchedAssets } = useAssetsQuery(assetIds)

    const asset = useMemo(() => {
        return (
            fetchedAssets?.get(accountBalance.assetId) ?? accountBalance.asset
        )
    }, [accountBalance.asset, fetchedAssets, accountBalance.assetId])

    const item = useMemo(() => {
        if (asset && isCollectible(asset)) {
            return {
                assetId: accountBalance.assetId,
                asset,
                collectible: asset.peraMetadata?.collectible,
                amount: accountBalance.amount,
            }
        }
        return null
    }, [asset, accountBalance])

    if (item) {
        // Forward the list's row style (shared horizontal padding) so a
        // collectible row's thumbnail lines up with the fungible rows beside
        // it — otherwise the NFT icon sits flush-left, unindented.
        return (
            <CollectibleListItem
                item={item}
                // PWListItemLayout has no disabled prop; dropping the handler
                // makes a frozen collectible row non-selectable.
                onPress={rest.disabled ? undefined : onPress}
                style={rest.style}
                showFrozenBadge={showFrozenBadge}
            />
        )
    }

    if (!asset) {
        return <AssetRowSkeleton />
    }

    const balance = (
        <PWView style={styles.amountContainer}>
            {/* No unit next to the figure: the row already carries it under the
                asset name, and a long one squeezed the amount out (PERA-4733).
                ALGO keeps its glyph — that's the brand mark, not a unit name. */}
            <AssetAmount
                asset={asset}
                value={accountBalance.amount}
                density='compact'
                showSymbol={isAlgoAssetId(accountBalance.assetId)}
                style={styles.primaryAmount}
                numberOfLines={1}
            />
            <PreferredAmount
                sourceAmount={accountBalance.amount}
                sourceAssetId={accountBalance.assetId}
                usdPrice={usdPrice}
                density='compact'
                showSymbol
                style={styles.secondaryAmount}
            />
        </PWView>
    )

    return (
        <AssetItemView
            asset={asset}
            right={showBalance ? balance : undefined}
            logoUrl={logoUrl}
            iconSize={iconSize}
            showFavorite
            showDeletedLabel
            showFrozenBadge={showFrozenBadge}
            copyableAssetId
            onPress={onPress}
            {...rest}
        />
    )
}
