import {
    microAlgosToAlgos,
    PeraDisplayableTransaction,
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
            return -algos
        }
        return algos
    }, [senderAddress, payment, receiverAddress])

    const amountStyle = useMemo(() => {
        if (senderAddress === referenceAddress) {
            return styles.amountNegative
        } else if (receiverAddress === referenceAddress) {
            return styles.amountPositive
        }
        return undefined
    }, [amount])

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
