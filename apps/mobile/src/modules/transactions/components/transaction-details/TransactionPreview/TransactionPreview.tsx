/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { PWIcon, PWTouchableOpacity, PWView } from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import {
    getTransactionType,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { TxTypeDetails } from './TxTypeDetails'

export type TransactionPreviewProps = {
    transaction: PeraDisplayableTransaction
    onPress?: (tx: PeraDisplayableTransaction) => void
}

export const TransactionPreview = ({
    transaction,
    onPress,
}: TransactionPreviewProps) => {
    const styles = useStyles()
    const type = getTransactionType(transaction)

    const handlePress = () => {
        onPress?.(transaction)
    }

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={handlePress}
        >
            <TransactionIcon
                type={type}
                size='sm'
            />
            <TxTypeDetails tx={transaction} />
            <PWView style={styles.rightContent}>
                <PWIcon
                    name='chevron-right'
                    size='sm'
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
