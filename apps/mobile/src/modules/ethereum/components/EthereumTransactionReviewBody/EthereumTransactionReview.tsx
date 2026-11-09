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

import type { ReactNode } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { PWButton, PWText, PWView } from '@components/core'
import { AccountWithBalance } from '@components/AccountWithBalance'
import { FeeSummary } from '@components/FeeRow'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionReviewLayout } from '@modules/signing'
import type { SigningStackParamList } from '@modules/signing/routes'
import { EthereumApprovalDetails } from '../EthereumApprovalDetails'
import { EthereumContractActionDetails } from '../EthereumContractActionDetails'
import { EthereumContractCallDetails } from '../EthereumContractCallDetails'
import { EthereumSimulationSection } from '../EthereumSimulationSection'
import { EthereumTransferAssetRows } from '../EthereumTransferAssetRows'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { EthereumReviewHeader } from './EthereumReviewHeader'
import { EthereumReviewHero } from './EthereumReviewHero'
import { useEthereumTransactionReview } from './useEthereumTransactionReview'
import { useStyles } from './styles'

type NavigationProp = StackNavigationProp<SigningStackParamList>

type EthereumTransactionReviewProps = {
    transaction: TransactionNative
    presentation: EthereumTransactionPresentation
    source?: SignRequestSource
    verifiedOrigin?: string
    actions: ReactNode
}

export const EthereumTransactionReview = ({
    transaction,
    presentation,
    source,
    verifiedOrigin,
    actions,
}: EthereumTransactionReviewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NavigationProp>()
    const { simulation, warningItems } = useEthereumTransactionReview({
        presentation,
        source,
        verifiedOrigin,
    })
    const {
        reviewFee,
        signingAccount,
        scope,
        standardCall,
        contractAction,
        isTransfer,
    } = presentation
    const handleViewDetails = () => {
        navigation.navigate('TransactionDetails', { scope, transaction })
    }

    let callDetails = null
    if (standardCall && !isTransfer) {
        callDetails = <EthereumApprovalDetails presentation={presentation} />
    } else if (contractAction) {
        callDetails = (
            <EthereumContractActionDetails
                presentation={presentation}
                source={source}
                verifiedOrigin={verifiedOrigin}
            />
        )
    } else if (!isTransfer) {
        callDetails = (
            <EthereumContractCallDetails
                presentation={presentation}
                variant='review'
                source={source}
                verifiedOrigin={verifiedOrigin}
            />
        )
    } else {
        callDetails = (
            <EthereumTransferAssetRows
                presentation={presentation}
                testIDPrefix='ethereum_review'
            />
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
            hero={<EthereumReviewHero presentation={presentation} />}
            warnings={warningItems}
            summary={
                <EthereumSimulationSection
                    presentation={presentation}
                    state={simulation}
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
            details={
                <PWView style={styles.details}>
                    {callDetails}
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
            stickyFee={
                reviewFee ? (
                    <FeeSummary
                        testID='ethereum_review_fee'
                        scope={scope}
                        maxAmount={reviewFee.maxAmount}
                        estimate={reviewFee.estimate}
                        isCompact
                    />
                ) : (
                    <PWView
                        testID='ethereum_review_fee'
                        style={styles.feeRow}
                    >
                        <PWText style={styles.label}>
                            {t('send_funds.fee.max_fee')}
                        </PWText>
                        <PWText>{t('ethereum.batch.fee_when_reached')}</PWText>
                    </PWView>
                )
            }
            actions={actions}
        />
    )
}
