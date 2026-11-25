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

import { useTheme } from '@rneui/themed'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    PWIcon,
    PWView,
    type IconName,
    type PWIconSize,
} from '@components/core'
import { AssetIcon } from '@components/AssetIcon'
import { TransactionIcon } from '@components/TransactionIcon'
import { ChainIcon } from '@modules/chain-ui/icon'
import { useStyles, type TransactionLeadingIconSize } from './styles'

export type LeadingAsset = { chainId: ChainId; asset: DisplayableAsset }

export type TransactionLeadingIconProps = {
    iconName: IconName
    /** A send's or receive's asset, or a swap's from and to; empty for any other transaction. */
    leadingAssets: LeadingAsset[]
    /** The networks to lead with when no asset does; empty shows the kind icon alone. */
    chainIds: ChainId[]
    /** `md` fills a list row's leading slot, `lg` a detail screen's hero. */
    size?: TransactionLeadingIconSize
}

const ICON_SIZES: Record<
    TransactionLeadingIconSize,
    {
        asset: PWIconSize
        pairAsset: PWIconSize
        badgeGlyph: PWIconSize
        kind: 'md' | 'lg'
    }
> = {
    md: { asset: 'xl', pairAsset: 'lg', badgeGlyph: 'sm', kind: 'md' },
    lg: { asset: 'xxl', pairAsset: 'xl', badgeGlyph: 'md', kind: 'lg' },
}

export const TransactionLeadingIcon = ({
    iconName,
    leadingAssets,
    chainIds,
    size = 'md',
}: TransactionLeadingIconProps) => {
    const styles = useStyles({ size })
    const { theme } = useTheme()
    const sizes = ICON_SIZES[size]

    const kindBadge = (
        <PWView
            style={styles.kindBadge}
            testID={`transaction_kind_badge_${iconName}`}
        >
            <PWIcon
                name={iconName}
                size={sizes.badgeGlyph}
                variant='buttonPrimary'
            />
        </PWView>
    )

    if (leadingAssets.length === 2) {
        const [from, to] = leadingAssets
        return (
            <PWView style={styles.pair}>
                <AssetIcon
                    chainId={from.chainId}
                    asset={from.asset}
                    size={sizes.pairAsset}
                    style={styles.pairFrom}
                />
                <PWView style={styles.pairTo}>
                    <AssetIcon
                        chainId={to.chainId}
                        asset={to.asset}
                        size={sizes.pairAsset}
                    />
                </PWView>
            </PWView>
        )
    }

    if (leadingAssets.length === 1) {
        const [{ chainId, asset }] = leadingAssets
        return (
            <PWView>
                <AssetIcon
                    chainId={chainId}
                    asset={asset}
                    size={sizes.asset}
                />
                {kindBadge}
            </PWView>
        )
    }

    if (chainIds.length > 0) {
        const single =
            size === 'lg' ? theme.spacing['4xl'] : theme.spacing['3xl']
        const stacked = size === 'lg' ? theme.spacing['3xl'] : theme.spacing.xxl
        return (
            <PWView style={styles.chains}>
                {chainIds.map((chainId, index) => (
                    <PWView
                        key={chainId}
                        style={index > 0 ? styles.stackedChain : undefined}
                    >
                        <ChainIcon
                            chainId={chainId}
                            size={chainIds.length > 1 ? stacked : single}
                        />
                    </PWView>
                ))}
                {kindBadge}
            </PWView>
        )
    }

    return (
        <TransactionIcon
            name={iconName}
            size={sizes.kind}
        />
    )
}
