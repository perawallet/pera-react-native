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

import type { Decimal } from 'decimal.js'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import {
    type PWIconSize,
    type PWTouchableOpacityProps,
    PWView,
} from '@components/core'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { type ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useStyles } from './styles'
import { type ReactNode } from 'react'
import { CollectibleListItem } from '../CollectibleListItem'
import { AssetItemView } from './AssetItemView'
import { AssetRowSkeleton } from '../AssetRowSkeleton'
import { useAccountAssetItemView } from './useAccountAssetItemView'

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
    /** The holding's own chain and network. */
    scope: ChainScope
    /** Replaces the secondary line under the name, such as the holding's network. */
    subtitle?: ReactNode
    /** A further line under the secondary one, such as the holding's chain. */
    footer?: ReactNode
    /** Draws the holding's network on its icon. */
    showChainBadge?: boolean
} & PWTouchableOpacityProps

export const AccountAssetItemView = ({
    accountBalance,
    usdPrice,
    iconSize,
    logoUrl,
    showBalance = true,
    skipFetch = false,
    showFrozenBadge = false,
    scope,
    subtitle,
    footer,
    showChainBadge = false,
    onPress,
    ...rest
}: AccountAssetItemViewProps) => {
    const styles = useStyles()

    const { asset, item } = useAccountAssetItemView({
        accountBalance,
        skipFetch,
        scope,
    })

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
        return <AssetRowSkeleton style={rest.style} />
    }

    const balance = (
        <PWView style={styles.amountContainer}>
            <AssetAmount
                asset={asset}
                chainId={scope.chainId}
                value={accountBalance.amount}
                density='list'
                isUnitShrinkable
                style={styles.primaryAmount}
                numberOfLines={1}
            />
            <PreferredAmount
                sourceAmount={accountBalance.amount}
                sourceAssetId={accountBalance.assetId}
                scope={scope}
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
            chainId={scope.chainId}
            right={showBalance ? balance : undefined}
            shouldCapRightSlot
            logoUrl={logoUrl}
            iconSize={iconSize}
            showFavorite
            showDeletedLabel
            showFrozenBadge={showFrozenBadge}
            copyableAssetId
            subtitle={subtitle}
            footer={footer}
            showChainBadge={showChainBadge}
            onPress={onPress}
            {...rest}
        />
    )
}
