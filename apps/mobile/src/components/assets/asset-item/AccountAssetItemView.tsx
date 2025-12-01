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

import AssetIcon from '../asset-icon/AssetIcon'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import PWView, { PWViewProps } from '../../common/view/PWView'
import { ALGO_ASSET_ID, useAssetsQuery } from '@perawallet/wallet-core-assets'
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { Text, useTheme } from '@rneui/themed'
import { useStyles } from './styles'
import { useMemo } from 'react'
import PWIcon from '../../common/icons/PWIcon'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { debugLog } from '@perawallet/wallet-core-shared'

type AccountAssetItemViewProps = {
    accountBalance: AssetWithAccountBalance
    iconSize?: number
} & PWViewProps

const AccountAssetItemView = ({
    accountBalance,
    iconSize,
    ...rest
}: AccountAssetItemViewProps) => {
    const { theme } = useTheme()
    const styles = useStyles()

    const { preferredCurrency } = useCurrency()
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
                size={iconSize ?? theme.spacing.xl * 1.5}
            />
            <PWView style={styles.dataContainer}>
                <PWView style={styles.unitContainer}>
                    <PWView style={styles.row}>
                        <Text style={styles.primaryUnit}>
                            {isAlgo ? 'Algo' : asset.name}
                        </Text>
                        {verificationIcon}
                    </PWView>
                    <Text style={styles.secondaryUnit}>
                        {asset.unitName}
                        {asset.assetId !== ALGO_ASSET_ID &&
                            ` - ${asset.assetId}`}
                    </Text>
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
                        currency={preferredCurrency}
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

export default AccountAssetItemView
