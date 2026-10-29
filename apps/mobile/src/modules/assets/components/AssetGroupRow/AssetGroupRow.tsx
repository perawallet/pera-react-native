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
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { AssetIcon } from '@components/AssetIcon'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIconStack } from '@modules/chain-ui/icon'
import { AssetRowSkeleton } from '../AssetRowSkeleton'
import type { AssetFiatConverter } from '../../hooks/useAssetListFiatConverter'
import type {
    AssetGroupItem,
    GroupableHolding,
} from '../../utils/groupedHoldings'
import { useAssetGroupRow } from './useAssetGroupRow'
import { useStyles } from './styles'

export type AssetGroupRowProps<T extends GroupableHolding> = {
    item: AssetGroupItem<T>
    convertFiat: AssetFiatConverter
    onToggleExpanded: () => void
    style?: StyleProp<ViewStyle>
}

const AssetGroupRowBase = <T extends GroupableHolding>({
    item,
    convertFiat,
    onToggleExpanded,
    style,
}: AssetGroupRowProps<T>) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { group, amount, isExpanded } = item

    const {
        icon,
        iconChainId,
        verificationIcon,
        isSuspicious,
        subtitle,
        chainIds,
        fiat,
    } = useAssetGroupRow({ item, convertFiat })

    if (!icon) {
        return <AssetRowSkeleton style={style} />
    }

    return (
        <PWTouchableOpacity
            testID={`asset_group_row_${group.id}`}
            onPress={onToggleExpanded}
            style={[styles.container, style]}
        >
            <PWView style={styles.summaryRow}>
                <AssetIcon
                    chainId={iconChainId}
                    asset={icon}
                    size='xl'
                />
                <PWView style={styles.info}>
                    <PWView style={styles.titleRow}>
                        <PWText
                            variant='h4'
                            style={
                                isSuspicious
                                    ? styles.suspiciousTitle
                                    : styles.title
                            }
                            numberOfLines={1}
                        >
                            {group.name}
                        </PWText>
                        {verificationIcon ? (
                            <PWIcon
                                name={verificationIcon}
                                size='xs'
                                testID='asset_group_row_verification'
                            />
                        ) : null}
                    </PWView>
                    <PWText
                        variant='body'
                        style={styles.subtitle}
                        numberOfLines={1}
                    >
                        {subtitle}
                    </PWText>
                </PWView>
                <PWView style={styles.amountContainer}>
                    {/* The group's symbol is the unit; the figure carries none, as
                        on a single asset's row. */}
                    <CurrencyAmount
                        currency=''
                        assetId=''
                        chainId={null}
                        value={amount}
                        precision='compact'
                        style={styles.primaryAmount}
                        numberOfLines={1}
                    />
                    <CurrencyAmount
                        currency={fiat.displayCurrency}
                        assetId={null}
                        chainId={null}
                        isFiat
                        value={fiat.value}
                        precision='compact'
                        showSymbol
                        variant='body'
                        style={styles.secondaryAmount}
                        numberOfLines={1}
                    />
                </PWView>
            </PWView>
            <PWView style={styles.networksRow}>
                <PWView style={styles.networksToggle}>
                    <PWText
                        variant='h4'
                        style={styles.networksToggleLabel}
                        numberOfLines={1}
                    >
                        {isExpanded
                            ? t('account_details.assets.hide_networks')
                            : t('account_details.assets.see_networks')}
                    </PWText>
                    <PWIcon
                        name='chevron-down'
                        size='sm'
                        variant='positive'
                        style={isExpanded ? styles.chevronExpanded : undefined}
                    />
                </PWView>
                <ChainIconStack chainIds={chainIds} />
            </PWView>
        </PWTouchableOpacity>
    )
}

export const AssetGroupRow = React.memo(
    AssetGroupRowBase,
) as typeof AssetGroupRowBase
