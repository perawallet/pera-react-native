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

import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { PWButton, PWText, PWView } from '@components/core'
import { AccountWithBalance } from '@components/AccountWithBalance'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionReviewLayout, type ReviewBodyProps } from '@modules/signing'
import type { SigningStackParamList } from '@modules/signing/routes'
import { EthereumContractCallDetails } from '../EthereumContractCallDetails'
import { useEthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { EthereumReviewHeader } from './EthereumReviewHeader'
import { useStyles } from './styles'

type NavigationProp = StackNavigationProp<SigningStackParamList>

export const EthereumTransactionReviewBody = ({
    transaction,
    source,
    verifiedOrigin,
}: ReviewBodyProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NavigationProp>()
    const presentation = useEthereumTransactionPresentation(transaction)

    if (!presentation) {
        return null
    }

    const { view, amount, maxFee, signingAccount, scope } = presentation

    const handleViewDetails = () => {
        navigation.navigate('TransactionDetails', { scope, transaction })
    }

    let details = null
    if (view.kind === 'contract-call') {
        details = <EthereumContractCallDetails presentation={presentation} />
    } else if (view.token) {
        details = (
            <KeyValueRow
                testID='ethereum_review_asset'
                title={t('transactions.common.asset')}
            >
                <PWView style={styles.asset}>
                    {!!amount?.asset && (
                        <PWText>{amount.asset.unitName}</PWText>
                    )}
                    <AddressDisplay
                        address={view.token.contract}
                        displayType='address-only'
                    />
                </PWView>
            </KeyValueRow>
        )
    }

    return (
        <TransactionReviewLayout
            header={
                <EthereumReviewHeader
                    presentation={presentation}
                    source={source}
                    verifiedOrigin={verifiedOrigin}
                />
            }
            participants={
                signingAccount ? (
                    <PWView style={styles.participants}>
                        <PWText
                            variant='caption'
                            style={styles.caption}
                        >
                            {t('signing.transactions.signing_with')}
                        </PWText>
                        <AccountWithBalance
                            account={signingAccount}
                            chainId={scope.chainId}
                            style={styles.signingAccount}
                        />
                    </PWView>
                ) : null
            }
            details={details}
            fee={
                <PWView>
                    <PWView
                        testID='ethereum_max_fee'
                        style={styles.feeRow}
                    >
                        <PWText style={styles.label}>
                            {t('send_funds.fee.max_fee')}
                        </PWText>
                        <AssetAmount
                            asset={maxFee.asset}
                            value={maxFee.value}
                            showSymbol
                            ignorePrivacyMode
                        />
                    </PWView>
                    <PWButton
                        testID='ethereum_view_details'
                        variant='linkPositive'
                        style={styles.transactionDetails}
                        paddingStyle='none'
                        title={t('signing.view_details')}
                        iconRight='chevron-right'
                        onPress={handleViewDetails}
                    />
                </PWView>
            }
        />
    )
}
