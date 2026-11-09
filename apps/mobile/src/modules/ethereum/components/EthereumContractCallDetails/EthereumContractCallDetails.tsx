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
import {
    bottomSheetNotifier,
    PWLoadingIndicator,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { ChainNotice } from '@components/ChainNotice'
import { ExpandableText } from '@components/ExpandableText'
import { KeyValueRow } from '@components/KeyValueRow'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useEthereumVerifiedCall } from '../../hooks/useEthereumVerifiedCall'
import { EthereumKnownContractRow } from '../EthereumKnownContractRow'
import { contractCallNoticeOf, isCallUnexplained } from './contractCallNotice'
import { EthereumVerifiedCallRows } from './EthereumVerifiedCallRows'
import { useStyles } from './styles'

// '0x', the 4-byte selector and the first 32-byte argument word, in hex.
const CALL_DATA_PREVIEW_LENGTH = 74

type EthereumContractCallDetailsProps = {
    presentation: EthereumTransactionPresentation
    /**
     * `'review'` is the signing screen: the notice asks the user to trust the
     * requesting dApp and the raw call is left to the details screen.
     * `'detail'` shows the raw call inline.
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
    const { copyToClipboard } = useClipboard()
    const { view, value, contractAction, knownContract, scope } = presentation
    const isReview = variant === 'review'
    const notice = isReview
        ? contractCallNoticeOf(source, verifiedOrigin)
        : undefined
    // Only a review looks the name up; a transaction already made shows its call as recorded.
    const verifiedCall = useEthereumVerifiedCall(view, scope, isReview)
    const isExplained = !isCallUnexplained(presentation)

    const selectorRow = !!view.selector && (
        <KeyValueRow
            testID='ethereum_contract_call_selector'
            title={t('transactions.contract_call.function_selector')}
        >
            <PWText>{view.selector}</PWText>
        </KeyValueRow>
    )

    const handleCopyCallData = () => {
        void copyToClipboard(view.data, {
            notifier: bottomSheetNotifier.current ?? undefined,
        })
    }

    const callDataRow = (
        <KeyValueRow
            title={t('transactions.contract_call.call_data')}
            verticalAlignment='top'
        >
            <PWView style={styles.callData}>
                <PWView
                    style={styles.callDataText}
                    testID='ethereum_contract_call_data'
                >
                    <ExpandableText
                        text={view.data}
                        limit={CALL_DATA_PREVIEW_LENGTH}
                    />
                </PWView>
                <PWTouchableIcon
                    name='copy'
                    size='sm'
                    variant='secondary'
                    accessibilityLabel={t('common.copy')}
                    testID='ethereum_contract_call_data_copy'
                    onPress={handleCopyCallData}
                />
            </PWView>
        </KeyValueRow>
    )

    return (
        <PWView style={styles.container}>
            {!isExplained && (
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

            {!!view.to && (
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

            {!isReview && (
                <>
                    {selectorRow}
                    {callDataRow}
                </>
            )}
        </PWView>
    )
}
