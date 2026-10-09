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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import { useStyles } from './styles'
import { AddressDisplay } from '@components/AddressDisplay'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { usePaymentSummaryHeader } from './usePaymentSummaryHeader'

type PaymentSummaryHeaderProps = {
    transaction: PeraDisplayableTransaction
}

export const PaymentSummaryHeader = ({
    transaction,
}: PaymentSummaryHeaderProps) => {
    const nativeAsset = useNativeAsset()
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { amount } = usePaymentSummaryHeader(transaction)

    return (
        <PWView style={styles.container}>
            <PWView style={styles.textContainer}>
                <PWText
                    variant='h3'
                    style={styles.typeText}
                >
                    {t('transactions.summary.payment_to')}
                </PWText>
                <AddressDisplay
                    style={styles.address}
                    hugContent
                    textProps={{ style: styles.addressText }}
                    iconProps={{ color: theme.colors.textMain }}
                    address={transaction.paymentTransaction?.receiver || ''}
                />
            </PWView>
            <PWView style={styles.amountContainer}>
                <AssetAmount
                    asset={nativeAsset}
                    value={amount}
                    // The signer authorizes an outgoing payment, so the amount
                    // leaves their account.
                    sign='-'
                    showSymbol
                    variant='h1'
                    style={styles.amountValue}
                    ignorePrivacyMode
                />
                <PreferredAmount
                    sourceAmount={amount}
                    sourceAssetId={nativeAsset.assetId}
                    variant='h4'
                    style={styles.secondaryAmountValue}
                    ignorePrivacyMode
                />
            </PWView>
        </PWView>
    )
}
