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

import { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'

import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { AddressDisplay } from '@components/AddressDisplay'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { useAssetTransferSummaryHeader } from './useAssetTransferSummaryHeader'

type AssetTransferSummaryHeaderProps = {
    transaction: PeraDisplayableTransaction
}

export const AssetTransferSummaryHeader = ({
    transaction,
}: AssetTransferSummaryHeaderProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const { label, asset, receiver, amount, assetId } =
        useAssetTransferSummaryHeader(transaction)

    return (
        <PWView style={styles.container}>
            <PWView style={styles.textContainer}>
                <PWText
                    variant='h3'
                    style={styles.typeText}
                >
                    {t(label, { asset: asset?.name ?? assetId })}
                </PWText>
                <AddressDisplay
                    style={styles.address}
                    displayType='simple'
                    textProps={{ style: styles.addressText }}
                    iconProps={{ color: theme.colors.textMain }}
                    address={receiver}
                />
            </PWView>

            <PWView style={styles.amountContainer}>
                {amount.isZero() ? null : (
                    <CurrencyDisplay
                        currency={asset?.unitName ?? ''}
                        precision={asset?.decimals ?? DEFAULT_PRECISION}
                        minPrecision={DEFAULT_PRECISION}
                        value={amount}
                        showSymbol
                        variant='h1'
                        style={styles.amountValue}
                        ignorePrivacyMode
                    />
                )}
                {amount.isZero() ? null : (
                    <PreferredCurrencyDisplay
                        sourceAmount={amount}
                        sourceAssetId={assetId}
                        precision={DEFAULT_PRECISION}
                        minPrecision={DEFAULT_PRECISION}
                        showSymbol
                        variant='h4'
                        style={styles.secondaryAmountValue}
                        ignorePrivacyMode
                    />
                )}
            </PWView>
        </PWView>
    )
}
