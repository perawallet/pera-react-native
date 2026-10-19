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
import type { StyleProp, ViewStyle } from 'react-native'
import { Decimal } from 'decimal.js'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { AssetIcon } from '@components/AssetIcon'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { assetFromHoldingLiteRow } from '@perawallet/wallet-core-accounts'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { AssetRowSkeleton } from '@modules/assets'
import { useLanguage } from '@hooks/useLanguage'
import type { AssetListItem } from '../assetListItems'
import type { AssetFiatConverter, AssetFiatValue } from '../useAssetListFiat'
import { useStyles } from './styles'

export type AssetGroupListItemViewProps = {
    item: Extract<AssetListItem, { kind: 'group' }>
    convertFiat: AssetFiatConverter
    onPress: () => void
    style?: StyleProp<ViewStyle>
}

const AssetGroupListItemViewBase = ({
    item,
    convertFiat,
    onPress,
    style,
}: AssetGroupListItemViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { group, members, amount, isExpanded } = item

    const icon = useMemo(() => {
        const [first] = members
        return first
            ? assetFromHoldingLiteRow(first, first.scope.chainId)
            : null
    }, [members])

    // One unknown member makes the whole value unknown: a partial sum would
    // understate the holding.
    const fiat = useMemo((): Nullable<AssetFiatValue> => {
        let total: Nullable<Decimal> = new Decimal(0)
        let displayCurrency: Nullable<string> = null
        for (const member of members) {
            const asset = assetFromHoldingLiteRow(member, member.scope.chainId)
            if (!asset) return null
            const converted = convertFiat(
                { chainId: member.scope.chainId, assetId: member.assetId },
                member.usdPrice,
                baseUnitsToDisplayUnits(member.amount, asset.decimals),
            )
            displayCurrency ??= converted.displayCurrency
            total =
                total === null ||
                converted.value === null ||
                converted.displayCurrency !== displayCurrency
                    ? null
                    : total.plus(converted.value)
        }
        return displayCurrency === null
            ? null
            : { displayCurrency, value: total }
    }, [members, convertFiat])

    if (!icon) {
        return <AssetRowSkeleton />
    }

    return (
        <PWTouchableOpacity
            testID={`asset_group_row_${group.id}`}
            onPress={onPress}
            style={[styles.container, style]}
        >
            <AssetIcon
                asset={icon}
                logoUrl={group.logoUrl ?? undefined}
                size='xl'
            />
            <PWView style={styles.info}>
                <PWText
                    variant='h4'
                    style={styles.title}
                    numberOfLines={1}
                >
                    {group.name}
                </PWText>
                <PWView style={styles.networksRow}>
                    <PWText
                        variant='body'
                        style={styles.subtitle}
                        numberOfLines={1}
                    >
                        {isExpanded
                            ? t('account_details.assets.hide_networks')
                            : t('account_details.assets.see_networks')}
                    </PWText>
                    <PWIcon
                        name='chevron-down'
                        size='xs'
                        style={isExpanded ? styles.chevronExpanded : undefined}
                    />
                </PWView>
            </PWView>
            <PWView style={styles.amountContainer}>
                {/* The group's symbol is the unit; the figure carries none, as
                    on a single asset's row. */}
                <CurrencyAmount
                    currency=''
                    assetId=''
                    value={amount}
                    precision='compact'
                    style={styles.primaryAmount}
                    numberOfLines={1}
                />
                <CurrencyAmount
                    currency={fiat?.displayCurrency ?? ''}
                    assetId={null}
                    value={fiat?.value}
                    precision='compact'
                    showSymbol
                    variant='body'
                    style={styles.secondaryAmount}
                    numberOfLines={1}
                />
            </PWView>
        </PWTouchableOpacity>
    )
}

export const AssetGroupListItemView = React.memo(AssetGroupListItemViewBase)
