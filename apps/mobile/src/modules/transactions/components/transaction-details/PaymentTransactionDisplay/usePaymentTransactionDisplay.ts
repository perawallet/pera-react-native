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
    microAlgosToAlgos,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useMemo } from 'react'
import { useStyles } from './styles'

export const usePaymentTransactionDisplay = (
    transaction: PeraDisplayableTransaction,
    referenceAddress?: string,
) => {
    const payment = transaction.paymentTransaction

    const styles = useStyles()

    const receiverAddress = payment?.receiver
    const senderAddress = transaction.sender
    const amount = useMemo(() => {
        const algos = microAlgosToAlgos(payment?.amount ?? 0n)
        if (senderAddress === referenceAddress) {
            return algos.negated()
        }
        return algos
    }, [senderAddress, payment, referenceAddress])

    const amountStyle = useMemo(() => {
        if (senderAddress === referenceAddress) {
            return styles.amountNegative
        } else if (receiverAddress === referenceAddress) {
            return styles.amountPositive
        }
        return undefined
    }, [
        styles.amountNegative,
        receiverAddress,
        senderAddress,
        styles.amountPositive,
        referenceAddress,
    ])

    const showWarnings = useMemo(() => {
        return !transaction?.confirmedRound
    }, [transaction])

    return {
        payment,
        amount,
        amountStyle,
        showWarnings,
        receiverAddress,
        senderAddress,
        transaction,
    }
}
