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
import { PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'

type EthereumReviewHeroProps = {
    presentation: EthereumTransactionPresentation
}

/** What a transfer moves and to whom. */
export const EthereumReviewHero = ({
    presentation,
}: EthereumReviewHeroProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { counterparty, amount, isAmountLoading, isTransfer } = presentation
    const hasRecipient = isTransfer && !!counterparty
    const hasAmount = isTransfer && (!!amount || isAmountLoading)

    if (!hasRecipient && !hasAmount) {
        return null
    }

    return (
        <PWView style={styles.hero}>
            {hasRecipient && (
                <AddressDisplay
                    style={styles.address}
                    hugContent
                    displayType='address-only'
                    textProps={{ style: styles.addressText }}
                    iconProps={{ color: theme.colors.textMain }}
                    address={counterparty}
                    scope={presentation.scope}
                />
            )}

            {hasAmount && (
                <PWView style={styles.amountContainer}>
                    <AssetAmount
                        chainId={presentation.scope.chainId}
                        testID='ethereum_review_amount'
                        asset={amount?.asset}
                        value={amount?.value}
                        isLoading={isAmountLoading}
                        // The signer authorizes an outgoing transfer, so the
                        // amount leaves their account.
                        sign='-'
                        showSymbol
                        variant='h1'
                        style={styles.amount}
                        ignorePrivacyMode
                    />
                    {!!amount?.asset && !presentation.collectible && (
                        <PreferredAmount
                            sourceAmount={amount.value}
                            sourceAssetId={amount.asset.assetId}
                            scope={presentation.scope}
                            variant='h4'
                            style={styles.secondaryAmount}
                            ignorePrivacyMode
                        />
                    )}
                </PWView>
            )}
        </PWView>
    )
}
