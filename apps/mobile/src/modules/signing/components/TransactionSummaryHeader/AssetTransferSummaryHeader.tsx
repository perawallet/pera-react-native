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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'

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
                    hugContent
                    textProps={{ style: styles.addressText }}
                    iconProps={{ color: theme.colors.textMain }}
                    address={receiver}
                />
            </PWView>

            <PWView style={styles.amountContainer}>
                {amount.isZero() ? null : (
                    <AssetAmount
                        asset={asset}
                        value={amount}
                        // The signer authorizes an outgoing transfer, so the
                        // amount leaves their account.
                        sign='-'
                        showSymbol
                        variant='h1'
                        style={styles.amountValue}
                        ignorePrivacyMode
                    />
                )}
                {amount.isZero() ? null : (
                    <PreferredAmount
                        sourceAmount={amount}
                        sourceAssetId={assetId}
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
