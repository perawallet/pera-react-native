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
import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { ChainNotice } from '@components/ChainNotice'
import { CopyableText } from '@components/CopyableText'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { ExpandableText } from '@components/ExpandableText'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { EthereumKnownContractRow } from '../EthereumKnownContractRow'
import { contractCallNoticeOf } from './contractCallNotice'
import { useStyles } from './styles'

// '0x', the 4-byte selector and the first 32-byte argument word, in hex.
const CALL_DATA_PREVIEW_LENGTH = 74

type EthereumContractCallDetailsProps = {
    presentation: EthereumTransactionPresentation
    /**
     * `'review'` is the signing screen: the raw call sits collapsed under
     * Advanced and the notice asks the user to trust the requesting dApp.
     * `'detail'` reads a transaction already made, so the call stays inline.
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
    const { view, value, standardCall, contractAction, knownContract, scope } =
        presentation
    const isReview = variant === 'review'
    const notice = isReview
        ? contractCallNoticeOf(source, verifiedOrigin)
        : undefined

    const selectorRow = !!view.selector && (
        <KeyValueRow
            testID='ethereum_contract_call_selector'
            title={t('transactions.contract_call.function_selector')}
        >
            <PWText>{view.selector}</PWText>
        </KeyValueRow>
    )

    const callDataRow = (
        <KeyValueRow
            title={t('transactions.contract_call.call_data')}
            verticalAlignment='top'
        >
            <CopyableText
                testID='ethereum_contract_call_data'
                copyValue={view.data}
            >
                <ExpandableText
                    text={view.data}
                    limit={CALL_DATA_PREVIEW_LENGTH}
                />
            </CopyableText>
        </KeyValueRow>
    )

    return (
        <PWView style={styles.container}>
            {!standardCall && !contractAction && (
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

            {isReview ? (
                <PWView testID='ethereum_contract_call_advanced'>
                    <TitledExpandablePanel
                        title={t('transactions.contract_call.advanced')}
                        contentStyle={styles.advanced}
                    >
                        {selectorRow}
                        {callDataRow}
                    </TitledExpandablePanel>
                </PWView>
            ) : (
                <>
                    {selectorRow}
                    {callDataRow}
                </>
            )}
        </PWView>
    )
}
