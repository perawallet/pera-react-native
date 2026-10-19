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
import type {
    GestureResponderEvent,
    StyleProp,
    ViewStyle,
} from 'react-native'
import { Decimal } from 'decimal.js'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { AssetIcon } from '@components/AssetIcon'
import { CurrencyAmount } from '@components/CurrencyAmount'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { AssetRowSkeleton } from '../AssetRowSkeleton'
import type {
    AssetFiatConverter,
    AssetFiatValue,
} from '../../hooks/useAssetListFiatConverter'
import type {
    AssetGroupItem,
    GroupableHolding,
} from '../../utils/groupedHoldings'
import { NetworkIconStack } from './NetworkIconStack'
import { useStyles } from './styles'

export type AssetGroupRowProps<T extends GroupableHolding> = {
    item: AssetGroupItem<T>
    convertFiat: AssetFiatConverter
    /** Unset: the whole row toggles, as in pickers where a group isn't selectable. */
    onPress?: () => void
    onToggleExpanded: () => void
    style?: StyleProp<ViewStyle>
}

const AssetGroupRowBase = <T extends GroupableHolding>({
    item,
    convertFiat,
    onPress,
    onToggleExpanded,
    style,
}: AssetGroupRowProps<T>) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { group, members, amount, isExpanded } = item

    const icon = members[0]?.asset ?? null

    const chainIds = useMemo(
        () => members.map(member => member.holding.scope.chainId),
        [members],
    )

    // One unknown member makes the whole value unknown: a partial sum would
    // understate the holding.
    const fiat = useMemo((): Nullable<AssetFiatValue> => {
        let total: Nullable<Decimal> = new Decimal(0)
        let displayCurrency: Nullable<string> = null
        for (const { holding, displayAmount, usdPrice } of members) {
            if (displayAmount === null) return null
            const converted = convertFiat(
                { chainId: holding.scope.chainId, assetId: holding.assetId },
                usdPrice,
                displayAmount,
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

    // Nested in the row's touchable: on web the click would otherwise bubble
    // up and open the asset too.
    const handleTogglePress = useCallback(
        (event: GestureResponderEvent) => {
            event.stopPropagation()
            onToggleExpanded()
        },
        [onToggleExpanded],
    )

    if (!icon) {
        return <AssetRowSkeleton />
    }

    const toggle = (
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
            <NetworkIconStack chainIds={chainIds} />
        </PWView>
    )

    return (
        <PWTouchableOpacity
            testID={`asset_group_row_${group.id}`}
            onPress={onPress ?? onToggleExpanded}
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
                {onPress ? (
                    <PWTouchableOpacity
                        testID={`asset_group_toggle_${group.id}`}
                        onPress={handleTogglePress}
                        style={styles.toggle}
                    >
                        {toggle}
                    </PWTouchableOpacity>
                ) : (
                    toggle
                )}
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

export const AssetGroupRow = React.memo(
    AssetGroupRowBase,
) as typeof AssetGroupRowBase
