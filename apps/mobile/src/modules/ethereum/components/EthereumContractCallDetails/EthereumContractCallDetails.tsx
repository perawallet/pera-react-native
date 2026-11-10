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

import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { PWLoadingIndicator, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { ChainNotice } from '@components/ChainNotice'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useEthereumVerifiedCall } from '../../hooks/useEthereumVerifiedCall'
import { EthereumKnownContractRow } from '../EthereumKnownContractRow'
import { contractCallNoticeOf, isCallUnexplained } from './contractCallNotice'
import { EthereumVerifiedCallRows } from './EthereumVerifiedCallRows'
import { useStyles } from './styles'

type EthereumContractCallDetailsProps = {
    presentation: EthereumTransactionPresentation
    /**
     * `'review'` is the signing screen, with the target and any value it
     * sends. `'detail'` leaves the raw call to the details screen's Advanced
     * section.
     */
    variant: 'review' | 'detail'
    /** Read only on `'review'`. */
    source?: SignRequestSource
    /** Read only on `'review'`. */
    verifiedOrigin?: string
}

export const EthereumContractCallDetails = ({
    presentation,
    variant,
    source,
    verifiedOrigin,
}: EthereumContractCallDetailsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { view, value, contractAction, knownContract, scope } = presentation
    const isReview = variant === 'review'
    // A detail still to be signed warns as the review's banner does; a mined
    // call is past trusting anyone.
    const notice =
        !isReview && !('isMined' in view)
            ? contractCallNoticeOf(source, verifiedOrigin)
            : undefined
    // Only a review looks the name up; a transaction already made shows its call as recorded.
    const verifiedCall = useEthereumVerifiedCall(view, scope, isReview)
    const isExplained = !isCallUnexplained(presentation)

    return (
        <PWView style={styles.container}>
            {!isReview && !isExplained && (
                <ChainNotice
                    kind='warning'
                    titleKey={
                        notice?.titleKey ?? 'transactions.contract_call.warning'
                    }
                    params={notice?.params}
                    testID='ethereum_contract_call_warning'
                />
            )}

            {!!knownContract && !contractAction && !!view.to && (
                <EthereumKnownContractRow
                    knownContract={knownContract}
                    address={view.to}
                    scope={scope}
                    source={source}
                    verifiedOrigin={verifiedOrigin}
                />
            )}

            {isReview && !!view.to && (
                <KeyValueRow
                    testID='ethereum_contract_call_to'
                    title={t('transactions.common.to')}
                >
                    <AddressDisplay
                        address={view.to}
                        displayType='address-only'
                        scope={scope}
                    />
                </KeyValueRow>
            )}

            {/* A call that sends no native coin has no amount worth leading with. */}
            {isReview && !view.value.isZero() && (
                <KeyValueRow
                    testID='ethereum_contract_call_value'
                    title={t('transactions.common.amount')}
                >
                    <AssetAmount
                        chainId={scope.chainId}
                        asset={value.asset}
                        value={value.value}
                        showSymbol
                        ignorePrivacyMode
                    />
                </KeyValueRow>
            )}

            {verifiedCall.status === 'loading' && (
                <KeyValueRow
                    testID='ethereum_verified_call_loading'
                    title={t('transactions.contract_call.function')}
                >
                    <PWLoadingIndicator size='sm' />
                </KeyValueRow>
            )}

            {verifiedCall.status === 'decoded' && (
                <EthereumVerifiedCallRows
                    call={verifiedCall.call}
                    scope={scope}
                />
            )}

            {verifiedCall.status === 'lookup-failed' && (
                <PWText
                    testID='ethereum_verified_call_lookup_failed'
                    variant='caption'
                    style={styles.caption}
                >
                    {t('transactions.contract_call.lookup_failed')}
                </PWText>
            )}
        </PWView>
    )
}
