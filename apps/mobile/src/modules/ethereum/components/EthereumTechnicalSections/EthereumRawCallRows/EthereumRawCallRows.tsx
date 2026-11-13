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

import {
    bottomSheetNotifier,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { ExpandableText } from '@components/ExpandableText'
import { KeyValueRow } from '@components/KeyValueRow'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumTransactionPresentation } from '@modules/ethereum/hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'

// '0x', the 4-byte selector and the first 32-byte argument word, in hex.
const CALL_DATA_PREVIEW_LENGTH = 74

type EthereumRawCallRowsProps = {
    presentation: EthereumTransactionPresentation
}

/** A contract call as sent: native value, selector and calldata. Its target is named above it. */
export const EthereumRawCallRows = ({
    presentation,
}: EthereumRawCallRowsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()
    const { view, value, scope } = presentation

    const handleCopyCallData = () => {
        void copyToClipboard(view.data, {
            notifier: bottomSheetNotifier.current ?? undefined,
        })
    }

    return (
        <>
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
        </>
    )
}
