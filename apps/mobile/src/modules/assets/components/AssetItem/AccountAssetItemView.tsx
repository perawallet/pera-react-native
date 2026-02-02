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

import { AssetIcon } from '../AssetIcon'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PWIcon, PWIconSize, PWText, PWView, PWViewProps } from '@components/core'
import { ALGO_ASSET_ID, useAssetsQuery } from '@perawallet/wallet-core-assets'
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { useTheme } from '@rneui/themed'
import { useStyles } from './styles'
import { useMemo } from 'react'
import { useCurrency } from '@perawallet/wallet-core-currencies'

export type AccountAssetItemViewProps = {
    accountBalance: AssetWithAccountBalance
    iconSize?: PWIconSize
} & PWViewProps

export const AccountAssetItemView = ({
    accountBalance,
    iconSize,
    ...rest
}: AccountAssetItemViewProps) => {
    const { theme } = useTheme()
    const styles = useStyles()

    const { preferredFiatCurrency } = useCurrency()
    const { data: assets } = useAssetsQuery([accountBalance.assetId])

    const asset = useMemo(() => {
        return assets?.get(accountBalance.assetId)
    }, [assets, accountBalance.assetId])

    const isAlgo = useMemo(
        () => asset?.assetId === ALGO_ASSET_ID,
        [asset?.assetId],
    )

    const verificationIcon = useMemo(() => {
        if (isAlgo) {
            return (
                <PWIcon
                    name='assets/trusted'
                    size='xs'
                />
            )
        }
        if (asset?.peraMetadata?.verificationTier === 'verified') {
            return (
                <PWIcon
                    name='assets/verified'
                    size='xs'
                />
            )
        }
        if (asset?.peraMetadata?.verificationTier === 'suspicious') {
            return (
                <PWIcon
                    name='assets/suspicious'
                    size='xs'
                />
            )
        }
        return undefined
    }, [asset, accountBalance.assetId])

    if (!asset?.unitName) {
        return <></>
    }

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
        >
            <AssetIcon
                asset={asset}
                size={iconSize ?? 'lg'}
            />
            <PWView style={styles.dataContainer}>
                <PWView style={styles.unitContainer}>
                    <PWView style={styles.row}>
                        <PWText style={styles.primaryUnit}>
                            {isAlgo ? 'Algo' : asset.name}
                        </PWText>
                        {verificationIcon}
                    </PWView>
                    <PWText style={styles.secondaryUnit}>
                        {asset.unitName}
                        {asset.assetId !== ALGO_ASSET_ID &&
                            ` - ${asset.assetId}`}
                    </PWText>
                </PWView>
                <PWView style={styles.amountContainer}>
                    <CurrencyDisplay
                        currency={asset.unitName}
                        value={accountBalance.amount}
                        precision={asset.decimals}
                        minPrecision={2}
                        showSymbol
                        style={styles.primaryAmount}
                    />
                    <CurrencyDisplay
                        currency={preferredFiatCurrency}
                        value={accountBalance.fiatValue}
                        precision={2}
                        minPrecision={2}
                        showSymbol
                        style={styles.secondaryAmount}
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}
