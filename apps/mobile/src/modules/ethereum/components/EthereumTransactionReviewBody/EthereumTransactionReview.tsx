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
import { PWText } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { useLanguage } from '@hooks/useLanguage'
import {
    PreviewUnavailableCard,
    ReviewActionHeader,
    ReviewDetailRow,
    ReviewFromRow,
    ReviewNetworkRow,
    ReviewTarget,
    ReviewTechnicalDetailsLink,
    SourceMetadataBadge,
    TransactionReviewLayout,
    WalletChangesCard,
} from '@modules/signing'
import type { SigningStackParamList } from '@modules/signing/routes'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { EthereumPermissionCard } from './EthereumPermissionCard'
import { EthereumReviewFeeRow } from './EthereumReviewFeeRow'
import {
    useEthereumTransactionReview,
    type UseEthereumTransactionReviewResult,
} from './useEthereumTransactionReview'
import { useStyles } from './styles'

type NavigationProp = StackNavigationProp<SigningStackParamList>

type EthereumTransactionReviewProps = {
    transaction: TransactionNative
    presentation: EthereumTransactionPresentation
    source?: SignRequestSource
    verifiedOrigin?: string
    actions: ReactNode
}

type ChangesProps = Pick<
    UseEthereumTransactionReviewResult,
    'simulation' | 'permissions' | 'transferSpend' | 'requesterHost'
> & {
    presentation: EthereumTransactionPresentation
    isDappRequest: boolean
}

const changesOf = ({
    simulation,
    permissions,
    transferSpend,
    requesterHost,
    presentation,
    isDappRequest,
}: ChangesProps): ReactNode => {
    const { scope, isTransfer } = presentation
    const permissionCard = (isOnlyPermission: boolean) =>
        permissions.length > 0 ? (
            <EthereumPermissionCard
                scope={scope}
                permissions={permissions}
                isOnlyPermission={isOnlyPermission}
            />
        ) : null

    switch (simulation.status) {
        case 'loading': {
            return (
                <WalletChangesCard
                    spend={[]}
                    receive={[]}
                    isLoading
                />
            )
        }
        case 'success': {
            const movesValue =
                simulation.spend.length > 0 || simulation.receive.length > 0
            return (
                <>
                    {(movesValue || permissions.length === 0) && (
                        <WalletChangesCard
                            spend={simulation.spend}
                            receive={simulation.receive}
                        />
                    )}
                    {permissionCard(simulation.spend.length === 0)}
                </>
            )
        }
        case 'unavailable': {
            return (
                <>
                    <PreviewUnavailableCard host={requesterHost} />
                    {permissionCard(false)}
                </>
            )
        }
        default: {
            if (permissions.length > 0) return permissionCard(true)
            if (isTransfer && transferSpend.length > 0) {
                return (
                    <WalletChangesCard
                        spend={transferSpend}
                        receive={[]}
                    />
                )
            }
            // A dApp's call the simulator didn't cover can't be previewed either.
            return isDappRequest && !isTransfer ? (
                <PreviewUnavailableCard host={requesterHost} />
            ) : null
        }
    }
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
    const review = useEthereumTransactionReview({
        presentation,
        source,
        verifiedOrigin,
    })
    const { reviewFee, signingAccount, scope, iconName } = presentation

    const handleViewDetails = () => {
        navigation.navigate('TransactionDetails', { scope, transaction })
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
                    title={review.title}
                    target={
                        review.target ? (
                            <ReviewTarget
                                label={review.target.label}
                                status={review.target.status}
                                testID='ethereum_review_target'
                            />
                        ) : undefined
                    }
                />
            }
            changes={changesOf({
                ...review,
                presentation,
                isDappRequest: !!source,
            })}
            warnings={review.warningItems}
            details={
                <>
                    {!!signingAccount && (
                        <ReviewFromRow
                            account={signingAccount}
                            chainId={scope.chainId}
                        />
                    )}
                    {!!presentation.sender && (
                        <ReviewDetailRow
                            label={t('signing.review.holder')}
                            testID='ethereum_review_holder'
                        >
                            <AddressDisplay
                                address={presentation.sender}
                                displayType='address-only'
                                scope={scope}
                            />
                        </ReviewDetailRow>
                    )}
                    <ReviewNetworkRow scope={scope} />
                    {reviewFee ? (
                        <EthereumReviewFeeRow
                            scope={scope}
                            reviewFee={reviewFee}
                        />
                    ) : (
                        <ReviewDetailRow
                            label={t('signing.review.network_fee')}
                            testID='ethereum_review_fee'
                        >
                            <PWText style={styles.feePending}>
                                {t('ethereum.batch.fee_when_reached')}
                            </PWText>
                        </ReviewDetailRow>
                    )}
                </>
            }
            technicalDetails={
                <ReviewTechnicalDetailsLink
                    subtitle={t(
                        presentation.view.kind === 'contract-call'
                            ? 'signing.review.technical_details_evm'
                            : 'signing.review.technical_details_generic',
                    )}
                    onPress={handleViewDetails}
                    testID='ethereum_view_details'
                />
            }
            actions={actions}
        />
    )
}
