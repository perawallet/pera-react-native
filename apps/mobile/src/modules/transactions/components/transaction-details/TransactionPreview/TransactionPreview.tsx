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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ExternalTransactionInfoContent } from '@modules/signing/components/ExternalTransactionInfoContent'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import {
    classifyDisplayableTransaction,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { GestureResponderEvent } from 'react-native'
import { useStyles } from './styles'
import { TxTypeDetails } from './TxTypeDetails'

export type TransactionPreviewProps = {
    transaction: PeraDisplayableTransaction
    onPress?: (tx: PeraDisplayableTransaction) => void
    /**
     * When true, render the "Other signer" pill in the right slot. The pill
     * is tappable independently of the row and opens the
     * {@link ExternalTransactionInfoContent} bottom sheet.
     */
    isExternal?: boolean
    testID?: string
}

export const TransactionPreview = ({
    transaction,
    onPress,
    isExternal = false,
    testID,
}: TransactionPreviewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()
    const type = classifyDisplayableTransaction(transaction)

    const handleRowPress = () => {
        onPress?.(transaction)
    }

    const handlePillPress = (e: GestureResponderEvent) => {
        e.stopPropagation()
        void requestBottomSheet<void>({
            contents: <ExternalTransactionInfoContent />,
            options: { size: 'auto', enablePanDownToClose: true },
        })
    }

    return (
        <PWTouchableOpacity
            testID={testID}
            style={styles.container}
            onPress={handleRowPress}
        >
            <TransactionIcon
                type={type}
                size='sm'
            />
            <TxTypeDetails
                tx={transaction}
                isExternal={isExternal}
            />
            <PWView style={styles.rightContent}>
                {isExternal && (
                    <PWTouchableOpacity
                        testID='transaction-preview-external-pill'
                        onPress={handlePillPress}
                        hitSlop={8}
                        style={styles.externalPill}
                    >
                        <PWText
                            variant='caption'
                            style={styles.externalPillText}
                        >
                            {t('signing.external_transaction.pill_label')}
                        </PWText>
                        <PWIcon
                            name='info'
                            size='xs'
                        />
                    </PWTouchableOpacity>
                )}
                <PWIcon
                    name='chevron-right'
                    size='sm'
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
