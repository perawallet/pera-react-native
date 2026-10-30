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

import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { ChainNotice } from '@components/ChainNotice'
import { CopyableText } from '@components/CopyableText'
import { ExpandableText } from '@components/ExpandableText'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'

// '0x', the 4-byte selector and the first 32-byte argument word, in hex.
const CALL_DATA_PREVIEW_LENGTH = 74

type EthereumContractCallDetailsProps = {
    presentation: EthereumTransactionPresentation
}

export const EthereumContractCallDetails = ({
    presentation,
}: EthereumContractCallDetailsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { view, value, standardCall } = presentation

    return (
        <PWView style={styles.container}>
            {!standardCall && (
                <ChainNotice
                    kind='warning'
                    titleKey='transactions.contract_call.warning'
                    testID='ethereum_contract_call_warning'
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
                    />
                </KeyValueRow>
            )}

            <KeyValueRow
                testID='ethereum_contract_call_value'
                title={t('transactions.common.amount')}
            >
                <AssetAmount
                    chainId={presentation.scope.chainId}
                    asset={value.asset}
                    value={value.value}
                    showSymbol
                    ignorePrivacyMode
                />
            </KeyValueRow>

            {!!view.selector && (
                <KeyValueRow
                    testID='ethereum_contract_call_selector'
                    title={t('transactions.contract_call.function_selector')}
                >
                    <PWText>{view.selector}</PWText>
                </KeyValueRow>
            )}

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
        </PWView>
    )
}
