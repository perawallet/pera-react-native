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
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { AddressDisplay } from '@components/AddressDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { ApplicationDisplay } from '@modules/projects'
import {
    PreviewUnavailableCard,
    ReviewActionHeader,
    ReviewFromRow,
    ReviewNetworkRow,
    ReviewTarget,
    ReviewTechnicalDetailsLink,
    SourceMetadataBadge,
    TransactionReviewLayout,
    WalletChangesCard,
} from '@modules/signing'
import type { SigningStackParamList } from '@modules/signing/routes'
import { KeyRegistrationSummary } from '../../KeyRegistrationSummary'
import { AlgorandReviewFeeRow } from './AlgorandReviewFeeRow'
import {
    useAlgorandTransactionReview,
    type AlgorandReviewTarget,
} from './useAlgorandTransactionReview'

type NavigationProp = StackNavigationProp<SigningStackParamList>

export type AlgorandTransactionReviewProps = {
    transaction: TransactionNative
    view: AlgorandTransactionView
    source?: SignRequestSource
    verifiedOrigin?: string
    actions: ReactNode
}

const targetOf = (target: AlgorandReviewTarget): ReactNode => {
    switch (target.kind) {
        case 'address': {
            return (
                <AddressDisplay
                    address={target.address}
                    hugContent
                    testID='algorand_review_target'
                />
            )
        }
        case 'application': {
            return <ApplicationDisplay applicationId={target.applicationId} />
        }
        case 'asset': {
            return (
                <ReviewTarget
                    label={target.label}
                    testID='algorand_review_target'
                />
            )
        }
    }
}

export const AlgorandTransactionReview = ({
    transaction,
    view,
    source,
    verifiedOrigin,
    actions,
}: AlgorandTransactionReviewProps) => {
    const { t } = useLanguage()
    const navigation = useNavigation<NavigationProp>()
    const { scope, kind, iconName, title, target, signingAccount, impact } =
        useAlgorandTransactionReview(view)

    const handleViewDetails = () => {
        navigation.navigate('TransactionDetails', { scope, transaction })
    }

    let changes: ReactNode = null
    if (impact.simulationFailed) {
        changes = <PreviewUnavailableCard />
    } else if (impact.hasImpact || impact.isSimulating) {
        changes = (
            <WalletChangesCard
                spend={impact.spend}
                receive={impact.receive}
                isLoading={!impact.hasImpact && impact.isSimulating}
            />
        )
    }

    return (
        <TransactionReviewLayout
            requester={
                source ? (
                    <SourceMetadataBadge
                        metadata={source}
                        verifiedOrigin={verifiedOrigin}
                    />
                ) : undefined
            }
            action={
                <ReviewActionHeader
                    iconName={iconName}
                    title={title}
                    target={target ? targetOf(target) : undefined}
                />
            }
            changes={changes}
            details={
                <>
                    {!!signingAccount && (
                        <ReviewFromRow
                            account={signingAccount}
                            chainId={scope.chainId}
                        />
                    )}
                    <ReviewNetworkRow scope={scope} />
                    <AlgorandReviewFeeRow transaction={view} />
                </>
            }
            extra={
                kind === 'key-registration' ? (
                    <KeyRegistrationSummary transaction={view} />
                ) : undefined
            }
            technicalDetails={
                <ReviewTechnicalDetailsLink
                    subtitle={t('signing.review.technical_details_generic')}
                    onPress={handleViewDetails}
                    testID='algorand_view_details'
                />
            }
            actions={actions}
        />
    )
}
